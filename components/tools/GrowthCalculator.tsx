"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TOOLTIP_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_ITEM_STYLE,
  GRID_STROKE,
  TICK,
} from "@/components/dashboard/ChartWidgets";
import { compoundGrowthCurve } from "@/lib/calculators";

export default function GrowthCalculator() {
  const [startBalance, setStartBalance] = useState(10000);
  const [monthlyReturn, setMonthlyReturn] = useState(5);
  const [months, setMonths] = useState(12);

  const data = useMemo(
    () => compoundGrowthCurve(startBalance, monthlyReturn, Math.max(1, Math.min(360, months))),
    [startBalance, monthlyReturn, months]
  );

  const finalBalance = data.length > 0 ? data[data.length - 1].balance : startBalance;
  const totalGain = finalBalance - startBalance;
  const totalGainPct = startBalance > 0 ? (totalGain / startBalance) * 100 : 0;

  // Format Y axis ticks
  function formatYAxis(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Starting Balance</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-slate-400 text-sm pointer-events-none">$</span>
            <input
              type="number"
              value={startBalance}
              step={100}
              min={1}
              onChange={(e) => setStartBalance(parseFloat(e.target.value) || 0)}
              className="w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 rounded-lg py-2 pl-7 pr-3 text-sm dark:text-slate-100 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Monthly Return</label>
          <div className="relative flex items-center">
            <input
              type="number"
              value={monthlyReturn}
              step={0.1}
              onChange={(e) => setMonthlyReturn(parseFloat(e.target.value) || 0)}
              className="w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 rounded-lg py-2 pl-3 pr-7 text-sm dark:text-slate-100 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute right-3 text-slate-400 text-sm pointer-events-none">%</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Period (months)</label>
          <input
            type="number"
            value={months}
            step={1}
            min={1}
            max={360}
            onChange={(e) =>
              setMonths(Math.max(1, Math.min(360, parseInt(e.target.value) || 1)))
            }
            className="w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 rounded-lg py-2 px-3 text-sm dark:text-slate-100 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Area Chart */}
      <div className="dark:bg-slate-800/30 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 16, bottom: 0, left: 10 }}
          >
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={GRID_STROKE}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `Mo ${v}`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYAxis}
              width={60}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
              labelFormatter={(label) => `Month ${label}`}
              formatter={(value: number) => [
                `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                "Balance",
              ]}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#growthGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Final Balance</p>
          <p className="text-lg font-bold text-emerald-400">
            ${finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Gain</p>
          <p className={`text-lg font-bold ${totalGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalGain >= 0 ? "+" : ""}$
            {Math.abs(totalGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Gain %</p>
          <p className={`text-lg font-bold ${totalGainPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
