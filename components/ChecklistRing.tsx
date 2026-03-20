"use client";
import { ChecklistItem } from "@/lib/types";

interface Props {
  checklistState: string | null | undefined;
  size?: number;
}

export default function ChecklistRing({ checklistState, size = 28 }: Props) {
  if (!checklistState) return null;

  let items: ChecklistItem[] = [];
  try {
    const parsed = JSON.parse(checklistState);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    items = parsed;
  } catch {
    return null;
  }

  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const allDone = checked === total;

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (checked / total) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const trackColor = "var(--ring-track, #334155)"; // slate-700 equivalent
  const fillColor = allDone ? "#22c55e" : "#10b981"; // green-500 or emerald-500

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Checklist: ${checked} of ${total} complete`}
      className="shrink-0"
      style={{ "--ring-track": "var(--color-slate-700, #334155)" } as React.CSSProperties}
    >
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#334155"
        strokeWidth={3}
        className="dark:opacity-100 opacity-40"
      />
      {/* Filled arc */}
      {checked > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {/* Center label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size <= 28 ? 7 : 8}
        fontWeight="bold"
        fill={allDone ? fillColor : "#94a3b8"}
      >
        {checked}/{total}
      </text>
    </svg>
  );
}
