"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PerfRow {
  category: string;
  pnl: number;
  count: number;
  winPct: number;
}

interface Props {
  rows: PerfRow[];
  pageSize?: number;
}

export default function PerfTableWidget({ rows, pageSize = 5 }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  if (!rows.length) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs dark:text-slate-500 text-slate-400">No data</p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="dark:text-slate-500 text-slate-400">
            <th className="text-left font-medium pb-1.5 pr-2">Category</th>
            <th className="text-right font-medium pb-1.5 px-2">P&L</th>
            <th className="text-right font-medium pb-1.5 px-2">Trades</th>
            <th className="text-right font-medium pb-1.5 pl-2">Win%</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.category} className="dark:text-slate-300 text-slate-700 border-t dark:border-slate-700/50 border-slate-100">
              <td className="py-1.5 pr-2 font-medium truncate max-w-[100px]">{r.category}</td>
              <td className={`py-1.5 px-2 text-right font-medium ${r.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${r.pnl.toFixed(2)}
              </td>
              <td className="py-1.5 px-2 text-right">{r.count}</td>
              <td className="py-1.5 pl-2 text-right">{r.winPct.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1 mt-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-0.5 rounded hover:dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-30">
            <ChevronLeft className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
          <span className="text-[10px] dark:text-slate-500 text-slate-400 min-w-[40px] text-center">
            {page + 1}/{totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-0.5 rounded hover:dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-30">
            <ChevronRight className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>
      )}
    </div>
  );
}
