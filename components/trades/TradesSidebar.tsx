"use client";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Trade, MistakeType, TradeFilterState } from "@/lib/types";
import { usePrivacy } from "@/lib/privacy-context";

interface TradesSidebarProps {
  filteredTrades: Trade[];
  mistakeTypes: MistakeType[];
  onFilterChange: (partial: Partial<TradeFilterState>) => void;
}

const MASK = "------";

function formatCurrency(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function TradesSidebar({ filteredTrades, mistakeTypes, onFilterChange }: TradesSidebarProps) {
  const { hidden } = usePrivacy();

  // --- Panel 1: Account Performance ---
  const perfStats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === "closed");
    const closedCount = closed.length;

    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const winners = closed.filter(t => (t.pnl ?? 0) > 0);
    const winRate = closedCount > 0 ? (winners.length / closedCount) * 100 : 0;

    const avgReturnDollar = closedCount > 0 ? totalPnl / closedCount : 0;

    // avgReturnPct: for each closed trade, (pnl / max(entry_price * shares, 1)) * 100, then average
    const returnPcts = closed.map(t => {
      const cost = Math.max((t.entry_price ?? 0) * (t.shares ?? 0), 1);
      return ((t.pnl ?? 0) / cost) * 100;
    });
    const avgReturnPct = returnPcts.length > 0
      ? returnPcts.reduce((a, b) => a + b, 0) / returnPcts.length
      : 0;

    // Cumulative P&L curve
    const sorted = [...closed]
      .filter(t => t.exit_date)
      .sort((a, b) => (a.exit_date! < b.exit_date! ? -1 : a.exit_date! > b.exit_date! ? 1 : 0));

    let running = 0;
    const curve = sorted.map(t => {
      running += t.pnl ?? 0;
      return { value: running };
    });

    const FALLBACK = [{ value: 0 }, { value: 0 }];

    return {
      totalPnl,
      winRate,
      avgReturnDollar,
      avgReturnPct,
      curve: curve.length >= 2 ? curve : FALLBACK,
    };
  }, [filteredTrades]);

  const chartColor = perfStats.totalPnl >= 0 ? "#22c55e" : "#ef4444";

  // --- Panel 2: Setups Breakdown ---
  const setupRows = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === "closed");
    const map: Record<string, { totalPnl: number; count: number; wins: number }> = {};

    for (const t of closed) {
      const rawTags = t.tags ? t.tags.split(",").map(s => s.trim()).filter(Boolean) : [];
      if (rawTags.length === 0) continue;
      for (const tag of rawTags) {
        if (!map[tag]) map[tag] = { totalPnl: 0, count: 0, wins: 0 };
        map[tag].totalPnl += t.pnl ?? 0;
        map[tag].count += 1;
        if ((t.pnl ?? 0) > 0) map[tag].wins += 1;
      }
    }

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        totalPnl: data.totalPnl,
        count: data.count,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);
  }, [filteredTrades]);

  // --- Panel 3: Mistakes Breakdown ---
  const mistakeRows = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === "closed");
    const map: Record<string, { totalPnl: number; count: number }> = {};

    for (const t of closed) {
      const ids = t.mistake_tag_ids ? t.mistake_tag_ids.split(",").filter(Boolean) : [];
      for (const id of ids) {
        if (!map[id]) map[id] = { totalPnl: 0, count: 0 };
        map[id].totalPnl += t.pnl ?? 0;
        map[id].count += 1;
      }
    }

    return Object.entries(map)
      .map(([id, data]) => {
        const mistakeType = mistakeTypes.find(m => m.id === id);
        return {
          id,
          name: mistakeType?.name ?? id,
          color: mistakeType?.color ?? "#94a3b8",
          totalPnl: data.totalPnl,
          count: data.count,
        };
      })
      // Sort by most costly impact (most negative first)
      .sort((a, b) => a.totalPnl - b.totalPnl);
  }, [filteredTrades, mistakeTypes]);

  return (
    <div className="space-y-3">
      {/* Panel 1 — Account Performance */}
      <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-4">
        <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
          Performance
        </span>

        {/* Stats row */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex flex-col items-center flex-1">
            <span className="text-[11px] dark:text-slate-400 text-slate-500">Avg Return $</span>
            <span
              className="text-sm font-semibold"
              style={{ color: perfStats.avgReturnDollar >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {hidden ? MASK : formatCurrency(perfStats.avgReturnDollar)}
            </span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-[11px] dark:text-slate-400 text-slate-500">Avg Return %</span>
            <span
              className="text-sm font-semibold"
              style={{ color: perfStats.avgReturnPct >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {hidden ? MASK : formatPct(perfStats.avgReturnPct)}
            </span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-[11px] dark:text-slate-400 text-slate-500">Win Rate</span>
            <span
              className="text-sm font-semibold"
              style={{ color: perfStats.winRate >= 50 ? "#22c55e" : "#ef4444" }}
            >
              {hidden ? MASK : `${perfStats.winRate.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* Cumulative P&L area chart */}
        <div className="h-[140px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perfStats.curve} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="sidebarPerfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={1.5}
                fill="url(#sidebarPerfGrad)"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Total P&L label */}
        <div className="text-center mt-1">
          <span
            className="text-xs font-medium"
            style={{ color: chartColor }}
          >
            {hidden ? MASK : `Cumulative: ${formatCurrency(perfStats.totalPnl)}`}
          </span>
        </div>
      </div>

      {/* Panel 2 — Setups Breakdown */}
      <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-4">
        <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
          Setups
        </span>

        {setupRows.length === 0 ? (
          <p className="text-xs dark:text-slate-500 text-slate-400 mt-3 text-center">No setups found</p>
        ) : (
          <div className="mt-2 space-y-1">
            {setupRows.map(row => (
              <button
                key={row.name}
                className="w-full flex items-start justify-between px-2 py-1.5 rounded-md hover:dark:bg-slate-700/60 hover:bg-slate-100 cursor-pointer transition-colors text-left"
                onClick={() => onFilterChange({ tags: [row.name] })}
              >
                <div>
                  <span className="text-sm dark:text-slate-200 text-slate-800 font-medium">{row.name}</span>
                  <p className="text-[11px] dark:text-slate-400 text-slate-500">
                    {hidden ? MASK : `${row.count} trade${row.count !== 1 ? "s" : ""}`}
                    {" · "}
                    {hidden ? MASK : `${row.winRate.toFixed(0)}% WR`}
                  </p>
                </div>
                <span
                  className="text-sm font-semibold ml-2 mt-0.5 shrink-0"
                  style={{ color: row.totalPnl >= 0 ? "#22c55e" : "#ef4444" }}
                >
                  {hidden ? MASK : formatCurrency(row.totalPnl)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panel 3 — Mistakes Breakdown */}
      <div className="dark:bg-slate-800 bg-white rounded-lg shadow p-4">
        <span className="text-xs uppercase tracking-wide dark:text-slate-400 text-slate-500 font-medium">
          Mistakes
        </span>

        {mistakeRows.length === 0 ? (
          <p className="text-xs dark:text-slate-500 text-slate-400 mt-3 text-center">No mistakes tagged</p>
        ) : (
          <div className="mt-2 space-y-1">
            {mistakeRows.map(row => (
              <button
                key={row.id}
                className="w-full flex items-start justify-between px-2 py-1.5 rounded-md hover:dark:bg-slate-700/60 hover:bg-slate-100 cursor-pointer transition-colors text-left"
                onClick={() => onFilterChange({ mistakeId: row.id })}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {/* Color dot */}
                  <span
                    className="mt-1 shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <div className="min-w-0">
                    <span className="text-sm dark:text-slate-200 text-slate-800 font-medium truncate block">{row.name}</span>
                    <p className="text-[11px] dark:text-slate-400 text-slate-500">
                      {hidden ? MASK : `${row.count} occurrence${row.count !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <span
                  className="text-sm font-semibold ml-2 mt-0.5 shrink-0"
                  style={{ color: row.totalPnl >= 0 ? "#22c55e" : "#ef4444" }}
                >
                  {hidden ? MASK : formatCurrency(row.totalPnl)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
