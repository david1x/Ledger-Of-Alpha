"use client";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Trade } from "@/lib/types";
import { usePrivacy } from "@/lib/privacy-context";

interface SummaryStatsBarProps {
  filteredTrades: Trade[];
  allTrades: Trade[];
  accountSize: number;
}

const MASK = "------";

function formatCurrency(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}

export default function SummaryStatsBar({ filteredTrades, allTrades, accountSize }: SummaryStatsBarProps) {
  const { hidden } = usePrivacy();

  // --- Stats computation ---
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === "closed");
    const closedCount = closed.length;

    // Cumulative Return
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    // Win %
    const winners = closed.filter(t => (t.pnl ?? 0) > 0);
    const losers = closed.filter(t => (t.pnl ?? 0) <= 0);
    const winPercent = closedCount > 0 ? (winners.length / closedCount) * 100 : 0;

    // P/L Ratio
    const avgWin = winners.length > 0
      ? winners.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / winners.length
      : 0;
    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losers.length)
      : 0;

    let plRatio: number | "infinity";
    if (closedCount === 0) {
      plRatio = 0;
    } else if (losers.length === 0 && winners.length > 0) {
      plRatio = "infinity";
    } else if (winners.length === 0) {
      plRatio = 0;
    } else {
      plRatio = avgLoss > 0 ? avgWin / avgLoss : "infinity";
    }

    return {
      totalPnl,
      winPercent,
      plRatio,
      avgWin,
      avgLoss,
      winnersCount: winners.length,
      losersCount: losers.length,
      closedCount,
    };
  }, [filteredTrades]);

  // --- Sparkline data ---
  const sparklines = useMemo(() => {
    const closed = filteredTrades
      .filter(t => t.status === "closed" && t.exit_date)
      .sort((a, b) => (a.exit_date! < b.exit_date! ? -1 : a.exit_date! > b.exit_date! ? 1 : 0));

    const FALLBACK = [{ value: 0 }, { value: 0 }];

    if (closed.length === 0) {
      return { cumulative: FALLBACK, plRatio: FALLBACK, winPct: FALLBACK };
    }

    // Cumulative P&L sparkline
    let running = 0;
    const cumulative = closed.map(t => {
      running += t.pnl ?? 0;
      return { value: running };
    });

    // Rolling 10-trade window P/L ratio
    const WINDOW = 10;
    const plRatioData = closed.map((_, i) => {
      const start = Math.max(0, i - WINDOW + 1);
      const window = closed.slice(start, i + 1);
      const wins = window.filter(t => (t.pnl ?? 0) > 0);
      const lsrs = window.filter(t => (t.pnl ?? 0) <= 0);
      if (wins.length === 0 && lsrs.length === 0) return { value: 0 };
      if (lsrs.length === 0) return { value: 2 }; // cap at 2 for display
      const aWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / Math.max(wins.length, 1);
      const aLoss = Math.abs(lsrs.reduce((s, t) => s + (t.pnl ?? 0), 0) / lsrs.length);
      return { value: aLoss > 0 ? aWin / aLoss : 2 };
    });

    // Rolling 10-trade window win rate
    const winPctData = closed.map((_, i) => {
      const start = Math.max(0, i - WINDOW + 1);
      const window = closed.slice(start, i + 1);
      const wins = window.filter(t => (t.pnl ?? 0) > 0).length;
      return { value: window.length > 0 ? (wins / window.length) * 100 : 0 };
    });

    return {
      cumulative: cumulative.length >= 2 ? cumulative : [...cumulative, ...FALLBACK].slice(0, Math.max(cumulative.length, 2)),
      plRatio: plRatioData.length >= 2 ? plRatioData : FALLBACK,
      winPct: winPctData.length >= 2 ? winPctData : FALLBACK,
    };
  }, [filteredTrades]);

  // --- Color coding ---
  const cumulativeColor = stats.totalPnl >= 0 ? "#22c55e" : "#ef4444";
  const plRatioColor = "#3b82f6"; // neutral blue — avoids confusing color flips as ratio crosses 1.0
  const winPctColor = stats.winPercent > 50 ? "#22c55e" : "#ef4444";

  // --- Headline display ---
  const cumulativeHeadline = hidden ? MASK : formatCurrency(stats.totalPnl);
  const cumulativeSubtitle = hidden
    ? `${MASK}% of account`
    : accountSize > 0
      ? `${((stats.totalPnl / accountSize) * 100).toFixed(1)}% of account`
      : "0.0% of account";

  const plRatioHeadline = hidden
    ? MASK
    : stats.plRatio === "infinity"
      ? "—"
      : (stats.plRatio as number).toFixed(2);

  let plRatioSubtitle: string;
  if (hidden) {
    plRatioSubtitle = `Avg $${MASK} / $${MASK}`;
  } else if (stats.winnersCount === 0 && stats.losersCount === 0) {
    plRatioSubtitle = "No trades yet";
  } else if (stats.losersCount === 0) {
    plRatioSubtitle = "No losing trades";
  } else if (stats.winnersCount === 0) {
    plRatioSubtitle = "No winning trades";
  } else {
    plRatioSubtitle = `Avg $${stats.avgWin.toFixed(2)} / $${stats.avgLoss.toFixed(2)}`;
  }

  const winPctHeadline = hidden ? MASK : `${stats.winPercent.toFixed(1)}%`;
  const winPctSubtitle = hidden ? `${MASK}W / ${MASK}L` : `${stats.winnersCount}W / ${stats.losersCount}L`;

  const showFilterLabel = filteredTrades.length < allTrades.length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Cumulative Return */}
        <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-3 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
            Cumulative Return
          </span>
          <span className="text-2xl font-bold" style={{ color: cumulativeColor }}>
            {cumulativeHeadline}
          </span>
          <span className="text-xs dark:text-slate-500 text-slate-400">{cumulativeSubtitle}</span>
          <div className="h-10 mt-auto pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklines.cumulative} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="statGradCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cumulativeColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={cumulativeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={cumulativeColor}
                  strokeWidth={1.5}
                  fill="url(#statGradCumulative)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P/L Ratio */}
        <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-3 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
            P/L Ratio
          </span>
          <span className="text-2xl font-bold" style={{ color: plRatioColor }}>
            {plRatioHeadline}
          </span>
          <span className="text-xs dark:text-slate-500 text-slate-400">{plRatioSubtitle}</span>
          <div className="h-10 mt-auto pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklines.plRatio} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="statGradPL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={plRatioColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={plRatioColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={plRatioColor}
                  strokeWidth={1.5}
                  fill="url(#statGradPL)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win % */}
        <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-3 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
            Win %
          </span>
          <span className="text-2xl font-bold" style={{ color: winPctColor }}>
            {winPctHeadline}
          </span>
          <span className="text-xs dark:text-slate-500 text-slate-400">{winPctSubtitle}</span>
          <div className="h-10 mt-auto pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklines.winPct} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="statGradWin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={winPctColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={winPctColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={winPctColor}
                  strokeWidth={1.5}
                  fill="url(#statGradWin)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {showFilterLabel && (
        <p className="text-center text-xs dark:text-slate-500 text-slate-400 mt-2">
          Based on {hidden ? "--" : filteredTrades.length} of {hidden ? "--" : allTrades.length} trades
        </p>
      )}
    </div>
  );
}
