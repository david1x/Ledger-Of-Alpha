"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import SymbolSearch from "./SymbolSearch";
import type { Alert, AlertCondition } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSymbol?: string;
  defaultPrice?: number;
  editAlert?: Alert | null;
}

export default function AlertModal({ open, onClose, onSaved, defaultSymbol, defaultPrice, editAlert }: Props) {
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [repeating, setRepeating] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

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

  if (!open || !mounted) return null;

  const isEdit = !!editAlert;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-800 border-slate-100">
          <h2 className="text-lg font-semibold dark:text-white text-slate-900">
            {isEdit ? "Edit Alert" : "New Price Alert"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Symbol */}
          <div>
            <label className="block text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">Symbol</label>
            {isEdit ? (
              <div className="px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-slate-50 dark:text-slate-300 text-slate-700 font-medium">
                {symbol}
              </div>
            ) : (
              <SymbolSearch value={symbol} onChange={setSymbol} placeholder="e.g. AAPL" />
            )}
          </div>

          {/* Target Price */}
          <div>
            <label className="block text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">Target Price</label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">Condition</label>
            <div className="flex gap-2">
              {(["above", "below", "crosses"] as AlertCondition[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !isEdit && setCondition(c)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    condition === c
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : isEdit
                        ? "dark:text-slate-600 text-slate-400 dark:border-slate-700 border-slate-200 cursor-not-allowed"
                        : "dark:text-slate-400 text-slate-600 dark:border-slate-700 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {c === "above" ? "Above" : c === "below" ? "Below" : "Crosses"}
                </button>
              ))}
            </div>
          </div>

          {/* Repeating */}
          <label className={`flex items-center gap-2.5 ${isEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={repeating}
              onChange={e => !isEdit && setRepeating(e.target.checked)}
              disabled={isEdit}
              className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm dark:text-slate-300 text-slate-700">Repeating alert</span>
            <span className="text-xs dark:text-slate-500 text-slate-400">(stays active after triggering)</span>
          </label>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Breakout level, support bounce, etc."
              className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Alert")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
