"use client";
import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import {
  createChart, ColorType, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine,
} from "lightweight-charts";

// ── Public handle exposed via ref ──────────────────────────────────────────
export interface SetupChartHandle {
  captureImage: () => string | null;
}

interface Props {
  symbol: string;
  direction: "long" | "short";
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  onEntryChange: (p: number) => void;
  onStopChange: (p: number) => void;
  onTargetChange: (p: number) => void;
  height?: number;
}

const INTERVALS = [
  { label: "5m",  yf: "5m",  range: "2d"  },
  { label: "15m", yf: "15m", range: "5d"  },
  { label: "1H",  yf: "1h",  range: "14d" },
  { label: "1D",  yf: "1d",  range: "3mo" },
  { label: "1W",  yf: "1wk", range: "1y"  },
];

const roundPrice = (p: number) =>
  p < 0.1 ? +p.toFixed(4) : p < 1 ? +p.toFixed(3) : +p.toFixed(2);

const SetupChart = forwardRef<SetupChartHandle, Props>(({
  symbol, direction, entry, stopLoss, takeProfit,
  onEntryChange, onStopChange, onTargetChange,
  height = 280,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartApiRef  = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<ISeriesApi<any> | null>(null);
  const entryLineRef  = useRef<IPriceLine | null>(null);
  const stopLineRef   = useRef<IPriceLine | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const draggingRef   = useRef<"entry" | "stop" | "target" | null>(null);
  const wasDraggingRef = useRef(false);

  // Refs to keep native event handlers up-to-date without re-attaching
  const priceRefs = useRef({ entry, stop: stopLoss, target: takeProfit });
  const cbRefs    = useRef({ onEntryChange, onStopChange, onTargetChange });
  const modeRef   = useRef<"entry" | "stop" | "target">("entry");

  const [activeMode, setActiveMode] = useState<"entry" | "stop" | "target">("entry");
  const [interval, setIntervalKey] = useState("1D");
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Sync mutable refs
  useEffect(() => { priceRefs.current = { entry, stop: stopLoss, target: takeProfit }; }, [entry, stopLoss, takeProfit]);
  useEffect(() => { cbRefs.current = { onEntryChange, onStopChange, onTargetChange }; }, [onEntryChange, onStopChange, onTargetChange]);
  useEffect(() => { modeRef.current = activeMode; }, [activeMode]);

  // ── captureImage exposed via ref ─────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    captureImage: () => {
      try {
        const canvas = chartApiRef.current?.takeScreenshot();
        return canvas ? canvas.toDataURL("image/png") : null;
      } catch { return null; }
    },
  }));

  // ── Create chart (once on mount) ─────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width:  el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: {
        vertLine: { color: "#475569", labelBackgroundColor: "#1e293b" },
        horzLine: { color: "#475569", labelBackgroundColor: "#1e293b" },
      },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale:       { borderColor: "#1e293b", timeVisible: true, secondsVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor:        "#34d399",
      downColor:      "#ef4444",
      borderUpColor:  "#34d399",
      borderDownColor:"#ef4444",
      wickUpColor:    "#34d399",
      wickDownColor:  "#ef4444",
    });

    chartApiRef.current = chart;
    seriesRef.current   = series;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    // ── Click → set price ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onChartClick = (param: any) => {
      if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
      if (!param?.point || !seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (!price || price <= 0) return;
      const p = roundPrice(price);
      const mode = modeRef.current;
      if (mode === "entry") cbRefs.current.onEntryChange(p);
      else if (mode === "stop") cbRefs.current.onStopChange(p);
      else cbRefs.current.onTargetChange(p);
    };
    chart.subscribeClick(onChartClick);

    // ── Drag price lines ─────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (!el || !seriesRef.current || !chartApiRef.current) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const near = (price: number | null) => {
        if (price === null || price <= 0) return false;
        const ly = seriesRef.current!.priceToCoordinate(price);
        return ly !== null && Math.abs(ly - y) < 10;
      };
      const { entry: ep, stop: sl, target: tp } = priceRefs.current;
      if      (near(ep)) draggingRef.current = "entry";
      else if (near(sl)) draggingRef.current = "stop";
      else if (near(tp)) draggingRef.current = "target";

      if (draggingRef.current) {
        e.preventDefault();
        // Disable chart pan/zoom while dragging a line
        chartApiRef.current.applyOptions({ handleScroll: false, handleScale: false });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !el || !seriesRef.current) return;
      wasDraggingRef.current = true;
      const rect = el.getBoundingClientRect();
      const price = seriesRef.current.coordinateToPrice(e.clientY - rect.top);
      if (!price || price <= 0) return;
      const p = roundPrice(price);
      if (draggingRef.current === "entry") cbRefs.current.onEntryChange(p);
      else if (draggingRef.current === "stop") cbRefs.current.onStopChange(p);
      else cbRefs.current.onTargetChange(p);
      el.style.cursor = "ns-resize";
    };

    const onMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null;
        chartApiRef.current?.applyOptions({ handleScroll: true, handleScale: true });
        if (containerRef.current) containerRef.current.style.cursor = "crosshair";
      }
    };

    // Cursor: show ns-resize when hovering a line
    const onMouseMoveForCursor = (e: MouseEvent) => {
      if (draggingRef.current || !seriesRef.current) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const near = (price: number | null) => {
        if (price === null || price <= 0) return false;
        const ly = seriesRef.current!.priceToCoordinate(price);
        return ly !== null && Math.abs(ly - y) < 10;
      };
      const { entry: ep, stop: sl, target: tp } = priceRefs.current;
      el.style.cursor = (near(ep) || near(sl) || near(tp)) ? "ns-resize" : "crosshair";
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mousemove", onMouseMoveForCursor);

    return () => {
      ro.disconnect();
      chart.unsubscribeClick(onChartClick);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMoveForCursor);
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current   = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]); // only re-create chart if height changes

  // ── Fetch OHLCV when symbol or interval changes ──────────────────────────
  useEffect(() => {
    if (!symbol || !seriesRef.current) return;
    const iv = INTERVALS.find(i => i.label === interval) ?? INTERVALS[3];
    setLoading(true);
    setDataError("");
    fetch(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${iv.yf}&range=${iv.range}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((bars: { time: number; open: number; high: number; low: number; close: number }[]) => {
        if (!seriesRef.current || !bars.length) { setDataError("No data"); return; }
        seriesRef.current.setData(bars);
        chartApiRef.current?.timeScale().fitContent();
      })
      .catch(() => setDataError("Failed to load chart data"))
      .finally(() => setLoading(false));
  }, [symbol, interval]);

  // ── Update price lines whenever prices change ────────────────────────────
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (entryLineRef.current) { s.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
    if (entry && entry > 0) {
      entryLineRef.current = s.createPriceLine({
        price: entry, color: "#94a3b8", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "Entry",
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
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Stop",
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
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "T/P",
      });
    }
  }, [takeProfit]);

  // ── Render ───────────────────────────────────────────────────────────────
  const fmt = (p: number) => p < 10 ? p.toPrecision(4) : p.toFixed(2);

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white">
        {/* Mode selector */}
        <div className="flex gap-1">
          {(["entry", "stop", "target"] as const).map(m => (
            <button key={m} onClick={() => setActiveMode(m)}
              className={`px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors border ${
                activeMode === m
                  ? m === "entry" ? "bg-slate-500/30 border-slate-400 text-slate-200"
                    : m === "stop" ? "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "border-transparent dark:text-slate-500 text-slate-400 hover:border-slate-600"
              }`}>
              {m === "target" ? "T/P" : m}
            </button>
          ))}
        </div>

        {/* Interval selector */}
        <div className="flex gap-0.5">
          {INTERVALS.map(iv => (
            <button key={iv.label} onClick={() => setIntervalKey(iv.label)}
              className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                interval === iv.label
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "dark:text-slate-500 text-slate-400 hover:dark:text-slate-300 hover:text-slate-600"
              }`}>
              {iv.label}
            </button>
          ))}
        </div>

        {/* Direction badge */}
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
          direction === "long"
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-red-400 bg-red-500/10"
        }`}>
          {direction === "long" ? "▲ LONG" : "▼ SHORT"}
        </span>
      </div>

      {/* Chart */}
      <div className="relative">
        <div ref={containerRef} style={{ height, background: "#0f172a" }} />

        {/* Overlays */}
        {!symbol && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-slate-500">Enter a symbol to load chart</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {dataError && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-red-400">{dataError}</p>
          </div>
        )}

        {/* Hint when chart has data but no lines set */}
        {symbol && !loading && !dataError && !entry && !stopLoss && !takeProfit && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-xs text-slate-500 bg-slate-950/70 px-2 py-0.5 rounded">
              Click chart to set <span className={
                activeMode === "entry" ? "text-slate-300" :
                activeMode === "stop"  ? "text-red-400"   : "text-emerald-400"
              }>{activeMode === "target" ? "T/P" : activeMode}</span>
            </span>
          </div>
        )}
      </div>

      {/* Price legend */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white font-mono text-xs">
        <span className="text-red-400">
          {stopLoss ? <>Stop <span className="font-semibold">${fmt(stopLoss)}</span></>
            : <span className="dark:text-slate-600 text-slate-400 font-sans">No stop</span>}
        </span>
        <span className="dark:text-slate-300 text-slate-700">
          {entry ? <>Entry <span className="font-semibold">${fmt(entry)}</span></>
            : <span className="dark:text-slate-600 text-slate-400 font-sans">No entry</span>}
        </span>
        {takeProfit
          ? <span className="text-emerald-400">T/P <span className="font-semibold">${fmt(takeProfit)}</span></span>
          : <span className="dark:text-slate-600 text-slate-400 font-sans">No target</span>}
      </div>
    </div>
  );
});

SetupChart.displayName = "SetupChart";
export default SetupChart;
