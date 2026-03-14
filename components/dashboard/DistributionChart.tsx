"use client";

import { useMemo } from "react";
import { Trade } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, GRID_STROKE, TICK } from "./ChartWidgets";

type DistributionType = "weekday" | "hour" | "month";

interface Props {
  trades: Trade[];
  type: DistributionType;
  title: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DistributionChart({ trades, type, title }: Props) {
  const chartData = useMemo(() => {
    const closed = trades.filter(t => t.status === "closed" && t.pnl != null);
    
    if (type === "weekday") {
      const map = new Map<number, { name: string, pnl: number, count: number }>();
      // Initialize Mon-Fri (usually no trades on weekends for most markets)
      for (let i = 1; i <= 5; i++) {
        map.set(i, { name: DAYS[i], pnl: 0, count: 0 });
      }

      for (const t of closed) {
        const date = new Date(t.exit_date ?? t.created_at);
        const day = date.getDay();
        const existing = map.get(day) || { name: DAYS[day], pnl: 0, count: 0 };
        map.set(day, {
          ...existing,
          pnl: existing.pnl + (t.pnl ?? 0),
          count: existing.count + 1
        });
      }
      return Array.from(map.values());
    }

    if (type === "hour") {
      const map = new Map<number, { name: string, pnl: number, count: number }>();
      for (let i = 0; i < 24; i++) {
        map.set(i, { name: `${i}h`, pnl: 0, count: 0 });
      }

      for (const t of closed) {
        const date = new Date(t.exit_date ?? t.created_at);
        const hour = date.getHours();
        const existing = map.get(hour)!;
        map.set(hour, {
          ...existing,
          pnl: existing.pnl + (t.pnl ?? 0),
          count: existing.count + 1
        });
      }
      // Only show hours with activity or a standard range (e.g., 8-18)
      return Array.from(map.values()).filter(d => d.count > 0 || (Number(d.name.replace("h", "")) >= 8 && Number(d.name.replace("h", "")) <= 17));
    }

    if (type === "month") {
      const map = new Map<number, { name: string, pnl: number, count: number }>();
      for (let i = 0; i < 12; i++) {
        map.set(i, { name: MONTHS[i], pnl: 0, count: 0 });
      }

      for (const t of closed) {
        const date = new Date(t.exit_date ?? t.created_at);
        const month = date.getMonth();
        const existing = map.get(month)!;
        map.set(month, {
          ...existing,
          pnl: existing.pnl + (t.pnl ?? 0),
          count: existing.count + 1
        });
      }
      return Array.from(map.values());
    }

    return [];
  }, [trades, type]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">{title}</h3>
      </div>
      <div className="flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
            <Bar dataKey="pnl">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
