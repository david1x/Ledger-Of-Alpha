"use client";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Cell,
} from "recharts";

export const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};
export const GRID_STROKE = "#1e293b";
export const TICK = { fontSize: 11, fill: "#64748b" };

interface AreaChartWidgetProps {
  data: { index: number; value: number; label?: string; date?: string }[];
  color: string;
  gradientId: string;
  valuePrefix?: string;
  valueSuffix?: string;
  yDomain?: [number, number];
  referenceLine?: number;
}

export function AreaChartWidget({
  data, color, gradientId, valuePrefix = "$", valueSuffix = "",
  yDomain, referenceLine = 0,
}: AreaChartWidgetProps) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="index" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${valuePrefix}${v}${valueSuffix}`}
          domain={yDomain}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }}
          formatter={(value: number) => [`${valuePrefix}${value.toFixed(2)}${valueSuffix}`, "Value"]}
          labelFormatter={(label, payload) =>
            payload?.[0]?.payload?.label
              ? `#${label} - ${payload[0].payload.label}${payload[0].payload.date ? ` (${payload[0].payload.date})` : ""}`
              : `#${label}`
          }
        />
        {referenceLine !== undefined && (
          <ReferenceLine y={referenceLine} stroke="#475569" strokeDasharray="4 4" />
        )}
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BarChartWidgetProps {
  data: { date: string; value: number }[];
}

export function BarChartWidget({ data }: BarChartWidgetProps) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(148,163,184,0.1)" }}
          formatter={(value: number) => [value, "Trades"]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value > 0 ? "#3b82f6" : "#475569"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[160px]">
      <p className="text-xs dark:text-slate-500 text-slate-400">No data</p>
    </div>
  );
}
