"use client";
import { useEffect, useState } from "react";
import { Trade } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Tag, FileText, Pencil } from "lucide-react";
import TradeModal from "@/components/TradeModal";
import clsx from "clsx";

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "with-notes">("all");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/trades");
    const data = await res.json();
    if (Array.isArray(data)) setTrades(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const displayed = filter === "with-notes"
    ? trades.filter((t) => t.notes && t.notes.trim().length > 0)
    : trades;

  const STATUS_COLOR: Record<string, string> = {
    planned: "bg-blue-500/20 text-blue-400",
    open: "bg-yellow-500/20 text-yellow-400",
    closed: "bg-slate-500/20 dark:text-slate-400 text-slate-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Trade Journal</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Notes, tags, and reflections per trade</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              filter === "all"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100"
            )}
          >
            All ({trades.length})
          </button>
          <button
            onClick={() => setFilter("with-notes")}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              filter === "with-notes"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100"
            )}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            With Notes ({trades.filter((t) => t.notes?.trim()).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 dark:text-slate-400 text-slate-500">Loading...</div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-12 text-center">
          <p className="dark:text-slate-500 text-slate-400">No trades with notes yet. Edit a trade to add notes.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((t) => {
            const pnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
            const tags = t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];

            return (
              <div key={t.id} className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-4 space-y-3 hover:border-emerald-500/50 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 text-lg">{t.symbol}</span>
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[t.status])}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.direction === "long"
                        ? <span className="flex items-center text-xs text-emerald-400 gap-0.5"><ArrowUpRight className="w-3 h-3" />Long</span>
                        : <span className="flex items-center text-xs text-red-400 gap-0.5"><ArrowDownRight className="w-3 h-3" />Short</span>
                      }
                      <span className="text-xs dark:text-slate-500 text-slate-400">
                        {t.entry_date ?? t.created_at.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditTrade(t); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                  </button>
                </div>

                {/* Price info */}
                <div className="flex gap-3 text-xs">
                  <span className="dark:text-slate-500 text-slate-400">Entry <span className="dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</span></span>
                  <span className="text-red-400">SL <span>{t.stop_loss ? `$${t.stop_loss}` : "—"}</span></span>
                  <span className="text-emerald-400">TP <span>{t.take_profit ? `$${t.take_profit}` : "—"}</span></span>
                  {t.pnl !== null && (
                    <span className={clsx("ml-auto font-bold", pnlColor)}>
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {t.notes ? (
                  <div className="rounded-lg dark:bg-slate-800 bg-slate-50 p-3 text-xs dark:text-slate-300 text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {t.notes}
                  </div>
                ) : (
                  <div className="rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-dashed border-slate-200 p-3 text-xs dark:text-slate-600 text-slate-400 italic">
                    No notes added yet
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <Tag className="w-3 h-3 dark:text-slate-500 text-slate-400 mt-0.5 shrink-0" />
                    {tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <TradeModal
          trade={editTrade}
          onClose={() => { setShowModal(false); setEditTrade(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
