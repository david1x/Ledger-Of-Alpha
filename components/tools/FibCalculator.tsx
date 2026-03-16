"use client";
import { useState, useMemo } from "react";
import { fibonacciLevels } from "@/lib/calculators";
import { Copy, Check } from "lucide-react";

export default function FibCalculator() {
  const [high, setHigh] = useState(100);
  const [low, setLow] = useState(80);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const levels = useMemo(() => {
    if (high <= low) return [];
    return fibonacciLevels(high, low);
  }, [high, low]);

  const handleCopy = async (label: string, price: number) => {
    try {
      await navigator.clipboard.writeText(price.toFixed(2));
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 1500);
    } catch {
      // silent — clipboard may be blocked
    }
  };

  const retracements = levels.filter(l => !l.isExtension);
  const extensions = levels.filter(l => l.isExtension);

  return (
    <div>
      <h2 className="text-lg font-semibold dark:text-white text-slate-900 mb-1">
        Fibonacci Levels Calculator
      </h2>
      <p className="text-sm dark:text-slate-400 text-slate-500 mb-6">
        Calculate retracement and extension levels from a swing high and low. Click any price to copy.
      </p>

      {/* Inputs */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
            Swing High
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={high}
            onChange={e => setHigh(parseFloat(e.target.value) || 0)}
            className="w-40 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium dark:text-slate-300 text-slate-700 mb-2">
            Swing Low
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={low}
            onChange={e => setLow(parseFloat(e.target.value) || 0)}
            className="w-40 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
      </div>

      {high <= low && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          Swing high must be greater than swing low.
        </div>
      )}

      {levels.length > 0 && (
        <div className="rounded-xl overflow-hidden border dark:border-slate-700 border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="dark:bg-slate-800 bg-slate-100">
                <th className="text-left px-4 py-2.5 font-medium dark:text-slate-400 text-slate-500">Level</th>
                <th className="text-left px-4 py-2.5 font-medium dark:text-slate-400 text-slate-500">Price</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {/* Retracements */}
              {retracements.map((level) => (
                <tr
                  key={level.label}
                  className="border-t dark:border-slate-800 border-slate-100 dark:hover:bg-slate-800/40 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-sky-400">{level.label}</td>
                  <td className="px-4 py-2.5 dark:text-slate-300 text-slate-700 font-mono">
                    {level.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleCopy(level.label, level.price)}
                      className="p-1.5 rounded-lg dark:hover:bg-slate-700 hover:bg-slate-200 transition-colors"
                      title="Copy price"
                    >
                      {copiedLabel === level.label
                        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                        : <Copy className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />}
                    </button>
                  </td>
                </tr>
              ))}

              {/* Separator */}
              <tr>
                <td colSpan={3} className="px-4 py-1">
                  <div className="border-t-2 dark:border-slate-700 border-slate-200 border-dashed" />
                  <div className="text-[10px] dark:text-slate-600 text-slate-400 pt-1 uppercase tracking-widest font-semibold">
                    Extensions
                  </div>
                </td>
              </tr>

              {/* Extensions */}
              {extensions.map((level) => (
                <tr
                  key={level.label}
                  className="border-t dark:border-slate-800 border-slate-100 dark:hover:bg-slate-800/40 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-violet-400">{level.label}</td>
                  <td className="px-4 py-2.5 dark:text-slate-300 text-slate-700 font-mono">
                    {level.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleCopy(level.label, level.price)}
                      className="p-1.5 rounded-lg dark:hover:bg-slate-700 hover:bg-slate-200 transition-colors"
                      title="Copy price"
                    >
                      {copiedLabel === level.label
                        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                        : <Copy className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
