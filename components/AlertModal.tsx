"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Bell, RefreshCw, DollarSign, Percent, ChevronDown, Wallet } from "lucide-react";
import SymbolSearch from "./SymbolSearch";
import type { Alert, AlertCondition } from "@/lib/types";
import clsx from "clsx";

type AlertMode = "price" | "percent";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSymbol?: string;
  defaultPrice?: number;
  editAlert?: Alert | null;
}

const LABEL = "block text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400 mb-1.5 ml-1";
const INPUT = "w-full px-4 py-2.5 text-sm rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm";

export default function AlertModal({ open, onClose, onSaved, defaultSymbol, defaultPrice, editAlert }: Props) {
  const [mode, setMode] = useState<AlertMode>("price");
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [percentValue, setPercentValue] = useState("");
  const [percentDirection, setPercentDirection] = useState<"percent_up" | "percent_down" | "percent_move">("percent_up");
  const [repeating, setRepeating] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyDiscord, setNotifyDiscord] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchCurrentPrice = useCallback(async (sym: string) => {
    if (!sym.trim()) { setCurrentPrice(null); return; }
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${sym.toUpperCase()}`);
      if (res.ok) {
        const quotes: Record<string, number> = await res.json();
        const price = quotes[sym.toUpperCase()];
        if (price) setCurrentPrice(price);
        else setCurrentPrice(null);
      }
    } catch { /* silent */ }
    finally { setFetchingPrice(false); }
  }, []);

  useEffect(() => {
    if (mode !== "percent" || !currentPrice || !percentValue) return;
    const pct = parseFloat(percentValue);
    if (isNaN(pct) || pct <= 0) return;
    const target = percentDirection === "percent_down"
      ? currentPrice * (1 - pct / 100)
      : currentPrice * (1 + pct / 100);
    setTargetPrice(target.toFixed(2));
  }, [mode, currentPrice, percentValue, percentDirection]);

  useEffect(() => {
    if (open) {
      if (editAlert) {
        const isPercent = editAlert.condition === "percent_up" || editAlert.condition === "percent_down" || editAlert.condition === "percent_move";
        setMode(isPercent ? "percent" : "price");
        setSymbol(editAlert.symbol);
        setTargetPrice(String(editAlert.target_price));
        setCondition(editAlert.condition);
        if (isPercent) {
          setPercentDirection(editAlert.condition as "percent_up" | "percent_down" | "percent_move");
          setPercentValue(editAlert.percent_value ? String(editAlert.percent_value) : "");
          setCurrentPrice(editAlert.anchor_price);
        } else {
          setPercentValue("");
          setPercentDirection("percent_up");
          setCurrentPrice(null);
        }
        setRepeating(!!editAlert.repeating);
        setNotifyEmail(!!editAlert.notify_email);
        setNotifyDiscord(!!editAlert.notify_discord);
        setNote(editAlert.note ?? "");
      } else {
        setMode("price");
        setSymbol(defaultSymbol ?? "");
        setTargetPrice(defaultPrice?.toString() ?? "");
        setCondition("above");
        setPercentValue("");
        setPercentDirection("percent_up");
        setRepeating(false);
        setNotifyEmail(false);
        setNotifyDiscord(true);
        setNote("");
        setCurrentPrice(null);
        if (defaultSymbol) fetchCurrentPrice(defaultSymbol);
      }
      setError("");
    }
  }, [open, defaultSymbol, defaultPrice, editAlert, fetchCurrentPrice]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const isEdit = !!editAlert;
  const isPercentMode = mode === "percent";

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownTarget.current = e.target;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
      onClose();
    }
  };

  const handleSymbolChange = (sym: string) => {
    setSymbol(sym);
    if (sym.trim()) fetchCurrentPrice(sym);
    else setCurrentPrice(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) { setError("Symbol is required"); return; }

    const notificationPayload = {
      notify_email: notifyEmail ? 1 : 0,
      notify_discord: notifyDiscord ? 1 : 0,
    };

    setSaving(true);
    setError("");
    try {
      const price = parseFloat(targetPrice);
      const pct = isPercentMode ? parseFloat(percentValue) : null;
      
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/alerts/${editAlert!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_price: price,
            note: note.trim() || null,
            ...notificationPayload
          }),
        });
      } else {
        res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: symbol.toUpperCase(),
            condition: isPercentMode ? percentDirection : condition,
            target_price: price,
            percent_value: pct,
            anchor_price: isPercentMode ? currentPrice : null,
            repeating,
            note: note.trim() || null,
            ...notificationPayload
          }),
        });
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to ${isEdit ? "update" : "create"} alert`);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-slate-800 border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-bold dark:text-white text-slate-900 text-base sm:text-lg tracking-tight">
                {isEdit ? "Edit Alert" : "New Price Alert"}
              </h2>
              {symbol && <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{symbol}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors" aria-label="Close modal">
            <X className="w-5 h-5 sm:w-6 sm:h-6 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 scrollbar-thin">
          {/* Symbol */}
          <div>
            <label className={LABEL}>Symbol</label>
            {isEdit ? (
              <div className="px-4 py-2.5 text-sm rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-slate-50 dark:text-slate-300 text-slate-700 font-bold">
                {symbol.toUpperCase()}
              </div>
            ) : (
              <SymbolSearch value={symbol} onChange={handleSymbolChange} placeholder="e.g. AAPL" />
            )}
          </div>

          {/* Mode Toggle */}
          {!isEdit && (
            <div>
              <label className={LABEL}>Alert Type</label>
              <div className="flex p-1 rounded-xl dark:bg-slate-800 bg-slate-100 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode("price")}
                  className={clsx(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    mode === "price"
                      ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-md"
                      : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-300"
                  )}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Price Level
                </button>
                <button
                  type="button"
                  onClick={() => setMode("percent")}
                  className={clsx(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    mode === "percent"
                      ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-md"
                      : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-300"
                  )}
                >
                  <Percent className="w-3.5 h-3.5" />
                  % Move
                </button>
              </div>
            </div>
          )}

          {isPercentMode ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className={LABEL}>Direction</label>
                <div className="flex p-1 rounded-xl dark:bg-slate-800 bg-slate-100 shadow-inner">
                  {(["percent_up", "percent_down", "percent_move"] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      disabled={isEdit}
                      onClick={() => setPercentDirection(d)}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-[10px] font-bold transition-all",
                        percentDirection === d
                          ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-md"
                          : "dark:text-slate-400 text-slate-500 disabled:opacity-50"
                      )}
                    >
                      {d === "percent_up" ? "Up" : d === "percent_down" ? "Down" : "Either"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL}>Percentage (%)</label>
                <div className="relative">
                  <input type="number" step="any" min="0.01" value={percentValue} onChange={e => setPercentValue(e.target.value)} placeholder="5.0" className={INPUT} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm dark:text-slate-500 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/30 bg-slate-50/50 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] dark:text-slate-500 text-slate-400 font-bold uppercase tracking-widest">Current Price</span>
                  <span className="text-sm font-black dark:text-slate-300 text-slate-700">
                    {fetchingPrice ? "..." : currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                  </span>
                </div>
                {targetPrice && currentPrice && percentValue && (
                  <div className="flex items-center justify-between border-t dark:border-slate-800 border-slate-100 pt-2">
                    <span className="text-[10px] dark:text-slate-500 text-slate-400 font-bold uppercase tracking-widest">Target Price</span>
                    <span className={clsx("text-sm font-black", percentDirection === "percent_down" ? "text-red-400" : "text-emerald-400")}>
                      ${parseFloat(targetPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className={LABEL}>Target Price</label>
                <input type="number" step="any" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="0.00" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Condition</label>
                <div className="flex p-1 rounded-xl dark:bg-slate-800 bg-slate-100 shadow-inner">
                  {(["above", "below", "crosses"] as AlertCondition[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      disabled={isEdit}
                      onClick={() => setCondition(c)}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        condition === c
                          ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-md"
                          : "dark:text-slate-400 text-slate-500 disabled:opacity-50"
                      )}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <label className={LABEL}>Alert Options</label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'repeating', label: 'Repeating', sub: 'Auto-reactivate', val: repeating, set: setRepeating, disabled: isEdit },
                { id: 'email', label: 'Email', sub: 'Send notification', val: notifyEmail, set: setNotifyEmail },
                { id: 'discord', label: 'Discord', sub: 'Post to webhook', val: notifyDiscord, set: setNotifyDiscord }
              ].map(opt => (
                <div key={opt.id} className="flex items-center justify-between p-4 rounded-2xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/30 bg-slate-50/50 transition-all hover:dark:bg-slate-800/50 shadow-sm">
                  <div>
                    <p className="text-xs font-bold dark:text-slate-200 text-slate-700">{opt.label}</p>
                    <p className="text-[9px] dark:text-slate-500 text-slate-400 font-bold uppercase tracking-widest mt-0.5">{opt.sub}</p>
                  </div>
                  <label className={clsx("relative inline-flex items-center cursor-pointer", opt.disabled && "opacity-50 cursor-not-allowed")}>
                    <input type="checkbox" checked={opt.val} onChange={e => !opt.disabled && opt.set(e.target.checked)} disabled={opt.disabled} className="sr-only peer" />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Note (Optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Breakout retest confirmed..." rows={3} className={clsx(INPUT, "resize-none p-4 rounded-2xl")} />
          </div>
        </form>

        <div className="p-4 sm:p-6 border-t dark:border-slate-800 border-slate-100 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4 shrink-0">
          <button type="button" onClick={onClose} className="text-sm font-bold dark:text-slate-400 text-slate-500 px-4 hover:dark:text-slate-300 transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs font-bold text-red-400 animate-pulse">{error}</span>}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving || !symbol}
              className="px-6 sm:px-10 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : (isEdit ? "Update Alert" : "Create Alert")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
