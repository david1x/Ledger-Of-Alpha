"use client";
import { useMemo, useRef, useState } from "react";

interface Props {
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  direction: "long" | "short";
  interactive?: boolean;
  centerPrice?: number;
  onEntryChange?: (p: number) => void;
  onStopChange?: (p: number) => void;
  onTargetChange?: (p: number) => void;
  svgRef?: React.RefObject<SVGSVGElement>;
}

const SVG_W = 300;
const SVG_H = 110;
const PAD_V = 14;

const roundPrice = (p: number) =>
  p < 0.1 ? +p.toFixed(4) : p < 1 ? +p.toFixed(3) : +p.toFixed(2);

type LayoutResult = {
  lo: number;
  hi: number;
  hasAny: boolean;
  ey: number | null;
  sy: number | null;
  ty: number | null;
  rr: string | null;
  riskTop: number | null;
  riskH: number | null;
  rewardTop: number | null;
  rewardH: number | null;
} | null;

export default function SetupPreview({
  entry, stopLoss, takeProfit, direction,
  interactive = false, centerPrice,
  onEntryChange, onStopChange, onTargetChange,
  svgRef,
}: Props) {
  const [activeMode, setActiveMode] = useState<"entry" | "stop" | "target">("entry");
  const draggingRef = useRef<"entry" | "stop" | "target" | null>(null);
  const wasDraggingRef = useRef(false);
  const rangeRef = useRef({ lo: 0, hi: 1 });

  const layout = useMemo((): LayoutResult => {
    const pts = [entry, stopLoss, takeProfit].filter((p): p is number => p !== null && p > 0);

    if (pts.length === 0) {
      if (centerPrice && centerPrice > 0) {
        const lo = centerPrice * 0.95;
        const hi = centerPrice * 1.05;
        return { lo, hi, hasAny: false, ey: null, sy: null, ty: null, rr: null, riskTop: null, riskH: null, rewardTop: null, rewardH: null };
      }
      return null;
    }

    const rawMin = Math.min(...pts);
    const rawMax = Math.max(...pts);
    const spread = rawMax - rawMin || Math.abs(pts[0] * 0.04);
    const pad = spread * 0.38;
    const lo = rawMin - pad;
    const hi = rawMax + pad;

    const toY = (p: number) =>
      PAD_V + (1 - (p - lo) / (hi - lo)) * (SVG_H - PAD_V * 2);

    const ey = entry && entry > 0 ? toY(entry) : null;
    const sy = stopLoss && stopLoss > 0 ? toY(stopLoss) : null;
    const ty = takeProfit && takeProfit > 0 ? toY(takeProfit) : null;

    const stopDist = entry && stopLoss ? Math.abs(entry - stopLoss) : null;
    const targetDist = takeProfit && entry ? Math.abs(takeProfit - entry) : null;
    const rr = targetDist && stopDist ? (targetDist / stopDist).toFixed(1) : null;

    return {
      hasAny: true,
      lo, hi, ey, sy, ty, rr,
      riskTop: ey !== null && sy !== null ? Math.min(ey, sy) : null,
      riskH: ey !== null && sy !== null ? Math.abs(ey - sy) : null,
      rewardTop: ty !== null && ey !== null ? Math.min(ey, ty) : null,
      rewardH: ty !== null && ey !== null ? Math.abs(ey - ty) : null,
    };
  }, [entry, stopLoss, takeProfit, centerPrice]);

  // Sync rangeRef with computed layout (before any early returns)
  if (layout) {
    rangeRef.current = { lo: layout.lo, hi: layout.hi };
  }

  const fmt = (p: number) =>
    p < 1 ? p.toFixed(4) : p < 10 ? p.toFixed(3) : p.toFixed(2);

  const yToPrice = (e: React.MouseEvent<SVGSVGElement>): number => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickY = (e.clientY - rect.top) * (SVG_H / rect.height);
    const { lo, hi } = rangeRef.current;
    return hi - ((clickY - PAD_V) / (SVG_H - PAD_V * 2)) * (hi - lo);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
    const price = roundPrice(yToPrice(e));
    if (activeMode === "entry") onEntryChange?.(price);
    else if (activeMode === "stop") onStopChange?.(price);
    else onTargetChange?.(price);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    wasDraggingRef.current = true;
    const price = roundPrice(yToPrice(e));
    if (draggingRef.current === "entry") onEntryChange?.(price);
    else if (draggingRef.current === "stop") onStopChange?.(price);
    else onTargetChange?.(price);
  };

  const handleMouseUp = () => { draggingRef.current = null; };

  // Mode selector (shown when interactive)
  const modeSelector = interactive ? (
    <div className="flex gap-1 px-2 pt-2">
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
  ) : null;

  // No data and not interactive → original placeholder
  if (!layout && !interactive) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 h-20 flex items-center justify-center">
        <p className="text-xs dark:text-slate-500 text-slate-400 text-center px-4">
          Enter entry &amp; stop loss to preview setup
        </p>
      </div>
    );
  }

  // Interactive but no centerPrice or prices yet → show inactive state
  if (!layout) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 overflow-hidden">
        {modeSelector}
        <div className="flex items-center justify-center" style={{ height: SVG_H }}>
          <p className="text-xs dark:text-slate-500 text-slate-400 text-center px-4">
            Enter a symbol to activate the interactive chart
          </p>
        </div>
      </div>
    );
  }

  const { ey, sy, ty, rr, riskTop, riskH, rewardTop, rewardH } = layout;

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 overflow-hidden">
      {modeSelector}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: interactive ? "crosshair" : "default", height: SVG_H, display: "block" }}
        className="w-full"
      >
        {/* Empty hint when no price lines yet */}
        {!layout.hasAny && interactive && (
          <text x={SVG_W / 2} y={SVG_H / 2 + 4} textAnchor="middle" fontSize={9}
            fill="rgba(148,163,184,0.5)" fontFamily="system-ui,sans-serif">
            Click to set price levels
          </text>
        )}

        {/* Reward zone */}
        {rewardTop !== null && rewardH !== null && (
          <rect x={0} y={rewardTop} width={SVG_W} height={rewardH}
            fill="rgba(52,211,153,0.14)" />
        )}

        {/* Risk zone */}
        {riskTop !== null && riskH !== null && (
          <rect x={0} y={riskTop} width={SVG_W} height={riskH}
            fill="rgba(239,68,68,0.14)" />
        )}

        {/* Target line + drag hit area */}
        {ty !== null && (
          <>
            <line x1={0} y1={ty} x2={SVG_W} y2={ty}
              stroke="rgba(52,211,153,0.85)"
              strokeWidth={interactive && activeMode === "target" ? 2.5 : 1.5}
              strokeDasharray="6,3" />
            {interactive && (
              <line x1={0} y1={ty} x2={SVG_W} y2={ty}
                stroke="transparent" strokeWidth={12}
                style={{ cursor: "grab" }}
                onMouseDown={e => { e.stopPropagation(); draggingRef.current = "target"; }} />
            )}
          </>
        )}

        {/* Stop line + drag hit area */}
        {sy !== null && (
          <>
            <line x1={0} y1={sy} x2={SVG_W} y2={sy}
              stroke="rgba(239,68,68,0.85)"
              strokeWidth={interactive && activeMode === "stop" ? 2.5 : 1.5}
              strokeDasharray="6,3" />
            {interactive && (
              <line x1={0} y1={sy} x2={SVG_W} y2={sy}
                stroke="transparent" strokeWidth={12}
                style={{ cursor: "grab" }}
                onMouseDown={e => { e.stopPropagation(); draggingRef.current = "stop"; }} />
            )}
          </>
        )}

        {/* Entry line + drag hit area */}
        {ey !== null && (
          <>
            <line x1={0} y1={ey} x2={SVG_W} y2={ey}
              stroke="rgba(148,163,184,0.95)"
              strokeWidth={interactive && activeMode === "entry" ? 2.5 : 2} />
            {interactive && (
              <line x1={0} y1={ey} x2={SVG_W} y2={ey}
                stroke="transparent" strokeWidth={12}
                style={{ cursor: "grab" }}
                onMouseDown={e => { e.stopPropagation(); draggingRef.current = "entry"; }} />
            )}
          </>
        )}

        {/* Entry arrow */}
        {ey !== null && (
          <polygon
            points={`${SVG_W - 2},${ey} ${SVG_W - 10},${ey - 5} ${SVG_W - 10},${ey + 5}`}
            fill="rgba(148,163,184,0.95)"
          />
        )}

        {/* R:R badge */}
        {rr && (
          <>
            <rect x={6} y={6} width={54} height={16} rx={3} fill="rgba(0,0,0,0.28)" />
            <text x={10} y={17.5} fontSize={9.5} fill="white"
              fontFamily="system-ui,sans-serif" fontWeight="600">
              R:R 1:{rr}
            </text>
          </>
        )}

        {/* Direction badge */}
        <rect
          x={rr ? 64 : 6} y={6} width={38} height={16} rx={3}
          fill={direction === "long" ? "rgba(52,211,153,0.28)" : "rgba(239,68,68,0.28)"}
        />
        <text
          x={rr ? 68 : 10} y={17.5} fontSize={9.5} fontWeight="600"
          fill={direction === "long" ? "rgb(52,211,153)" : "rgb(239,68,68)"}
          fontFamily="system-ui,sans-serif"
        >
          {direction === "long" ? "LONG" : "SHORT"}
        </text>
      </svg>

      {/* Price legend */}
      <div className="flex items-center justify-between px-3 py-2 border-t dark:border-slate-700/60 border-slate-200 font-mono text-xs">
        <span className="text-red-400">
          {stopLoss
            ? <>Stop <span className="font-semibold">${fmt(stopLoss)}</span></>
            : <span className="dark:text-slate-600 text-slate-400 font-sans">No stop</span>}
        </span>
        <span className="dark:text-slate-300 text-slate-700">
          {entry
            ? <>Entry <span className="font-semibold">${fmt(entry)}</span></>
            : <span className="dark:text-slate-600 text-slate-400 font-sans">No entry</span>}
        </span>
        {takeProfit ? (
          <span className="text-emerald-400">
            T/P <span className="font-semibold">${fmt(takeProfit)}</span>
          </span>
        ) : (
          <span className="dark:text-slate-600 text-slate-400 font-sans">No target</span>
        )}
      </div>
    </div>
  );
}
