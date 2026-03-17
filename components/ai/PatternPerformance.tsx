"use client";
import { useState } from "react";
import { BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { Trade } from "@/lib/types";

interface Props {
  trades: Trade[];
}

interface PatternStat {
  pattern: string;
  count: number;
  wins: number;
  totalPnl: number;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}k`
    : `$${abs.toFixed(2)}`;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

export default function PatternPerformance({ trades }: Props) {
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  // Aggregate closed trades with ai_primary_pattern
  const analyzed = trades.filter(
    t => t.status === "closed" && t.pnl != null && t.ai_primary_pattern
  );

  const statsMap: Record<string, PatternStat> = {};
  for (const trade of analyzed) {
    const pattern = trade.ai_primary_pattern!;
    if (!statsMap[pattern]) {
      statsMap[pattern] = { pattern, count: 0, wins: 0, totalPnl: 0 };
    }
    statsMap[pattern].count += 1;
    statsMap[pattern].totalPnl += trade.pnl!;
    if (trade.pnl! > 0) statsMap[pattern].wins += 1;
  }

  const stats: PatternStat[] = Object.values(statsMap).sort((a, b) => b.count - a.count);

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return "text-emerald-400";
    if (winRate >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? "text-emerald-400" : "text-red-400";
  };

  const toggleExpand = (pattern: string) => {
    setExpandedPattern(prev => (prev === pattern ? null : pattern));
  };

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <BrainCircuit className="w-10 h-10 text-slate-600 dark:text-slate-500 mb-3" />
        <p className="text-sm dark:text-slate-400 text-slate-500 max-w-xs">
          No AI-analyzed trades yet. Upload and analyze chart screenshots to see pattern performance.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-slate-700/60 border-slate-200">
            <th className="text-left py-2 pr-4 font-semibold text-xs uppercase tracking-wider dark:text-slate-400 text-slate-500">
              Pattern
            </th>
            <th className="text-right py-2 px-3 font-semibold text-xs uppercase tracking-wider dark:text-slate-400 text-slate-500">
              Trades
            </th>
            <th className="text-right py-2 px-3 font-semibold text-xs uppercase tracking-wider dark:text-slate-400 text-slate-500">
              Win Rate
            </th>
            <th className="text-right py-2 pl-3 font-semibold text-xs uppercase tracking-wider dark:text-slate-400 text-slate-500">
              Avg P&amp;L
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map(({ pattern, count, wins, totalPnl }) => {
            const winRate = Math.round((wins / count) * 100);
            const avgPnl = totalPnl / count;
            const isExpanded = expandedPattern === pattern;
            const patternTrades = analyzed.filter(t => t.ai_primary_pattern === pattern);

            return (
              <>
                <tr
                  key={pattern}
                  onClick={() => toggleExpand(pattern)}
                  className="cursor-pointer border-b dark:border-slate-800/60 border-slate-100 hover:dark:bg-slate-800/40 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium dark:text-white text-slate-900 text-sm">
                        {pattern}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400 shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400 shrink-0" />
                      }
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums dark:text-slate-300 text-slate-700">
                    {count}
                  </td>
                  <td className={`py-3 px-3 text-right tabular-nums font-medium ${getWinRateColor(winRate)}`}>
                    {winRate}%
                  </td>
                  <td className={`py-3 pl-3 text-right tabular-nums font-medium ${getPnlColor(avgPnl)}`}>
                    {formatCurrency(avgPnl)}
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${pattern}-expanded`}>
                    <td colSpan={4} className="px-0 pb-3">
                      <div className="dark:bg-slate-800/40 bg-slate-50 rounded-lg p-3 mt-1 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400 mb-2">
                          Individual Trades
                        </p>
                        {patternTrades.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between text-xs dark:text-slate-300 text-slate-700 py-1 border-b dark:border-slate-700/40 border-slate-200 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium dark:text-white text-slate-900">{t.symbol}</span>
                              <span className={`text-[10px] font-medium uppercase ${t.direction === "long" ? "text-emerald-500" : "text-red-400"}`}>
                                {t.direction}
                              </span>
                              {t.exit_date && (
                                <span className="dark:text-slate-500 text-slate-400">
                                  {t.exit_date.slice(0, 10)}
                                </span>
                              )}
                            </div>
                            <span className={`tabular-nums font-medium ${getPnlColor(t.pnl!)}`}>
                              {formatCurrency(t.pnl!)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
