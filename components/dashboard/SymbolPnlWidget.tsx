"use client";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import { TOOLTIP_STYLE, GRID_STROKE, TICK } from "./ChartWidgets";

interface Props {
  data: { symbol: string; pnl: number }[];
}

export default function SymbolPnlWidget({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[160px]">
        <p className="text-xs dark:text-slate-500 text-slate-400">Trade at least 2 symbols to see breakdown</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="symbol" tick={TICK} axisLine={false} tickLine={false} width={50} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
        />
        <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" />
        <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
