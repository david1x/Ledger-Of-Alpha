"use client";

import { useEffect, useState } from "react";

interface FearGreedData {
  value: number;
  label: string;
  timestamp: number;
  stale?: boolean;
}

const ZONES = [
  { min: 0, max: 25, color: "#ef4444", label: "Extreme Fear" },
  { min: 25, max: 45, color: "#f97316", label: "Fear" },
  { min: 45, max: 55, color: "#eab308", label: "Neutral" },
  { min: 55, max: 75, color: "#84cc16", label: "Greed" },
  { min: 75, max: 100, color: "#22c55e", label: "Extreme Greed" },
];

function getNeedleColor(value: number): string {
  if (value <= 25) return "#ef4444";
  if (value <= 45) return "#f97316";
  if (value <= 55) return "#eab308";
  if (value <= 75) return "#84cc16";
  return "#22c55e";
}

export default function FearGreedWidget() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/fear-greed");
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400">
        Unable to load Fear &amp; Greed data
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

  const { value, label } = data;
  const angle = 180 - (value / 100) * 180;
  const needleColor = getNeedleColor(value);

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
    { pct: 0, text: "0" },
    { pct: 25, text: "25" },
    { pct: 50, text: "50" },
    { pct: 75, text: "75" },
    { pct: 100, text: "100" },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full -mt-1">
      <svg viewBox="0 -12 260 157" className="w-full max-w-[230px]">
        {/* Zone arcs */}
        {ZONES.map((zone) => (
          <path
            key={zone.label}
            d={arcPath(zone.min, zone.max)}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            opacity={0.3}
          />
        ))}

        {/* Active arc up to current value */}
        <path
          d={arcPath(0, value)}
          fill="none"
          stroke={needleColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Scale labels */}
        {ticks.map((t) => {
          const p = labelPos(t.pct);
          const anchor = t.pct <= 10 ? "end" : t.pct >= 90 ? "start" : "middle";
          return (
            <text key={t.pct} x={p.x} y={p.y + 3} textAnchor={anchor}
              fontSize="11" fontWeight="500"
              className="dark:fill-slate-400 fill-slate-500">{t.text}</text>
          );
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={needleColor} strokeWidth={3} strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={5} fill={needleColor} />
        <circle cx={cx} cy={cy} r={2.5} className="dark:fill-slate-900 fill-white" />

        {/* Value text */}
        <text
          x={cx} y={cy + 20}
          textAnchor="middle"
          className="dark:fill-white fill-slate-900"
          fontSize="22" fontWeight="bold"
        >
          {value}
        </text>
      </svg>

      {/* Label */}
      <div className="text-sm font-semibold -mt-1" style={{ color: needleColor }}>
        {label}
      </div>
      <div className="text-[10px] dark:text-slate-600 text-slate-400 mt-0.5">
        CNN Fear &amp; Greed Index
      </div>
    </div>
  );
}
