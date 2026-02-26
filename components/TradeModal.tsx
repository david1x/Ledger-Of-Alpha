"use client";
import { useState, useEffect } from "react";
import { Trade } from "@/lib/types";
import SymbolSearch from "./SymbolSearch";
import RiskCalculator from "./RiskCalculator";
import PositionSizer from "./PositionSizer";
import { X } from "lucide-react";

interface Props {
  trade?: Trade | null;
  onClose: () => void;
  onSaved: () => void;
  accountSize?: number;
  riskPercent?: number;
}

const EMPTY: Partial<Trade> = {
  symbol: "",
  direction: "long",
  status: "planned",
  entry_price: null,
  stop_loss: null,
  take_profit: null,
  exit_price: null,
  shares: null,
  entry_date: null,
  exit_date: null,
  notes: "",
  tags: "",
};

export default function TradeModal({ trade, onClose, onSaved, accountSize: accountSizeProp, riskPercent: riskPercentProp }: Props) {
  const [form, setForm] = useState<Partial<Trade>>(trade ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountSize, setAccountSize] = useState(accountSizeProp ?? 10000);
  const [riskPercent, setRiskPercent] = useState(riskPercentProp ?? 1);

  // Always fetch settings so the modal is correct even when parent didn't pass them
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (!accountSizeProp && s.account_size) setAccountSize(parseFloat(s.account_size));
        if (!riskPercentProp && s.risk_per_trade) setRiskPercent(parseFloat(s.risk_per_trade));
      })
      .catch(() => {});
  }, [accountSizeProp, riskPercentProp]);

  useEffect(() => {
    setForm(trade ?? EMPTY);
  }, [trade]);

  const set = (key: keyof Trade, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const numField = (key: keyof Trade) => ({
    type: "number" as const,
    step: "0.01",
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value === "" ? null : parseFloat(e.target.value)),
    className: INPUT,
  });

  const save = async () => {
    if (!form.symbol) { setError("Symbol is required"); return; }
    if (!form.direction) { setError("Direction is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url = trade ? `/api/trades/${trade.id}` : "/api/trades";
      const method = trade ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700 border-slate-200">
          <h2 className="font-semibold dark:text-white text-slate-900">
            {trade ? "Edit Trade" : "New Trade"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Form */}
          <div className="space-y-4">
            {/* Symbol */}
            <div>
              <label className={LABEL}>Symbol</label>
              <SymbolSearch
                value={form.symbol ?? ""}
                onChange={(v) => set("symbol", v)}
                placeholder="Search or type symbol..."
              />
            </div>

            {/* Direction + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Direction</label>
                <select value={form.direction} onChange={(e) => set("direction", e.target.value)} className={INPUT}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={INPUT}>
                  <option value="planned">Planned</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Entry Price</label>
                <input placeholder="0.00" {...numField("entry_price")} />
              </div>
              <div>
                <label className={LABEL}>Stop Loss</label>
                <input placeholder="0.00" {...numField("stop_loss")} />
              </div>
              <div>
                <label className={LABEL}>Take Profit</label>
                <input placeholder="0.00" {...numField("take_profit")} />
              </div>
            </div>

            {/* Shares + Exit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Shares</label>
                <input placeholder="0" {...numField("shares")} />
              </div>
              <div>
                <label className={LABEL}>Exit Price</label>
                <input placeholder="0.00" {...numField("exit_price")} />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Entry Date</label>
                <input
                  type="date"
                  value={form.entry_date ?? ""}
                  onChange={(e) => set("entry_date", e.target.value || null)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Exit Date</label>
                <input
                  type="date"
                  value={form.exit_date ?? ""}
                  onChange={(e) => set("exit_date", e.target.value || null)}
                  className={INPUT}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className={LABEL}>Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="breakout, earnings, swing"
                className={INPUT}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={LABEL}>Notes / Journal</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Trade thesis, setup details, lessons learned..."
                rows={3}
                className={INPUT + " resize-none"}
              />
            </div>
          </div>

          {/* Right: Calculators */}
          <div className="space-y-4">
            <RiskCalculator
              entry={form.entry_price ?? null}
              stopLoss={form.stop_loss ?? null}
              takeProfit={form.take_profit ?? null}
              shares={form.shares ?? null}
              direction={form.direction ?? "long"}
            />
            <PositionSizer
              accountSize={accountSize}
              riskPercent={riskPercent}
              entry={form.entry_price ?? null}
              stopLoss={form.stop_loss ?? null}
              direction={form.direction ?? "long"}
              manualShares={form.shares ?? null}
              onApplyShares={(s) => set("shares", s)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t dark:border-slate-700 border-slate-200">
          {error ? <p className="text-red-400 text-sm">{error}</p> : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : trade ? "Update Trade" : "Add Trade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LABEL = "block text-xs font-medium dark:text-slate-400 text-slate-500 mb-1";
const INPUT = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
