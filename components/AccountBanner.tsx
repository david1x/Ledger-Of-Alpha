"use client";
import { Trade, QuoteMap } from "@/lib/types";
import { useMemo } from "react";
import { Eye, EyeOff, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Props {
  trades: Trade[];
  quotes?: QuoteMap;
  accountSize: number;
  hidden: boolean;
  onToggleHidden: () => void;
}

export default function AccountBanner({ trades, quotes, accountSize, hidden, onToggleHidden }: Props) {
  const stats = useMemo(() => {
    const closed = trades.filter(t => t.status === "closed");
    const open = trades.filter(t => t.status === "open");
    const winners = closed.filter(t => (t.pnl ?? 0) > 0);
    const losers = closed.filter(t => (t.pnl ?? 0) < 0);

    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl ?? 0), 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length : 0;
    const expectancy = winRate / 100 * avgWin + (1 - winRate / 100) * avgLoss;
    const currentBalance = accountSize + totalPnl;

    const unrealized = open.reduce((sum, t) => {
      if (t.entry_price == null || t.shares == null || !quotes?.[t.symbol]) return sum;
      return sum + (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1);
    }, 0);
    const hasLive = open.some(t => quotes?.[t.symbol] !== undefined);

    return { totalPnl, winRate, avgWin, avgLoss, expectancy, currentBalance, winners: winners.length, losers: losers.length, closed: closed.length, unrealized, hasLive, openCount: open.length };
  }, [trades, quotes, accountSize]);

  const mask = "------";
  const fmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;
  const isUp = stats.totalPnl >= 0;

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900/80 bg-white px-4 py-3">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Balance */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Balance</span>
          <span className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {hidden ? mask : `$${stats.currentBalance.toFixed(2)}`}
          </span>
        </div>

        <div className="w-px h-5 dark:bg-slate-700 bg-slate-200" />

        {/* Total P&L */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">P&L</span>
          <span className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {hidden ? mask : `${stats.totalPnl >= 0 ? "+" : "-"}${fmt(stats.totalPnl)}`}
          </span>
        </div>

        <div className="w-px h-5 dark:bg-slate-700 bg-slate-200" />

        {/* Win Rate */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Win Rate</span>
          <span className={`text-sm font-bold ${stats.winRate >= 50 ? "text-emerald-400" : "text-yellow-400"}`}>
            {hidden ? mask : `${stats.winRate.toFixed(1)}%`}
          </span>
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">
            {hidden ? "" : `(${stats.winners}W / ${stats.losers}L)`}
          </span>
        </div>

        <div className="w-px h-5 dark:bg-slate-700 bg-slate-200" />

        {/* Expectancy */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Expectancy</span>
          <span className={`text-sm font-bold ${stats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {hidden ? mask : `${stats.expectancy >= 0 ? "+" : "-"}${fmt(stats.expectancy)}`}
          </span>
        </div>

        <div className="w-px h-5 dark:bg-slate-700 bg-slate-200" />

        {/* Avg Win / Loss */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Avg W/L</span>
          <span className="text-sm font-bold text-emerald-400">
            {hidden ? mask : fmt(stats.avgWin)}
          </span>
          <span className="text-xs font-medium dark:text-slate-400 text-slate-500">/</span>
          <span className="text-sm font-bold text-red-400">
            {hidden ? mask : fmt(stats.avgLoss)}
          </span>
        </div>

        {/* Unrealized P&L */}
        {stats.hasLive && (
          <>
            <div className="w-px h-5 dark:bg-slate-700 bg-slate-200" />
            <div className="flex items-center gap-2">
              <Activity className={`w-3 h-3 ${stats.unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              <span className="text-xs font-medium dark:text-slate-400 text-slate-500">Unrealized</span>
              <span className={`text-sm font-bold ${stats.unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {hidden ? mask : `${stats.unrealized >= 0 ? "+" : "-"}${fmt(stats.unrealized)}`}
              </span>
            </div>
          </>
        )}

        {/* Privacy toggle */}
        <button
          onClick={onToggleHidden}
          className="ml-auto p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
          title={hidden ? "Show numbers" : "Hide numbers"}
        >
          {hidden
            ? <EyeOff className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
            : <Eye className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />}
        </button>
      </div>
    </div>
  );
}
