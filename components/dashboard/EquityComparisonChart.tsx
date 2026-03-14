"use client";
import { useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { TOOLTIP_STYLE, GRID_STROKE, TICK } from "./ChartWidgets";
import { Trade } from "@/lib/types";

interface EquityComparisonChartProps {
  trades: Trade[];
  accountSize: number;
}

export function EquityComparisonChart({ trades, accountSize }: EquityComparisonChartProps) {
  const data = useMemo(() => {
    const closed = trades
      .filter(t => t.status === "closed" && t.pnl != null)
      .sort((a, b) => (a.exit_date ?? a.created_at).localeCompare(b.exit_date ?? b.created_at));

    let cumulativePnl = 0;
    return closed.map((t, i) => {
      cumulativePnl += t.pnl ?? 0;
      const balance = accountSize + cumulativePnl;
      const exitDate = t.exit_date ?? t.created_at.slice(0, 10);

      // Calculate open risk at this point in time
      // Open risk = trades entered before or on exitDate, but closed AFTER exitDate (or still open)
      const openAtThatTime = trades.filter(ot => {
        const entryDate = ot.entry_date ?? ot.created_at.slice(0, 10);
        const otExitDate = ot.exit_date ?? "9999-12-31";
        const isClosedLater = ot.status === "closed" ? otExitDate > exitDate : true;
        return entryDate <= exitDate && isClosedLater;
      });

      const openRisk = openAtThatTime.reduce((sum, ot) => {
        if (ot.entry_price != null && ot.stop_loss != null && ot.shares != null) {
          return sum + Math.abs(ot.entry_price - ot.stop_loss) * ot.shares;
        }
        return sum;
      }, 0);

      return {
        index: i + 1,
        date: exitDate,
        symbol: t.symbol,
        balance: parseFloat(balance.toFixed(2)),
        equity: parseFloat((balance - openRisk).toFixed(2)),
      };
    });
  }, [trades, accountSize]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[140px]">
        <p className="text-xs dark:text-slate-500 text-slate-400">No data</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="index" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: "#1e293b", strokeWidth: 2 }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
            labelFormatter={(_, payload) => {
              if (!payload?.[0]) return "";
              const { date, symbol } = payload[0].payload;
              return `${date} - ${symbol}`;
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="#10b981"
            fill="url(#balanceGrad)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="equity"
            name="Equity (Floor)"
            stroke="#3b82f6"
            fill="url(#equityGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
