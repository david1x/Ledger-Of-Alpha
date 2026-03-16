"use client";
import { useState, useMemo } from "react";
import { kellyFraction } from "@/lib/calculators";

export default function KellyCalculator() {
  const [winRate, setWinRate] = useState(55);
  const [avgWin, setAvgWin] = useState(200);
  const [avgLoss, setAvgLoss] = useState(100);

  const fullKelly = useMemo(
    () => kellyFraction(winRate, avgWin, avgLoss),
    [winRate, avgWin, avgLoss]
  );

  const halfKelly = fullKelly / 2;
  const quarterKelly = fullKelly / 4;

  const isNegativeEdge = fullKelly <= 0;
  const isHighKelly = fullKelly > 25;

  return (
    <div>
      <h2 className="text-lg font-semibold dark:text-white text-slate-900 mb-1">
        Kelly Criterion Calculator
      </h2>
      <p className="text-sm dark:text-slate-400 text-slate-500 mb-6">
        Calculates the optimal position size as a percentage of your account based on your edge.
      </p>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
            Win Rate %
          </label>
          <input
            type="number"
            min={0.1}
            max={99.9}
            step={0.1}
            value={winRate}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0 && v < 100) setWinRate(v);
            }}
            className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
            Average Win $
          </label>
          <input
            type="number"
            min={0.01}
            step={1}
            value={avgWin}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setAvgWin(v);
            }}
            className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
            Average Loss $
          </label>
          <input
            type="number"
            min={0.01}
            step={1}
            value={avgLoss}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setAvgLoss(v);
            }}
            className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
      </div>

      {/* Warnings */}
      {isNegativeEdge && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          Negative edge — no position recommended
        </div>
      )}
      {!isNegativeEdge && isHighKelly && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          High Kelly — consider using fractional Kelly to reduce volatility of returns
        </div>
      )}

      {/* Results */}
      {!isNegativeEdge && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl dark:bg-slate-800/60 bg-slate-50 border dark:border-slate-700 border-slate-200">
            <div className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-2">
              Full Kelly
            </div>
            <div className="text-2xl font-bold text-emerald-400">{fullKelly.toFixed(2)}%</div>
            <div className="text-xs dark:text-slate-500 text-slate-400 mt-1">Mathematically optimal</div>
          </div>
          <div className="p-5 rounded-xl dark:bg-slate-800/60 bg-slate-50 border dark:border-slate-700 border-slate-200">
            <div className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-2">
              Half Kelly
            </div>
            <div className="text-2xl font-bold dark:text-sky-400 text-sky-500">{halfKelly.toFixed(2)}%</div>
            <div className="text-xs dark:text-slate-500 text-slate-400 mt-1">Recommended for most traders</div>
          </div>
          <div className="p-5 rounded-xl dark:bg-slate-800/60 bg-slate-50 border dark:border-slate-700 border-slate-200">
            <div className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-2">
              Quarter Kelly
            </div>
            <div className="text-2xl font-bold dark:text-violet-400 text-violet-500">{quarterKelly.toFixed(2)}%</div>
            <div className="text-xs dark:text-slate-500 text-slate-400 mt-1">Conservative / high uncertainty</div>
          </div>
        </div>
      )}

      {/* Formula note */}
      <div className="mt-6 text-xs dark:text-slate-600 text-slate-400">
        Formula: f = (b &times; p &minus; q) / b &nbsp;&nbsp;where b = win/loss ratio, p = win rate, q = 1 &minus; p
      </div>
    </div>
  );
}
