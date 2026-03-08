"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart, ColorType, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine,
} from "lightweight-charts";
import clsx from "clsx";

interface MiniChartProps {
  symbol: string;
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  height?: number;
  showPriceScale?: boolean;
  showTimeframeToggle?: boolean;
}

const TIMEFRAMES = [
  { label: "5m", interval: "5m", range: "1d" },
  { label: "15m", interval: "15m", range: "1d" },
  { label: "1h", interval: "1h", range: "5d" },
  { label: "1d", interval: "1d", range: "3mo" },
];

export default function MiniChart({
  symbol, entry, stopLoss, takeProfit, height = 160,
  showPriceScale = false,
  showTimeframeToggle = false,
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const entryLineRef = useRef<IPriceLine | null>(null);
  const stopLineRef = useRef<IPriceLine | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]); // Default 1d

  // Load persisted timeframe
  useEffect(() => {
    const saved = localStorage.getItem("minichart_timeframe");
    if (saved) {
      const found = TIMEFRAMES.find(tf => tf.label === saved);
      if (found) setTimeframe(found);
    }
  }, []);

  const handleTimeframeChange = (tf: typeof TIMEFRAMES[0]) => {
    setTimeframe(tf);
    localStorage.setItem("minichart_timeframe", tf.label);
  };

  // Create chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: {
        vertLine: { color: "#475569", labelBackgroundColor: "#1e293b" },
        horzLine: { color: "#475569", labelBackgroundColor: "#1e293b" },
      },
      rightPriceScale: { 
        borderColor: "#1e293b", 
        visible: showPriceScale,
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: { borderColor: "#1e293b", visible: showPriceScale },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#34d399",
      downColor: "#ef4444",
      borderUpColor: "#34d399",
      borderDownColor: "#ef4444",
      wickUpColor: "#34d399",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, showPriceScale]);

  // Fetch data when symbol or timeframe changes
  useEffect(() => {
    if (!symbol || !seriesRef.current) return;
    setLoading(true);
    setError("");
    fetch(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${timeframe.interval}&range=${timeframe.range}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((bars: { time: number; open: number; high: number; low: number; close: number }[]) => {
        if (!seriesRef.current || !bars.length) { setError("No data"); return; }
        seriesRef.current.setData(bars);
        chartRef.current?.timeScale().fitContent();
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [symbol, timeframe]);

  // Price lines
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (entryLineRef.current) { s.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
    if (entry && entry > 0) {
      entryLineRef.current = s.createPriceLine({
        price: entry, color: "#94a3b8", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: showPriceScale, title: "Entry",
      });
    }
  }, [entry, showPriceScale]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (stopLineRef.current) { s.removePriceLine(stopLineRef.current); stopLineRef.current = null; }
    if (stopLoss && stopLoss > 0) {
      stopLineRef.current = s.createPriceLine({
        price: stopLoss, color: "#ef4444", lineWidth: 2,
        lineStyle: LineStyle.Dashed, axisLabelVisible: showPriceScale, title: "Stop",
      });
    }
  }, [stopLoss, showPriceScale]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (targetLineRef.current) { s.removePriceLine(targetLineRef.current); targetLineRef.current = null; }
    if (takeProfit && takeProfit > 0) {
      targetLineRef.current = s.createPriceLine({
        price: takeProfit, color: "#34d399", lineWidth: 2,
        lineStyle: LineStyle.Dashed, axisLabelVisible: showPriceScale, title: "T/P",
      });
    }
  }, [takeProfit, showPriceScale]);

  return (
    <div className="relative rounded-lg overflow-hidden border dark:border-slate-700 border-slate-200">
      {showTimeframeToggle && (
        <div className="absolute top-2 left-2 z-10 flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/50 backdrop-blur-sm">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => handleTimeframeChange(tf)}
              className={clsx(
                "px-2 py-0.5 text-[10px] font-bold rounded transition-colors",
                timeframe.label === tf.label
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      )}
      
      <div ref={containerRef} style={{ height, background: "#0f172a" }} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
