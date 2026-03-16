"use client";
import { useState, useEffect, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";
import { sampleCorrelation } from "simple-statistics";
import SymbolSearch from "@/components/SymbolSearch";

const MAX_SYMBOLS = 10;

const PERIOD_OPTIONS = ["1D", "5D", "30D", "60D", "90D", "180D", "YTD", "365D"] as const;
type Period = typeof PERIOD_OPTIONS[number];

const PERIOD_TO_RANGE: Record<Period, string> = {
  "1D": "1d",
  "5D": "5d",
  "30D": "1mo",
  "60D": "3mo",
  "90D": "3mo",
  "180D": "1y",
  "YTD": "1y",
  "365D": "1y",
};

interface Bar {
  time: number;
  close: number;
}

interface ProgressState {
  current: number;
  total: number;
  symbol: string;
}

function getCorrelationColor(val: number): string {
  if (val >= 0) {
    // emerald-500: rgb(16,185,129)
    return `rgba(16,185,129,${(val * 0.65).toFixed(2)})`;
  } else {
    // red-500: rgb(239,68,68)
    return `rgba(239,68,68,${(Math.abs(val) * 0.65).toFixed(2)})`;
  }
}

function getJan1Timestamp(): number {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).getTime() / 1000;
}

export default function CorrelationMatrix() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [errorSymbols, setErrorSymbols] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>("90D");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [matrix, setMatrix] = useState<(number | null)[][] | null>(null);
  const [matrixSymbols, setMatrixSymbols] = useState<string[]>([]);
  const abortRef = useRef(false);

  // On mount: fetch user's trade history to pre-populate symbols
  useEffect(() => {
    async function prefill() {
      try {
        const res = await fetch("/api/trades?status=closed");
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        // Count frequency
        const freq: Record<string, number> = {};
        for (const trade of data) {
          if (trade.symbol) {
            freq[trade.symbol] = (freq[trade.symbol] ?? 0) + 1;
          }
        }
        const sorted = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sym]) => sym);
        if (sorted.length > 0) {
          setSymbols(sorted);
        }
      } catch {
        // graceful — start with empty
      }
    }
    prefill();
  }, []);

  function addSymbol(sym: string) {
    const upper = sym.toUpperCase().trim();
    if (!upper) return;
    if (symbols.includes(upper)) {
      setSearchValue("");
      return;
    }
    if (symbols.length >= MAX_SYMBOLS) return;
    setSymbols((prev) => [...prev, upper]);
    setSearchValue("");
    // Clear matrix when symbols change
    setMatrix(null);
  }

  function removeSymbol(sym: string) {
    setSymbols((prev) => prev.filter((s) => s !== sym));
    setMatrix(null);
  }

  async function calculate() {
    if (symbols.length < 2) return;
    setLoading(true);
    setProgress(null);
    setMatrix(null);
    setErrorSymbols(new Set());
    abortRef.current = false;

    const range = PERIOD_TO_RANGE[period];
    const seriesMap: Record<string, Bar[]> = {};
    const newErrors = new Set<string>();

    for (let i = 0; i < symbols.length; i++) {
      if (abortRef.current) break;
      const sym = symbols[i];
      setProgress({ current: i + 1, total: symbols.length, symbol: sym });

      try {
        const res = await fetch(
          `/api/ohlcv?symbol=${encodeURIComponent(sym)}&interval=1d&range=${range}`
        );
        if (!res.ok) throw new Error("fetch failed");
        let bars: Bar[] = await res.json();
        if (!Array.isArray(bars) || bars.length === 0) throw new Error("no data");

        // YTD filter: only bars from Jan 1 of current year
        if (period === "YTD") {
          const jan1 = getJan1Timestamp();
          bars = bars.filter((b) => b.time >= jan1);
        }

        if (bars.length < 2) throw new Error("insufficient data");
        seriesMap[sym] = bars;
      } catch {
        newErrors.add(sym);
      }
    }

    setErrorSymbols(newErrors);

    // Build list of symbols that successfully fetched
    const valid = symbols.filter((s) => !newErrors.has(s));

    if (valid.length < 2) {
      setLoading(false);
      setProgress(null);
      setMatrix(null);
      return;
    }

    // Compute NxN matrix
    const n = valid.length;
    const result: (number | null)[][] = Array.from({ length: n }, () =>
      new Array(n).fill(null)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          result[i][j] = 1.0;
          continue;
        }
        const seriesA = seriesMap[valid[i]];
        const seriesB = seriesMap[valid[j]];

        // Align by common timestamps
        const bMap = new Map<number, number>();
        for (const bar of seriesB) bMap.set(bar.time, bar.close);

        const alignedA: number[] = [];
        const alignedB: number[] = [];
        for (const bar of seriesA) {
          const bVal = bMap.get(bar.time);
          if (bVal !== undefined) {
            alignedA.push(bar.close);
            alignedB.push(bVal);
          }
        }

        if (alignedA.length < 2) {
          result[i][j] = null; // N/A
        } else {
          try {
            result[i][j] = sampleCorrelation(alignedA, alignedB);
          } catch {
            result[i][j] = null;
          }
        }
      }
    }

    setMatrix(result);
    setMatrixSymbols(valid);
    setLoading(false);
    setProgress(null);
  }

  const atLimit = symbols.length >= MAX_SYMBOLS;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold dark:text-white text-slate-900 mb-1">
          Correlation Matrix
        </h2>
        <p className="text-sm dark:text-slate-400 text-slate-500">
          Compare Pearson correlation between multiple symbols using daily closes.
        </p>
      </div>

      {/* Symbol selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide dark:text-slate-400 text-slate-500">
          Symbols
        </label>

        {/* Chips */}
        {symbols.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {symbols.map((sym) => (
              <span
                key={sym}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  errorSymbols.has(sym)
                    ? "dark:bg-red-900/30 bg-red-50 dark:border-red-700 border-red-300 dark:text-red-300 text-red-700"
                    : "dark:bg-slate-700 bg-slate-100 dark:border-slate-600 border-slate-300 dark:text-white text-slate-800"
                }`}
              >
                {errorSymbols.has(sym) && (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {sym}
                <button
                  onClick={() => removeSymbol(sym)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${sym}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        {atLimit ? (
          <p className="text-xs dark:text-slate-500 text-slate-400 italic">
            Maximum {MAX_SYMBOLS} symbols reached.
          </p>
        ) : (
          <div className="max-w-xs">
            <SymbolSearch
              value={searchValue}
              onChange={setSearchValue}
              onSelectFull={({ symbol }) => addSymbol(symbol)}
              placeholder="Add symbol..."
            />
          </div>
        )}
      </div>

      {/* Period + Calculate */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide dark:text-slate-400 text-slate-500">
            Time Period
          </label>
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as Period);
              setMatrix(null);
            }}
            className="px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={calculate}
          disabled={symbols.length < 2 || loading}
          className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {/* Progress bar */}
      {loading && progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs dark:text-slate-400 text-slate-500">
            <span>
              Fetching {progress.symbol} ({progress.current}/{progress.total})
            </span>
            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full dark:bg-slate-700 bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {symbols.length < 2 && !loading && (
        <p className="text-sm dark:text-slate-500 text-slate-400 italic">
          Add at least 2 symbols to calculate correlations.
        </p>
      )}

      {/* Matrix */}
      {matrix && matrixSymbols.length >= 2 && (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                {/* top-left empty cell */}
                <th className="p-0 w-12" />
                {matrixSymbols.map((sym) => (
                  <th
                    key={sym}
                    className={`px-2 py-1 text-center font-medium dark:text-slate-300 text-slate-600 ${
                      matrixSymbols.length > 5 ? "w-16" : "w-20"
                    }`}
                  >
                    {matrixSymbols.length > 5 ? (
                      <span
                        style={{
                          display: "inline-block",
                          transform: "rotate(-45deg)",
                          transformOrigin: "center",
                          whiteSpace: "nowrap",
                          fontSize: "0.7rem",
                        }}
                      >
                        {sym}
                      </span>
                    ) : (
                      sym
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixSymbols.map((rowSym, i) => (
                <tr key={rowSym}>
                  <td className="pr-3 py-1 text-right font-medium dark:text-slate-300 text-slate-600 text-xs whitespace-nowrap">
                    {rowSym}
                  </td>
                  {matrixSymbols.map((_, j) => {
                    const val = matrix[i][j];
                    const isDiag = i === j;

                    if (isDiag) {
                      return (
                        <td
                          key={j}
                          className="text-center px-2 py-2 rounded dark:bg-slate-700 bg-slate-200 font-bold dark:text-slate-300 text-slate-600"
                          style={{ minWidth: "3rem" }}
                        >
                          1.00
                        </td>
                      );
                    }

                    if (val === null) {
                      return (
                        <td
                          key={j}
                          className="text-center px-2 py-2 dark:text-slate-500 text-slate-400 text-xs"
                          style={{ minWidth: "3rem" }}
                        >
                          N/A
                        </td>
                      );
                    }

                    return (
                      <td
                        key={j}
                        className="text-center px-2 py-2 font-medium dark:text-white text-slate-900 transition-colors"
                        style={{
                          backgroundColor: getCorrelationColor(val),
                          minWidth: "3rem",
                        }}
                      >
                        {val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {matrix && matrixSymbols.length >= 2 && (
        <div className="flex items-center gap-3 text-xs dark:text-slate-400 text-slate-500 mt-1">
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: "rgba(239,68,68,0.65)" }}
            />
            <span>Strong negative</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded dark:bg-slate-700 bg-slate-200" />
            <span>Diagonal (self)</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: "rgba(16,185,129,0.65)" }}
            />
            <span>Strong positive</span>
          </div>
        </div>
      )}
    </div>
  );
}
