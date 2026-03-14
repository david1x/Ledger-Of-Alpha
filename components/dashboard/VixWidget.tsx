"use client";

import { useEffect, useState } from "react";

interface VixData {
  value: number;
  change: number;
  changePercent: number;
  stale?: boolean;
}

// Zones defined as percentages of the 0-50 VIX range
const MAX_VIX = 50;
const ZONES = [
  { min: 0, max: 12, color: "#22c55e" },
  { min: 12, max: 20, color: "#3b82f6" },
  { min: 20, max: 30, color: "#f97316" },
  { min: 30, max: 50, color: "#ef4444" },
];

function getZone(value: number) {
  if (value <= 12) return { color: "#22c55e", label: "Low Volatility" };
  if (value <= 20) return { color: "#3b82f6", label: "Normal" };
  if (value <= 30) return { color: "#f97316", label: "Elevated" };
  return { color: "#ef4444", label: "High Volatility" };
}

function toPct(val: number) {
  return (val / MAX_VIX) * 100;
}

export default function VixWidget() {
  const [data, setData] = useState<VixData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/vix");
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400">
        Unable to load VIX data
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400">
        Loading...
      </div>
    );
  }

  const { value, change, changePercent } = data;
  const zone = getZone(value);
  const clampedValue = Math.min(Math.max(value, 0), MAX_VIX);
  const valuePct = toPct(clampedValue);

  // Use same geometry as FearGreedWidget — all math in 0-100 pct space
  const angle = 180 - (valuePct / 100) * 180;
  const cx = 130;
  const cy = 115;
  const r = 90;
  const strokeWidth = 18;

  function arcPath(startPct: number, endPct: number): string {
    const startAngle = Math.PI - (startPct / 100) * Math.PI;
    const endAngle = Math.PI - (endPct / 100) * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    const largeArc = Math.abs(endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  const needleLen = r - 10;
  const needleAngleRad = (angle * Math.PI) / 180;
  const nx = cx + needleLen * Math.cos(needleAngleRad);
  const ny = cy - needleLen * Math.sin(needleAngleRad);

  const labelR = r + strokeWidth / 2 + 16;

  function labelPos(pct: number) {
    const a = Math.PI - (pct / 100) * Math.PI;
    return {
      x: cx + labelR * Math.cos(a),
      y: cy - labelR * Math.sin(a),
    };
  }

  const ticks = [
    { pct: toPct(0), text: "0" },
    { pct: toPct(12), text: "12" },
    { pct: toPct(20), text: "20" },
    { pct: toPct(30), text: "30" },
    { pct: toPct(50), text: "50" },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full -mt-1">
      <svg viewBox="0 -12 260 157" className="w-full max-w-[230px]">
        {/* Zone arcs: dim beyond value, bright up to value */}
        {ZONES.map((z) => {
          const zMinPct = toPct(z.min);
          const zMaxPct = toPct(z.max);
          const filled = valuePct >= zMaxPct;
          const partial = valuePct > zMinPct && valuePct < zMaxPct;
          return (
            <g key={z.min}>
              {/* Dim background for full zone */}
              <path
                d={arcPath(zMinPct, zMaxPct)}
                fill="none"
                stroke={z.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                opacity={0.2}
              />
              {/* Bright fill for reached portion */}
              {(filled || partial) && (
                <path
                  d={arcPath(zMinPct, filled ? zMaxPct : valuePct)}
                  fill="none"
                  stroke={z.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}

        {/* Scale labels */}
        {ticks.map((t) => {
          const p = labelPos(t.pct);
          const anchor = t.pct <= 10 ? "end" : t.pct >= 90 ? "start" : "middle";
          return (
            <text key={t.text} x={p.x} y={p.y + 3} textAnchor={anchor}
              fontSize="11" fontWeight="500"
              className="dark:fill-slate-400 fill-slate-500">{t.text}</text>
          );
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={zone.color} strokeWidth={3} strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={5} fill={zone.color} />
        <circle cx={cx} cy={cy} r={2.5} className="dark:fill-slate-900 fill-white" />

        {/* Value text */}
        <text
          x={cx} y={cy + 20}
          textAnchor="middle"
          className="dark:fill-white fill-slate-900"
          fontSize="22" fontWeight="bold"
        >
          {value.toFixed(1)}
        </text>
      </svg>

      {/* Label */}
      <div className="text-sm font-semibold -mt-1" style={{ color: zone.color }}>
        {zone.label}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`text-xs font-medium ${change >= 0 ? "text-red-400" : "text-emerald-400"}`}>
          {change >= 0 ? "+" : ""}{change.toFixed(2)} ({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%)
        </span>
      </div>
      <div className="text-[10px] dark:text-slate-600 text-slate-400 mt-0.5">
        CBOE Volatility Index
      </div>
    </div>
  );
}
