"use client";
import { useState, useEffect, useRef } from "react";
import { Trade } from "@/lib/types";
import SymbolSearch from "./SymbolSearch";
import RiskCalculator from "./RiskCalculator";
import PositionSizer from "./PositionSizer";
import SetupChart from "./SetupChart";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

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
  emotions: "",
};

export default function TradeModal({ trade, onClose, onSaved, accountSize: accountSizeProp, riskPercent: riskPercentProp }: Props) {
  const [form, setForm] = useState<Partial<Trade>>(trade ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountSize, setAccountSize] = useState(accountSizeProp ?? 10000);
  const [riskPercent, setRiskPercent] = useState(riskPercentProp ?? 1);
  const [defaultCommission, setDefaultCommission] = useState(0);
  const [showTradeSettings, setShowTradeSettings] = useState(false);

  // Always fetch settings so the modal is correct even when parent didn't pass them
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (!accountSizeProp && s.account_size) {
          const startBal = parseFloat(s.account_size);
          // Fetch trades to compute current balance
          fetch("/api/trades").then(r => r.json()).then(trades => {
            if (Array.isArray(trades)) {
              const totalPnl = trades.filter((t: { status: string; pnl?: number }) => t.status === "closed")
                .reduce((sum: number, t: { pnl?: number }) => sum + (t.pnl ?? 0), 0);
              setAccountSize(startBal + totalPnl);
            } else {
              setAccountSize(startBal);
            }
          }).catch(() => setAccountSize(startBal));
        }
        if (!riskPercentProp && s.risk_per_trade) setRiskPercent(parseFloat(s.risk_per_trade));
        if (s.commission_per_trade) setDefaultCommission(parseFloat(s.commission_per_trade));
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

    // Auto-close trade when exit price is provided
    const payload = { ...form };
    if (payload.exit_price != null && payload.status !== "closed") {
      payload.status = "closed";
    }

    try {
      const url = trade ? `/api/trades/${trade.id}` : "/api/trades";
      const method = trade ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl dark:bg-slate-900 bg-white shadow-2xl">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

            {/* Trade Settings (per-trade overrides) */}
            <div>
              <button
                type="button"
                onClick={() => setShowTradeSettings(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium dark:text-slate-400 text-slate-500 hover:dark:text-slate-300 hover:text-slate-700 transition-colors"
              >
                {showTradeSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Trade Settings
              </button>
              {showTradeSettings && (
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className={LABEL}>Account Size ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.account_size ?? ""}
                      onChange={(e) => set("account_size", e.target.value === "" ? null : parseFloat(e.target.value))}
                      placeholder={String(accountSize)}
                      className={INPUT}
                    />
                    <p className="text-[10px] dark:text-slate-500 text-slate-400 mt-0.5">Leave blank for default</p>
                  </div>
                  <div>
                    <label className={LABEL}>Risk (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.risk_per_trade ?? ""}
                      onChange={(e) => set("risk_per_trade", e.target.value === "" ? null : parseFloat(e.target.value))}
                      placeholder={String(riskPercent)}
                      className={INPUT}
                    />
                    <p className="text-[10px] dark:text-slate-500 text-slate-400 mt-0.5">Leave blank for default</p>
                  </div>
                  <div>
                    <label className={LABEL}>Commission ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.commission ?? ""}
                      onChange={(e) => set("commission", e.target.value === "" ? null : parseFloat(e.target.value))}
                      placeholder={String(defaultCommission)}
                      className={INPUT}
                    />
                    <p className="text-[10px] dark:text-slate-500 text-slate-400 mt-0.5">Per side (×2 round trip)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <TagsInput
              value={form.tags ?? ""}
              onChange={(v) => set("tags", v)}
            />

            {/* Emotions */}
            <EmotionsInput
              value={form.emotions ?? ""}
              onChange={(v) => set("emotions", v)}
            />

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
            <SetupChart
              symbol={form.symbol ?? ""}
              entry={form.entry_price ?? null}
              stopLoss={form.stop_loss ?? null}
              takeProfit={form.take_profit ?? null}
              direction={form.direction ?? "long"}
              onEntryChange={p => set("entry_price", p)}
              onStopChange={p => set("stop_loss", p)}
              onTargetChange={p => set("take_profit", p)}
              height={260}
            />
            <RiskCalculator
              entry={form.entry_price ?? null}
              stopLoss={form.stop_loss ?? null}
              takeProfit={form.take_profit ?? null}
              shares={form.shares ?? null}
              direction={form.direction ?? "long"}
              commission={form.commission ?? defaultCommission}
            />
            <PositionSizer
              accountSize={form.account_size ?? accountSize}
              riskPercent={form.risk_per_trade ?? riskPercent}
              entry={form.entry_price ?? null}
              stopLoss={form.stop_loss ?? null}
              direction={form.direction ?? "long"}
              manualShares={form.shares ?? null}
              onApplyShares={(s) => set("shares", s)}
              commission={form.commission ?? defaultCommission}
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

function TagsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const [input, setInput] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIdx !== null) editRef.current?.focus();
  }, [editingIdx]);

  const commitTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const next = [...tags, tag];
    onChange(next.join(", "));
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      commitTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      const next = tags.slice(0, -1);
      onChange(next.join(", "));
    }
  };

  const removeTag = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx);
    onChange(next.join(", "));
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(tags[idx]);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      const next = [...tags];
      next[editingIdx] = trimmed;
      onChange(next.join(", "));
    } else {
      removeTag(editingIdx);
    }
    setEditingIdx(null);
    setEditValue("");
  };

  return (
    <div className="space-y-2">
      <label className={LABEL}>Tags</label>
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white focus-within:ring-2 focus-within:ring-emerald-500 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          editingIdx === i ? (
            <input
              key={i}
              ref={editRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditingIdx(null); setEditValue(""); } }}
              className="px-2 py-0.5 text-xs rounded-md border border-emerald-500 dark:bg-slate-700 bg-slate-100 dark:text-white text-slate-900 outline-none min-w-[60px] w-auto"
              style={{ width: `${Math.max(editValue.length, 4)}ch` }}
            />
          ) : (
            <span
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-medium select-none"
              onDoubleClick={() => startEdit(i)}
            >
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) commitTag(input); }}
          placeholder={tags.length === 0 ? "Type and press comma or enter..." : ""}
          className="flex-1 min-w-[80px] bg-transparent text-sm dark:text-white text-slate-900 outline-none py-0.5"
        />
      </div>
    </div>
  );
}

const EMOTIONS = [
  "Fear", "Greed", "Frustration", "Impatience", "FOMO", 
  "Overconfidence", "Anxiety", "Regret", "Hope", "Boredom", "Satisfaction"
];

function EmotionsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];

  const toggle = (emo: string) => {
    let next: string[];
    if (selected.includes(emo)) {
      next = selected.filter(s => s !== emo);
    } else {
      next = [...selected, emo];
    }
    onChange(next.join(", "));
  };

  return (
    <div className="space-y-2">
      <label className={LABEL}>Emotions / Feelings</label>
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map(emo => {
          const isSelected = selected.includes(emo);
          return (
            <button
              key={emo}
              type="button"
              onClick={() => toggle(emo)}
              className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200",
                isSelected 
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                  : "dark:bg-slate-800/50 bg-slate-50 dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:border-slate-400"
              )}
            >
              {emo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
