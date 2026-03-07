"use client";

interface Props {
  leftLabel: string;
  leftValue: string;
  leftColor: string;
  rightLabel: string;
  rightValue: string;
  rightColor: string;
}

export default function ComparisonWidget({
  leftLabel, leftValue, leftColor,
  rightLabel, rightValue, rightColor,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 text-center">
        <p className="text-xs dark:text-slate-500 text-slate-400 mb-1">{leftLabel}</p>
        <p className={`text-xl font-bold ${leftColor}`}>{leftValue}</p>
      </div>
      <div className="w-px h-10 dark:bg-slate-700 bg-slate-200" />
      <div className="flex-1 text-center">
        <p className="text-xs dark:text-slate-500 text-slate-400 mb-1">{rightLabel}</p>
        <p className={`text-xl font-bold ${rightColor}`}>{rightValue}</p>
      </div>
    </div>
  );
}
