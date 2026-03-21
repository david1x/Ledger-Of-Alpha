"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { X, AlertTriangle, Info } from "lucide-react";
import { sampleCorrelation } from "simple-statistics";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
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

// Colors for up to 10 lines
const LINE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

function getCorrelationColor(val: number): string {
  if (val >= 0.7) return "text-emerald-400";
  if (val >= 0.3) return "dark:text-emerald-300/70 text-emerald-600";
  if (val >= -0.3) return "dark:text-slate-400 text-slate-500";
  if (val >= -0.7) return "dark:text-red-300/70 text-red-600";
  return "text-red-400";
}

function getCorrelationLabel(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 0.7) return "Strong";
  if (abs >= 0.3) return "Moderate";
  return "Weak";
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
  const [seriesData, setSeriesData] = useState<Record<string, Bar[]> | null>(null);
  const [validSymbols, setValidSymbols] = useState<string[]>([]);
  const abortRef = useRef(false);

  // On mount: fetch user's trade history to pre-populate symbols
  useEffect(() => {
    async function prefill() {
      try {
        const res = await fetch("/api/trades?status=closed");
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
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
    setSeriesData(null);
  }

  function removeSymbol(sym: string) {
    setSymbols((prev) => prev.filter((s) => s !== sym));
    setSeriesData(null);
  }

  async function calculate() {
    if (symbols.length < 2) return;
    setLoading(true);
    setProgress(null);
    setSeriesData(null);
    setErrorSymbols(new Set());
    abortRef.current = false;

    const range = PERIOD_TO_RANGE[period];
    const fetchedSeries: Record<string, Bar[]> = {};
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

        if (period === "YTD") {
          const jan1 = getJan1Timestamp();
          bars = bars.filter((b) => b.time >= jan1);
        }

        if (bars.length < 2) throw new Error("insufficient data");
        fetchedSeries[sym] = bars;
      } catch {
        newErrors.add(sym);
      }
    }

    setErrorSymbols(newErrors);

    const valid = symbols.filter((s) => !newErrors.has(s));
    if (valid.length < 2) {
      setLoading(false);
      setProgress(null);
      return;
    }

    setSeriesData(fetchedSeries);
    setValidSymbols(valid);
    setLoading(false);
    setProgress(null);
  }

  // Build normalized chart data: % change from first close
  const chartData = useMemo(() => {
    if (!seriesData || validSymbols.length < 2) return [];

    // Find common timestamps across all valid symbols
    const timestampSets = validSymbols.map(
      (sym) => new Set(seriesData[sym].map((b) => b.time))
    );
    const commonTimestamps = [...timestampSets[0]].filter((t) =>
      timestampSets.every((s) => s.has(t))
    );
    commonTimestamps.sort((a, b) => a - b);

    if (commonTimestamps.length < 2) return [];

    // Build lookup maps
    const lookups: Record<string, Map<number, number>> = {};
    for (const sym of validSymbols) {
      const m = new Map<number, number>();
      for (const bar of seriesData[sym]) m.set(bar.time, bar.close);
      lookups[sym] = m;
    }

    // First close for normalization
    const firstClose: Record<string, number> = {};
    for (const sym of validSymbols) {
      firstClose[sym] = lookups[sym].get(commonTimestamps[0])!;
    }

    return commonTimestamps.map((t) => {
      const date = new Date(t * 1000);
      const point: Record<string, string | number> = {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
      };
      for (const sym of validSymbols) {
        const close = lookups[sym].get(t)!;
        point[sym] = Number(
          (((close - firstClose[sym]) / firstClose[sym]) * 100).toFixed(2)
        );
      }
      return point;
    });
  }, [seriesData, validSymbols]);

  // Compute pairwise correlations
  const pairs = useMemo(() => {
    if (!seriesData || validSymbols.length < 2) return [];

    const result: { a: string; b: string; corr: number }[] = [];
    for (let i = 0; i < validSymbols.length; i++) {
      for (let j = i + 1; j < validSymbols.length; j++) {
        const symA = validSymbols[i];
        const symB = validSymbols[j];
        const seriesA = seriesData[symA];
        const seriesB = seriesData[symB];

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

        if (alignedA.length >= 2) {
          try {
            result.push({ a: symA, b: symB, corr: sampleCorrelation(alignedA, alignedB) });
          } catch {
            // skip pair
          }
        }
      }
    }
    result.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
    return result;
  }, [seriesData, validSymbols]);

  const atLimit = symbols.length >= MAX_SYMBOLS;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold dark:text-white text-slate-900 mb-1">
          Correlation
        </h2>
        <p className="text-sm dark:text-slate-400 text-slate-500 mb-3">
          Compare price movements and Pearson correlation between symbols.
        </p>

        {/* Explainer */}
        <div className="px-4 py-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-sm dark:text-slate-400 text-slate-500">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 dark:text-slate-500 text-slate-400" />
            <div>
              <p className="mb-1.5">
                <span className="dark:text-white text-slate-900 font-medium">Correlation</span> measures how closely two assets move together, from <span className="text-red-400 font-medium">-1.0</span> (perfect inverse) to <span className="text-emerald-400 font-medium">+1.0</span> (perfect sync).
              </p>
              <ul className="space-y-0.5 dark:text-slate-500 text-slate-400 text-xs">
                <li><span className="text-emerald-400 font-medium">+0.7 to +1.0</span> — Strong positive: assets move in the same direction. Holding both increases concentration risk.</li>
                <li><span className="dark:text-slate-300 text-slate-600 font-medium">-0.3 to +0.3</span> — Weak/no correlation: assets move independently. Good for diversification.</li>
                <li><span className="text-red-400 font-medium">-1.0 to -0.7</span> — Strong negative: assets move opposite. Can be used as a hedge.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Symbol selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide dark:text-slate-400 text-slate-500">
          Symbols
        </label>

        {/* Chips */}
        {symbols.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {symbols.map((sym, idx) => (
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
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                />
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
              onEnter={addSymbol}
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
              setSeriesData(null);
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
          Add at least 2 symbols to compare correlations.
        </p>
      )}

      {/* Normalized price chart */}
      {chartData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700 mb-3">
            Normalized Price Movement (% change)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: number, name: string) => [
                    `${value > 0 ? "+" : ""}${value.toFixed(2)}%`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                />
                {validSymbols.map((sym, idx) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={LINE_COLORS[symbols.indexOf(sym) % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pairwise correlations */}
      {pairs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700 mb-1">
            Pairwise Correlations
          </h3>
          <p className="text-xs dark:text-slate-500 text-slate-400 mb-3">
            Each pair shows a Pearson correlation coefficient. The bar extends right (green) for positive and left (red) for negative correlation. Sorted by strength.
          </p>
          <div className="space-y-2">
            {pairs.map(({ a, b, corr }) => (
              <div
                key={`${a}-${b}`}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200"
              >
                <span className="text-sm font-medium dark:text-white text-slate-900 min-w-[120px]">
                  {a} / {b}
                </span>
                {/* Bar visualization */}
                <div className="flex-1 h-3 rounded-full dark:bg-slate-700 bg-slate-200 overflow-hidden relative">
                  {/* Center line at 0 */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px dark:bg-slate-500 bg-slate-400 z-10" />
                  {corr >= 0 ? (
                    <div
                      className="absolute top-0 bottom-0 rounded-r-full bg-emerald-500/70"
                      style={{ left: "50%", width: `${(corr / 1) * 50}%` }}
                    />
                  ) : (
                    <div
                      className="absolute top-0 bottom-0 rounded-l-full bg-red-500/70"
                      style={{
                        right: "50%",
                        width: `${(Math.abs(corr) / 1) * 50}%`,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`text-sm font-mono font-semibold min-w-[50px] text-right ${getCorrelationColor(corr)}`}
                >
                  {corr >= 0 ? "+" : ""}{corr.toFixed(2)}
                </span>
                <span className="text-xs dark:text-slate-500 text-slate-400 min-w-[60px]">
                  {getCorrelationLabel(corr)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
