"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart, ColorType, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine,
} from "lightweight-charts";

interface MiniChartProps {
  symbol: string;
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  height?: number;
}

export default function MiniChart({
  symbol, entry, stopLoss, takeProfit, height = 160,
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
      rightPriceScale: { borderColor: "#1e293b", visible: false },
      timeScale: { borderColor: "#1e293b", visible: false },
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
  }, [height]);

  // Fetch data when symbol changes
  useEffect(() => {
    if (!symbol || !seriesRef.current) return;
    setLoading(true);
    setError("");
    fetch(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=1d&range=3mo`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((bars: { time: number; open: number; high: number; low: number; close: number }[]) => {
        if (!seriesRef.current || !bars.length) { setError("No data"); return; }
        seriesRef.current.setData(bars);
        chartRef.current?.timeScale().fitContent();
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Price lines
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (entryLineRef.current) { s.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
    if (entry && entry > 0) {
      entryLineRef.current = s.createPriceLine({
        price: entry, color: "#94a3b8", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: false, title: "Entry",
      });
    }
  }, [entry]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (stopLineRef.current) { s.removePriceLine(stopLineRef.current); stopLineRef.current = null; }
    if (stopLoss && stopLoss > 0) {
      stopLineRef.current = s.createPriceLine({
        price: stopLoss, color: "#ef4444", lineWidth: 2,
        lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "Stop",
      });
    }
  }, [stopLoss]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (targetLineRef.current) { s.removePriceLine(targetLineRef.current); targetLineRef.current = null; }
    if (takeProfit && takeProfit > 0) {
      targetLineRef.current = s.createPriceLine({
        price: takeProfit, color: "#34d399", lineWidth: 2,
        lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "T/P",
      });
    }
  }, [takeProfit]);

  return (
    <div className="relative rounded-lg overflow-hidden border dark:border-slate-700 border-slate-200">
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
