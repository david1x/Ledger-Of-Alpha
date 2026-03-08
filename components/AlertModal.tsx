"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Bell, RefreshCw } from "lucide-react";
import SymbolSearch from "./SymbolSearch";
import type { Alert, AlertCondition } from "@/lib/types";
import clsx from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSymbol?: string;
  defaultPrice?: number;
  editAlert?: Alert | null;
}

const LABEL = "block text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5";
const INPUT = "w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all";

export default function AlertModal({ open, onClose, onSaved, defaultSymbol, defaultPrice, editAlert }: Props) {
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [repeating, setRepeating] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Sync state when modal opens
  useEffect(() => {
    if (open) {
      if (editAlert) {
        setSymbol(editAlert.symbol);
        setTargetPrice(String(editAlert.target_price));
        setCondition(editAlert.condition);
        setRepeating(!!editAlert.repeating);
        setNote(editAlert.note ?? "");
      } else {
        setSymbol(defaultSymbol ?? "");
        setTargetPrice(defaultPrice?.toString() ?? "");
        setCondition("above");
        setRepeating(false);
        setNote("");
      }
      setError("");
    }
  }, [open, defaultSymbol, defaultPrice, editAlert]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const isEdit = !!editAlert;

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownTarget.current = e.target;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
      onClose();
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) { setError("Symbol is required"); return; }
    const price = parseFloat(targetPrice);
    if (!price || price <= 0) { setError("Enter a valid price"); return; }

    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/alerts/${editAlert!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_price: price,
            note: note.trim() || null,
          }),
        });
      } else {
        res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: symbol.toUpperCase(),
            condition,
            target_price: price,
            repeating,
            note: note.trim() || null,
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div className="w-full max-w-md rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-bold dark:text-white text-slate-900 text-lg">
                {isEdit ? "Edit Alert" : "New Price Alert"}
              </h2>
              {symbol && <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{symbol}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Symbol */}
          <div>
            <label className={LABEL}>Symbol</label>
            {isEdit ? (
              <div className="px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-slate-50 dark:text-slate-300 text-slate-700 font-bold">
                {symbol.toUpperCase()}
              </div>
            ) : (
              <SymbolSearch value={symbol} onChange={setSymbol} placeholder="e.g. AAPL" />
            )}
          </div>

          {/* Target Price */}
          <div>
            <label className={LABEL}>Target Price</label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className={INPUT}
            />
          </div>

          {/* Condition */}
          <div>
            <label className={LABEL}>Condition</label>
            <div className="flex p-1 rounded-xl dark:bg-slate-800 bg-slate-100">
              {(["above", "below", "crosses"] as AlertCondition[]).map(c => (
                <button
                  key={c}
                  type="button"
                  disabled={isEdit}
                  onClick={() => setCondition(c)}
                  className={clsx(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    condition === c
                      ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-sm"
                      : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-300 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {c === "above" ? "Above" : c === "below" ? "Below" : "Crosses"}
                </button>
              ))}
            </div>
          </div>

          {/* Repeating */}
          <div className="flex items-center justify-between p-3 rounded-xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/30 bg-slate-50/50">
            <div className="flex flex-col">
              <span className="text-sm font-bold dark:text-slate-200 text-slate-700">Repeating alert</span>
              <span className="text-[10px] dark:text-slate-500 text-slate-400 font-medium uppercase tracking-tight">Stays active after triggering</span>
            </div>
            <label className={clsx("relative inline-flex items-center cursor-pointer", isEdit && "opacity-50 cursor-not-allowed")}>
              <input
                type="checkbox"
                checked={repeating}
                onChange={e => !isEdit && setRepeating(e.target.checked)}
                disabled={isEdit}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Note */}
          <div>
            <label className={LABEL}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Breakout level, support bounce, etc."
              className={INPUT}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-pulse">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : (isEdit ? "Save Changes" : "Create Alert")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
