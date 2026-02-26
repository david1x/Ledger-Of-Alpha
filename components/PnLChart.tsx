"use client";
import { Trade } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { useMemo } from "react";

interface Props {
  trades: Trade[];
}

export default function PnLChart({ trades }: Props) {
  const data = useMemo(() => {
    const closed = trades
      .filter((t) => t.status === "closed" && t.pnl !== null)
      .sort((a, b) => (a.exit_date ?? a.created_at).localeCompare(b.exit_date ?? b.created_at));

    let cumulative = 0;
    return closed.map((t, i) => {
      cumulative += t.pnl ?? 0;
      return {
        index: i + 1,
        label: t.symbol,
        pnl: t.pnl ?? 0,
        cumulative: parseFloat(cumulative.toFixed(2)),
        date: t.exit_date ?? t.created_at.slice(0, 10),
      };
    });
  }, [trades]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-8 text-center">
        <p className="dark:text-slate-500 text-slate-400 text-sm">No closed trades yet. Close a trade to see your P&L curve.</p>
      </div>
    );
  }

  const isProfit = data[data.length - 1]?.cumulative >= 0;
  const color = isProfit ? "#22c55e" : "#ef4444";

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-white p-4">
      <h3 className="text-sm font-semibold dark:text-white text-slate-900 mb-4">Cumulative P&L</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Trade #", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#f1f5f9",
            }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name === "cumulative" ? "Cumulative P&L" : "Trade P&L",
            ]}
            labelFormatter={(label, payload) =>
              payload?.[0] ? `Trade #${label} — ${payload[0].payload.label} (${payload[0].payload.date})` : `Trade #${label}`
            }
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={color}
            strokeWidth={2}
            fill="url(#pnlGrad)"
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
