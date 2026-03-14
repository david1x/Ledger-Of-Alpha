"use client";

import { useMemo } from "react";
import { Trade, TradeStrategy } from "@/lib/types";
import clsx from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, GRID_STROKE, TICK } from "./ChartWidgets";

interface Props {
  trades?: Trade[];
  strategies?: TradeStrategy[];
  leftLabel?: string;
  leftValue?: string;
  leftColor?: string;
  rightLabel?: string;
  rightValue?: string;
  rightColor?: string;
}

export default function ComparisonWidget({ 
  trades, 
  strategies,
  leftLabel,
  leftValue,
  leftColor,
  rightLabel,
  rightValue,
  rightColor
}: Props) {
  const strategyData = useMemo(() => {
    if (!trades || !strategies) return [];
    const closed = trades.filter(t => t.status === "closed" && t.pnl != null);
    
    interface Agg {
      name: string;
      pnl: number;
      count: number;
      wins: number;
      losses: number;
      grossProfit: number;
      grossLoss: number;
    }
    const statsMap = new Map<string, Agg>();

    // Group by strategy_id
    for (const t of closed) {
      const sid = t.strategy_id || "unassigned";
      const sname = strategies.find(s => s.id === sid)?.name || "No Strategy";
      
      const existing = statsMap.get(sid) || { 
        name: sname, pnl: 0, count: 0, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0 
      };
      
      const pnl = t.pnl ?? 0;
      const isWin = pnl > 0;
      
      statsMap.set(sid, {
        ...existing,
        pnl: existing.pnl + pnl,
        count: existing.count + 1,
        wins: existing.wins + (isWin ? 1 : 0),
        losses: existing.losses + (isWin ? 0 : 1),
        grossProfit: existing.grossProfit + (pnl > 0 ? pnl : 0),
        grossLoss: existing.grossLoss + (pnl < 0 ? Math.abs(pnl) : 0)
      });
    }

    return Array.from(statsMap.values()).map(s => ({
      name: s.name,
      pnl: parseFloat(s.pnl.toFixed(2)),
      winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
      profitFactor: s.grossLoss > 0 ? parseFloat((s.grossProfit / s.grossLoss).toFixed(2)) : s.grossProfit > 0 ? 100 : 0,
      count: s.count
    })).sort((a, b) => b.pnl - a.pnl);
  }, [trades, strategies]);

  if (!trades && leftLabel) {
    return (
      <div className="flex h-full items-center justify-between px-1 sm:px-2 gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 truncate">{leftLabel}</p>
          <p className={clsx("text-base sm:text-lg font-black truncate tabular-nums", leftColor)}>{leftValue}</p>
        </div>
        <div className="w-px h-8 dark:bg-slate-700 bg-slate-200 shrink-0" />
        <div className="flex flex-col text-right min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 truncate">{rightLabel}</p>
          <p className={clsx("text-base sm:text-lg font-black truncate tabular-nums", rightColor)}>{rightValue}</p>
        </div>
      </div>
    );
  }

  if (strategyData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400 italic">
        No strategy data yet
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400">Performance by Strategy</h3>
      </div>
      <div className="flex-1 min-h-[180px] sm:min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={strategyData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={70} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: any, name: string) => {
                if (name === "pnl") return [`$${value.toFixed(2)}`, "Net P&L"];
                if (name === "winRate") return [`${value.toFixed(1)}%`, "Win Rate"];
                if (name === "profitFactor") return [value, "Profit Factor"];
                return [value, name];
              }}
            />
            <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" />
            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
              {strategyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {strategyData.slice(0, 2).map(s => (
          <div key={s.name} className="dark:bg-slate-900/80 bg-slate-50 p-3 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-sm transition-all hover:dark:bg-slate-800/80">
            <p className="text-[10px] font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 truncate mb-1">{s.name}</p>
            <div className="flex justify-between items-end">
              <p className={clsx("text-base font-black tabular-nums leading-none", s.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                ${s.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <div className="text-right">
                <p className="text-[10px] font-bold dark:text-slate-300 text-slate-700 leading-none">{s.winRate.toFixed(0)}% WR</p>
                <p className="text-[9px] dark:text-slate-500 text-slate-400 font-medium mt-0.5">PF: {s.profitFactor}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
