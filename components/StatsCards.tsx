"use client";
import { Trade, QuoteMap } from "@/lib/types";
import { TrendingUp, TrendingDown, Target, BarChart2, Activity } from "lucide-react";
import clsx from "clsx";

interface Props {
  trades: Trade[];
  quotes?: QuoteMap;
}

export default function StatsCards({ trades, quotes }: Props) {
  const closed = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");
  const winners = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losers = closed.filter((t) => (t.pnl ?? 0) < 0);

  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl ?? 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length : 0;
  const expectancy = winRate / 100 * avgWin + (1 - winRate / 100) * avgLoss;

  const unrealized = openTrades.reduce((sum, t) => {
    if (t.entry_price == null || t.shares == null || !quotes?.[t.symbol]) return sum;
    return sum + (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1);
  }, 0);
  const hasLive = openTrades.some(t => quotes?.[t.symbol] !== undefined);

  const stats = [
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      sub: `${closed.length} closed trades`,
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
      bg: totalPnl >= 0 ? "dark:bg-emerald-500/10 bg-emerald-50" : "dark:bg-red-500/10 bg-red-50",
      border: totalPnl >= 0 ? "dark:border-emerald-500/20 border-emerald-200" : "dark:border-red-500/20 border-red-200",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      sub: `${winners.length}W / ${losers.length}L`,
      icon: Target,
      color: winRate >= 50 ? "text-emerald-400" : "text-yellow-400",
      bg: "dark:bg-slate-800/50 bg-slate-50",
      border: "dark:border-slate-700 border-slate-200",
    },
    {
      label: "Avg Win / Loss",
      value: `$${avgWin.toFixed(0)} / $${Math.abs(avgLoss).toFixed(0)}`,
      sub: `Expectancy: $${expectancy.toFixed(2)}`,
      icon: BarChart2,
      color: "dark:text-slate-200 text-slate-700",
      bg: "dark:bg-slate-800/50 bg-slate-50",
      border: "dark:border-slate-700 border-slate-200",
    },
    {
      label: "Open / Planned",
      value: `${openTrades.length} / ${trades.filter((t) => t.status === "planned").length}`,
      sub: `${trades.length} total trades`,
      icon: TrendingUp,
      color: "text-blue-400",
      bg: "dark:bg-blue-500/10 bg-blue-50",
      border: "dark:border-blue-500/20 border-blue-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className={clsx("rounded-xl border p-4 space-y-2", s.bg, s.border)}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">{s.label}</span>
            <s.icon className={clsx("w-4 h-4", s.color)} />
          </div>
          <div className={clsx("text-2xl font-bold", s.color)}>{s.value}</div>
          <div className="text-xs dark:text-slate-500 text-slate-400">{s.sub}</div>
        </div>
      ))}
      {hasLive && (
        <div className={clsx(
          "rounded-xl border p-4 space-y-2",
          unrealized >= 0 ? "dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200" : "dark:bg-red-500/10 bg-red-50 dark:border-red-500/20 border-red-200"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Unrealized P&L</span>
            <Activity className={clsx("w-4 h-4", unrealized >= 0 ? "text-emerald-400" : "text-red-400")} />
          </div>
          <div className={clsx("text-2xl font-bold flex items-center gap-2", unrealized >= 0 ? "text-emerald-400" : "text-red-400")}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
          </div>
          <div className="text-xs dark:text-slate-500 text-slate-400">{openTrades.length} open position{openTrades.length !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}
