"use client";

interface Props {
  value: string;
  subtitle?: string;
}

export default function StatWidget({ value, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <p className="text-2xl font-bold dark:text-white text-slate-900">{value}</p>
      {subtitle && (
        <p className="text-xs dark:text-slate-500 text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
