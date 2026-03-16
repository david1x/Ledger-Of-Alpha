"use client";
import { useState, useMemo } from "react";
import { drawdownRecovery } from "@/lib/calculators";

const COMMON_DRAWDOWNS = [5, 10, 20, 25, 30, 50, 75];

export default function DrawdownCalculator() {
  const [drawdownPct, setDrawdownPct] = useState(20);

  const recovery = useMemo(() => drawdownRecovery(drawdownPct), [drawdownPct]);

  const displayRecovery =
    recovery === Infinity
      ? "Unrecoverable (100% loss)"
      : `${recovery.toFixed(2)}%`;

  return (
    <div>
      <h2 className="text-lg font-semibold dark:text-white text-slate-900 mb-1">
        Drawdown Recovery Calculator
      </h2>
      <p className="text-sm dark:text-slate-400 text-slate-500 mb-6">
        Shows how much gain is required to fully recover from a given drawdown.
      </p>

      {/* Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
          Drawdown %
        </label>
        <input
          type="number"
          min={0}
          max={99.99}
          step={0.1}
          value={drawdownPct}
          onChange={e => setDrawdownPct(parseFloat(e.target.value) || 0)}
          className="w-48 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
        />
      </div>

      {/* Result */}
      <div className="mb-8 p-5 rounded-xl dark:bg-slate-800/60 bg-slate-50 border dark:border-slate-700 border-slate-200">
        <div className="text-sm dark:text-slate-400 text-slate-500 mb-1">Required recovery gain</div>
        <div className="text-3xl font-bold text-emerald-400">{displayRecovery}</div>
        {drawdownPct > 0 && drawdownPct < 100 && (
          <div className="text-xs dark:text-slate-500 text-slate-400 mt-2">
            A {drawdownPct}% loss requires a {recovery.toFixed(2)}% gain to break even.
          </div>
        )}
      </div>

      {/* Reference table */}
      <div>
        <h3 className="text-sm font-semibold dark:text-slate-300 text-slate-700 mb-3">
          Common Drawdown Reference
        </h3>
        <div className="rounded-xl overflow-hidden border dark:border-slate-700 border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="dark:bg-slate-800 bg-slate-100">
                <th className="text-left px-4 py-2.5 font-medium dark:text-slate-400 text-slate-500">Drawdown</th>
                <th className="text-left px-4 py-2.5 font-medium dark:text-slate-400 text-slate-500">Required Recovery</th>
              </tr>
            </thead>
            <tbody>
              {COMMON_DRAWDOWNS.map((val) => {
                const rec = drawdownRecovery(val);
                const isMatch = drawdownPct === val;
                return (
                  <tr
                    key={val}
                    className={
                      isMatch
                        ? "bg-emerald-500/10 border-l-2 border-emerald-400"
                        : "dark:border-t dark:border-slate-800 border-t border-slate-100"
                    }
                  >
                    <td className="px-4 py-2.5 dark:text-slate-300 text-slate-700 font-medium">
                      {isMatch && (
                        <span className="text-emerald-400 mr-1.5 font-bold">&#8594;</span>
                      )}
                      {val}%
                    </td>
                    <td className="px-4 py-2.5 dark:text-slate-300 text-slate-700">
                      {rec.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
