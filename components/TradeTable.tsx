"use client";
import { Trade, QuoteMap } from "@/lib/types";
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import clsx from "clsx";

interface Props {
  trades: Trade[];
  onEdit: (t: Trade) => void;
  onDelete: (id: number) => void;
  limit?: number;
  quotes?: QuoteMap;
}

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-400",
  open: "bg-yellow-500/20 text-yellow-400",
  closed: "bg-slate-500/20 dark:text-slate-400 text-slate-500",
};

export default function TradeTable({ trades, onEdit, onDelete, limit, quotes = {} }: Props) {
  const rows = limit ? trades.slice(0, limit) : trades;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-8 text-center">
        <p className="dark:text-slate-500 text-slate-400 text-sm">No trades found. Add your first trade!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 overflow-hidden">

      {/* ── Mobile card view (< sm) ── */}
      <div className="sm:hidden divide-y dark:divide-slate-800 divide-slate-100">
        {rows.map((t) => {
          const livePnl =
            t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined
              ? (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1)
              : null;
          const closedPnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
          const liveColor = livePnl !== null ? (livePnl > 0 ? "text-emerald-400" : livePnl < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500") : "dark:text-slate-400 text-slate-500";
          return (
            <div key={t.id} className="p-3 dark:bg-slate-900 bg-white space-y-2">
              {/* Row 1: symbol + direction + status + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-emerald-400">{t.symbol}</span>
                  {t.direction === "long"
                    ? <span className="flex items-center gap-0.5 text-xs text-emerald-400"><ArrowUpRight className="w-3 h-3" />Long</span>
                    : <span className="flex items-center gap-0.5 text-xs text-red-400"><ArrowDownRight className="w-3 h-3" />Short</span>
                  }
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[t.status])}>
                    {t.status}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id); }} className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Row 2: entry · stop · target */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="dark:text-slate-500 text-slate-400 mb-0.5">Entry</div>
                  <div className="dark:text-slate-300 text-slate-700 font-medium">{t.entry_price ? `$${t.entry_price}` : "—"}</div>
                </div>
                <div>
                  <div className="dark:text-slate-500 text-slate-400 mb-0.5">Stop</div>
                  <div className="text-red-400 font-medium">{t.stop_loss ? `$${t.stop_loss}` : "—"}</div>
                </div>
                <div>
                  <div className="dark:text-slate-500 text-slate-400 mb-0.5">Target</div>
                  <div className="text-emerald-400 font-medium">{t.take_profit ? `$${t.take_profit}` : "—"}</div>
                </div>
              </div>

              {/* Row 3: P&L + unrealized + date */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={clsx("font-medium", closedPnlColor)}>
                    P&L: {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—"}
                  </span>
                  {livePnl !== null && (
                    <span className={clsx("flex items-center gap-1 font-medium", liveColor)}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {`${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}`}
                    </span>
                  )}
                </div>
                <span className="dark:text-slate-500 text-slate-400">
                  {t.entry_date ?? t.created_at.slice(0, 10)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (sm+) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="dark:bg-slate-800/60 bg-slate-100 border-b dark:border-slate-700 border-slate-200">
              {["Symbol", "Dir", "Status", "Entry", "Stop", "Target", "Exit", "Shares", "P&L", "Unrealized", "Date", ""].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800 divide-slate-100">
            {rows.map((t) => {
              const livePnl =
                t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined
                  ? (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1)
                  : null;
              const closedPnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
              const liveColor = livePnl !== null ? (livePnl > 0 ? "text-emerald-400" : livePnl < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500") : "dark:text-slate-400 text-slate-500";
              return (
                <tr key={t.id} className="hover:dark:bg-slate-800/30 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-emerald-400">{t.symbol}</td>
                  <td className="px-3 py-2.5">
                    {t.direction === "long"
                      ? <span className="flex items-center gap-1 text-emerald-400"><ArrowUpRight className="w-3 h-3" />Long</span>
                      : <span className="flex items-center gap-1 text-red-400"><ArrowDownRight className="w-3 h-3" />Short</span>
                    }
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[t.status])}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</td>
                  <td className="px-3 py-2.5 text-red-400">{t.stop_loss ? `$${t.stop_loss}` : "—"}</td>
                  <td className="px-3 py-2.5 text-emerald-400">{t.take_profit ? `$${t.take_profit}` : "—"}</td>
                  <td className="px-3 py-2.5 dark:text-slate-300 text-slate-700">{t.exit_price ? `$${t.exit_price}` : "—"}</td>
                  <td className="px-3 py-2.5 dark:text-slate-400 text-slate-500">{t.shares ?? "—"}</td>
                  <td className={clsx("px-3 py-2.5 font-medium", closedPnlColor)}>
                    {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—"}
                  </td>
                  <td className={clsx("px-3 py-2.5 font-medium", liveColor)}>
                    <span className="flex items-center gap-1.5">
                      {livePnl !== null && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      {livePnl !== null ? `${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}` : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 dark:text-slate-500 text-slate-400 text-xs whitespace-nowrap">
                    {t.entry_date ?? t.created_at.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(t)}
                        className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
