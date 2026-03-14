"use client";

import { useMemo, useState } from "react";
import { Trade } from "@/lib/types";
import { runMonteCarlo, SimulationResult } from "@/lib/simulation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Info, AlertTriangle, TrendingUp, Shield } from "lucide-react";

interface Props {
  trades: Trade[];
  startingBalance: number;
}

export default function RiskSimulator({ trades, startingBalance }: Props) {
  const [numTrades, setNumTrades] = useState(100);
  const [ruinThreshold, setRuinThreshold] = useState(50); // percentage

  const returns = useMemo(() => {
    return trades
      .filter(t => t.status === "closed" && t.pnl != null && (t.account_size || startingBalance) > 0)
      .map(t => (t.pnl ?? 0) / (t.account_size ?? startingBalance));
  }, [trades, startingBalance]);

  const simResult = useMemo(() => {
    return runMonteCarlo(returns, startingBalance, numTrades, 5000, ruinThreshold / 100);
  }, [returns, startingBalance, numTrades, ruinThreshold]);

  if (returns.length < 5) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-4">
        <Info className="w-8 h-8 dark:text-slate-600 text-slate-400 mb-2" />
        <p className="text-sm dark:text-slate-500 text-slate-400">
          Need at least 5 closed trades to run simulation.
        </p>
      </div>
    );
  }

  // Format paths for Recharts
  // paths is number[50][numTrades + 1]
  const chartData = Array.from({ length: numTrades + 1 }, (_, i) => {
    const dataPoint: any = { name: i };
    simResult.paths.forEach((path, pathIdx) => {
      dataPoint[`path${pathIdx}`] = path[i];
    });
    return dataPoint;
  });

  const isHealthy = simResult.probOfRuin < 5;
  const isWarning = simResult.probOfRuin >= 5 && simResult.probOfRuin < 20;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Controls & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold dark:text-slate-500 text-slate-400 block mb-1">
              Simulation Horizon
            </label>
            <select 
              value={numTrades} 
              onChange={(e) => setNumTrades(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded px-2 py-1 text-xs dark:text-slate-200 text-slate-900"
            >
              <option value={50} className="dark:bg-slate-800">Next 50 Trades</option>
              <option value={100} className="dark:bg-slate-800">Next 100 Trades</option>
              <option value={250} className="dark:bg-slate-800">Next 250 Trades</option>
              <option value={500} className="dark:bg-slate-800">Next 500 Trades</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold dark:text-slate-500 text-slate-400 block mb-1">
              Ruin Threshold ({ruinThreshold}%)
            </label>
            <input 
              type="range" 
              min="10" max="100" step="5"
              value={ruinThreshold}
              onChange={(e) => setRuinThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div className="p-3 rounded-lg dark:bg-slate-900/50 bg-slate-50 border dark:border-slate-800 border-slate-100">
             <div className="flex items-center gap-2 mb-1">
               {isHealthy ? <Shield className="w-4 h-4 text-emerald-400" /> : isWarning ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
               <span className="text-xs font-bold dark:text-white text-slate-900">Ruin Probability</span>
             </div>
             <div className={`text-2xl font-black ${isHealthy ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400"}`}>
               {simResult.probOfRuin.toFixed(1)}%
             </div>
             <p className="text-[10px] dark:text-slate-500 text-slate-400 mt-1">
               Chance of hitting {ruinThreshold}% drawdown
             </p>
          </div>
        </div>

        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg dark:bg-slate-900/50 bg-slate-50 border dark:border-slate-800 border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold dark:text-white text-slate-900">Median Final</span>
            </div>
            <div className="text-lg font-bold dark:text-white text-slate-900">
              ${simResult.medianFinalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] dark:text-slate-500 text-slate-400">
              Expected balance after {numTrades} trades
            </p>
          </div>
          <div className="p-3 rounded-lg dark:bg-slate-900/50 bg-slate-50 border dark:border-slate-800 border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1 text-emerald-400">
              <span className="text-xs font-bold dark:text-white text-slate-900">Prob. Profit</span>
            </div>
            <div className="text-lg font-bold text-emerald-400">
              {simResult.probOfProfit.toFixed(1)}%
            </div>
            <p className="text-[10px] dark:text-slate-500 text-slate-400">
              Chance of being positive
            </p>
          </div>
          <div className="p-3 rounded-lg dark:bg-slate-900/50 bg-slate-50 border dark:border-slate-800 border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1 text-red-400">
              <span className="text-xs font-bold dark:text-white text-slate-900">Avg Max DD</span>
            </div>
            <div className="text-lg font-bold text-red-400">
              {(simResult.maxDrawdown * 100).toFixed(1)}%
            </div>
            <p className="text-[10px] dark:text-slate-500 text-slate-400">
              Average deepest drawdown
            </p>
          </div>

          <div className="col-span-1 sm:col-span-3 h-[200px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                <XAxis dataKey="name" hide />
                <YAxis 
                  hide 
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const values = payload.map(p => p.value as number);
                      const median = values.sort((a,b) => a-b)[Math.floor(values.length/2)];
                      return (
                        <div className="dark:bg-slate-900 bg-white p-2 border dark:border-slate-700 border-slate-200 rounded shadow-xl">
                          <p className="text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase">Trade #{payload[0].payload.name}</p>
                          <p className="text-xs font-bold dark:text-white text-slate-900">Median Path: ${median.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {simResult.paths.map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`path${i}`}
                    stroke={i === 0 ? "#22c55e" : "#22c55e"}
                    strokeWidth={1}
                    dot={false}
                    opacity={0.1}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div className="h-[120px]">
        <h4 className="text-[10px] uppercase font-bold dark:text-slate-500 text-slate-400 mb-2">Final Balance Distribution</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={simResult.distribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
            <XAxis 
              dataKey="balance" 
              fontSize={10} 
              tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              stroke="#64748b"
            />
            <YAxis hide />
            <Tooltip 
               cursor={false}
               content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="dark:bg-slate-900 bg-white p-2 border dark:border-slate-700 border-slate-200 rounded shadow-xl">
                      <p className="text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase">Balance Range: ${payload[0].payload.balance.toLocaleString()}</p>
                      <p className="text-xs font-bold dark:text-white text-slate-900">{payload[0].value} paths</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" fill="#22c55e" opacity={0.6} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
