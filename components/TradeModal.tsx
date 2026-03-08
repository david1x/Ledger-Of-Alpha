"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Trade } from "@/lib/types";
import SymbolSearch from "./SymbolSearch";
import RiskCalculator from "./RiskCalculator";
import PositionSizer from "./PositionSizer";
import SetupChart from "./SetupChart";
import { X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"setup" | "execution" | "reflection">("setup");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountSize, setAccountSize] = useState(accountSizeProp ?? 10000);
  const [riskPercent, setRiskPercent] = useState(riskPercentProp ?? 1);
  const [defaultCommission, setDefaultCommission] = useState(0);
  const [showTradeSettings, setShowTradeSettings] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Always fetch settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (!accountSizeProp && s.account_size) {
          const startBal = parseFloat(s.account_size);
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

  useEffect(() => { setForm(trade ?? EMPTY); }, [trade]);

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

  const rrData = useMemo(() => {
    const e = form.entry_price;
    const s = form.stop_loss;
    const t = form.take_profit;
    if (!e || !s || !t) return null;
    const risk = Math.abs(e - s);
    const reward = Math.abs(t - e);
    if (risk === 0) return null;
    const ratio = reward / risk;
    let color = "text-slate-400 bg-slate-400/10";
    if (ratio >= 3) color = "text-emerald-400 bg-emerald-400/10";
    else if (ratio >= 2) color = "text-blue-400 bg-blue-400/10";
    else if (ratio >= 1) color = "text-amber-400 bg-amber-400/10";
    else color = "text-red-400 bg-red-400/10";
    return { ratio: ratio.toFixed(2), color };
  }, [form.entry_price, form.stop_loss, form.take_profit]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleBackdropClick}>
      <div ref={modalRef} className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl dark:bg-slate-900 bg-white shadow-2xl overflow-hidden border dark:border-slate-800 border-slate-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 border-slate-100">
          <div className="flex items-center gap-3">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white", form.direction === "long" ? "bg-emerald-600" : "bg-red-600")}>
              {form.symbol ? form.symbol[0].toUpperCase() : "?"}
            </div>
            <div>
              <h2 className="font-bold dark:text-white text-slate-900 flex items-center gap-2 text-lg">
                {trade ? "Edit Trade" : "New Trade Setup"} 
                {form.symbol && <span className="text-slate-500 font-medium">/ {form.symbol.toUpperCase()}</span>}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", form.direction === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                  {form.direction}
                </span>
                {rrData && (
                  <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", rrData.color)}>
                    R:R 1:{rrData.ratio}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-4 pt-2 border-b dark:border-slate-800 border-slate-100 dark:bg-slate-950 bg-slate-50/50">
          {[
            { id: "setup", label: "Setup & Logic" },
            { id: "execution", label: "Execution" },
            { id: "reflection", label: "Reflections" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={clsx(
                "px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
                activeTab === t.id 
                  ? "border-emerald-500 text-emerald-400" 
                  : "border-transparent dark:text-slate-500 text-slate-400 hover:dark:text-slate-300 hover:text-slate-600"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-7 space-y-6">
              
              {activeTab === "setup" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Symbol</label>
                      <SymbolSearch value={form.symbol ?? ""} onChange={(v) => set("symbol", v)} placeholder="Type symbol..." />
                    </div>
                    <div>
                      <label className={LABEL}>Direction</label>
                      <div className="flex h-10 p-1 rounded-xl dark:bg-slate-800 bg-slate-100">
                        <button onClick={() => set("direction", "long")} className={clsx("flex-1 rounded-lg text-xs font-bold transition-all", form.direction === "long" ? "bg-emerald-600 text-white shadow-md" : "dark:text-slate-400 text-slate-500")}>Long</button>
                        <button onClick={() => set("direction", "short")} className={clsx("flex-1 rounded-lg text-xs font-bold transition-all", form.direction === "short" ? "bg-red-600 text-white shadow-md" : "dark:text-slate-400 text-slate-500")}>Short</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div><label className={LABEL}>Target Entry</label><input placeholder="0.00" {...numField("entry_price")} /></div>
                    <div><label className={LABEL}>Stop Loss</label><input placeholder="0.00" {...numField("stop_loss")} /></div>
                    <div><label className={LABEL}>Take Profit</label><input placeholder="0.00" {...numField("take_profit")} /></div>
                  </div>

                  <div className="space-y-3">
                    <label className={LABEL}>Pre-trade Confluence Checklist</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {["Trend Alignment", "Support/Resistance", "Volume Confirmation", "News Checked", "Market Context", "Proper Sizing"].map(item => (
                        <label key={item} className="flex items-center gap-2.5 p-3 rounded-xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/30 bg-slate-50 cursor-pointer hover:border-emerald-500/50 transition-colors">
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                          <span className="text-xs font-medium dark:text-slate-300 text-slate-600">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "execution" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Current Status</label>
                      <select value={form.status} onChange={(e) => set("status", e.target.value)} className={INPUT}>
                        <option value="planned">Planned</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div><label className={LABEL}>Execution Date</label><input type="date" value={form.entry_date ?? ""} onChange={(e) => set("entry_date", e.target.value || null)} className={INPUT} /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={LABEL}>Quantity (Shares)</label><input placeholder="0" {...numField("shares")} /></div>
                    <div><label className={LABEL}>Exit Price</label><input placeholder="0.00" {...numField("exit_price")} /></div>
                  </div>

                  <div className="p-4 rounded-2xl border-2 border-dashed dark:border-slate-800 border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Position Overrides</h3>
                      <button onClick={() => setShowTradeSettings(!showTradeSettings)} className="text-[10px] font-bold text-emerald-400 hover:underline">
                        {showTradeSettings ? "Hide" : "Show Settings"}
                      </button>
                    </div>
                    {showTradeSettings && (
                      <div className="grid grid-cols-3 gap-3 animate-in fade-in zoom-in-95 duration-200">
                        <div><label className={LABEL}>Account ($)</label><input type="number" step="0.01" value={form.account_size ?? ""} onChange={(e) => set("account_size", e.target.value === "" ? null : parseFloat(e.target.value))} placeholder={String(accountSize)} className={INPUT} /></div>
                        <div><label className={LABEL}>Risk (%)</label><input type="number" step="0.1" value={form.risk_per_trade ?? ""} onChange={(e) => set("risk_per_trade", e.target.value === "" ? null : parseFloat(e.target.value))} placeholder={String(riskPercent)} className={INPUT} /></div>
                        <div><label className={LABEL}>Comm. ($)</label><input type="number" step="0.01" value={form.commission ?? ""} onChange={(e) => set("commission", e.target.value === "" ? null : parseFloat(e.target.value))} placeholder={String(defaultCommission)} className={INPUT} /></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "reflection" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <TagsInput value={form.tags ?? ""} onChange={(v) => set("tags", v)} />
                  <EmotionsInput value={form.emotions ?? ""} onChange={(v) => set("emotions", v)} />
                  <div>
                    <label className={LABEL}>Notes / Rationale</label>
                    <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="What did you see? How did you feel? What did you learn?" rows={8} className={INPUT + " resize-none min-h-[200px] p-4"} />
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: Calculators & Visuals */}
            <div className="lg:col-span-5 space-y-6 border-l dark:border-slate-800 border-slate-100 lg:pl-8">
              <div className="rounded-2xl overflow-hidden border dark:border-slate-800 border-slate-100 shadow-inner">
                <SetupChart
                  symbol={form.symbol ?? ""}
                  entry={form.entry_price ?? null}
                  stopLoss={form.stop_loss ?? null}
                  takeProfit={form.take_profit ?? null}
                  direction={form.direction ?? "long"}
                  onEntryChange={p => set("entry_price", p)}
                  onStopChange={p => set("stop_loss", p)}
                  onTargetChange={p => set("take_profit", p)}
                  height={280}
                />
              </div>
              
              <div className="space-y-4">
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

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t dark:border-slate-800 border-slate-100 dark:bg-slate-950 bg-slate-50/50">
          <div className="flex-1">
            {error && <p className="text-red-400 text-sm font-medium animate-pulse">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-8 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : trade ? "Update Trade" : "Save Trade Setup"}
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
