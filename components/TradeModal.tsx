"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Trade, TradeStrategy, TradeTemplate } from "@/lib/types";
import SymbolSearch from "./SymbolSearch";
import RiskCalculator from "./RiskCalculator";
import PositionSizer from "./PositionSizer";
import SetupChart from "./SetupChart";
import { X, ChevronDown, RefreshCw, Star, Wallet, Sparkles, Layout, Target, BookOpen, Tag, Smile, Plus } from "lucide-react";
import clsx from "clsx";
import { useAccounts } from "@/lib/account-context";

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
  wyckoff_checklist: "",
  rating: null,
  mistakes: "",
  market_context: null,
  lessons: "",
  chart_tf: null,
  chart_saved_at: null,
};

const LABEL = "block text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 mb-2 ml-1";
const INPUT = "w-full px-4 py-2.5 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm hover:border-slate-400 dark:hover:border-slate-600";

const DEFAULT_STRATEGIES: TradeStrategy[] = [
  { id: "wyckoff_buy", name: "Wyckoff Buying Tests", checklist: ["Downside objective accomplished", "Activity bullish (Vol increase on rallies)", "Preliminary support / Selling climax", "Relative strength (Bullish vs Market)", "Downward trendline broken", "Higher lows", "Higher highs", "Base forming (Cause)", "RR Potential 3:1 or better"] },
  { id: "wyckoff_sell", name: "Wyckoff Selling Tests", checklist: ["Upside objective accomplished", "Activity bearish (Vol increase on drops)", "Preliminary supply / Buying climax", "Relative weakness (Bearish vs Market)", "Upward trendline broken", "Lower highs", "Lower lows", "Top forming (Cause)", "RR Potential 3:1 or better"] }
];

export default function TradeModal({ trade, onClose, onSaved, accountSize: accountSizeProp, riskPercent: riskPercentProp }: Props) {
  const [form, setForm] = useState<Partial<Trade>>(trade ?? EMPTY);
  const [activeTab, setActiveTab] = useState<"setup" | "execution" | "reflection">("setup");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountSize, setAccountSize] = useState(accountSizeProp ?? 10000);
  const [riskPercent, setRiskPercent] = useState(riskPercentProp ?? 1);
  const [defaultCommission, setDefaultCommission] = useState(0);
  const { accounts, activeAccountId } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    trade?.account_id ?? activeAccountId ?? null
  );
  const [strategies, setStrategies] = useState<TradeStrategy[]>([]);
  const [defaultMistakes, setDefaultMistakes] = useState<string[]>(["Entered too early", "Exited too early", "Exited too late", "Moved stop loss", "Oversized position", "No stop loss", "Chased the trade", "Revenge trade", "Ignored plan", "FOMO entry"]);
  const [defaultTags, setDefaultTags] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [chartInterval, setChartInterval] = useState(trade?.chart_tf ?? "1D");

  const modalRef = useRef<HTMLDivElement>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => { mouseDownTarget.current = e.target; };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.strategies) {
          try {
            const parsed = JSON.parse(s.strategies);
            setStrategies(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STRATEGIES);
          } catch { setStrategies(DEFAULT_STRATEGIES); }
        } else { setStrategies(DEFAULT_STRATEGIES); }
        
        if (s.default_mistakes) { try { const m = JSON.parse(s.default_mistakes); if (Array.isArray(m)) setDefaultMistakes(m); } catch {} }
        if (s.default_tags) { try { const t = JSON.parse(s.default_tags); if (Array.isArray(t)) setDefaultTags(t); } catch {} }
        if (s.trade_templates) { try { const t = JSON.parse(s.trade_templates); if (Array.isArray(t)) setTemplates(t); } catch {} }
        if (!accountSizeProp && s.account_size) setAccountSize(parseFloat(s.account_size));
        if (!riskPercentProp && s.risk_per_trade) setRiskPercent(parseFloat(s.risk_per_trade));
        if (s.commission_per_trade) setDefaultCommission(parseFloat(s.commission_per_trade));

        const selAcct = accounts.find(a => a.id === selectedAccountId);
        if (selAcct) {
          if (!riskPercentProp) setRiskPercent(selAcct.risk_per_trade);
          setDefaultCommission(selAcct.commission_value);
        }
      }).catch(() => {});
  }, [selectedAccountId, accounts, accountSizeProp, riskPercentProp]);

  useEffect(() => { setForm(trade ?? EMPTY); }, [trade]);

  const set = (key: keyof Trade, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const numField = (key: keyof Trade) => ({
    type: "number" as const,
    step: "any",
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value === "" ? null : parseFloat(e.target.value)),
    className: INPUT,
  });

  const save = async () => {
    if (!form.symbol) { setError("Symbol is required"); return; }
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = { ...form };
    if (selectedAccountId) payload.account_id = selectedAccountId;
    if (payload.commission == null) payload.commission = defaultCommission;
    if (payload.exit_price != null && payload.status !== "closed") payload.status = "closed";
    payload.chart_tf = chartInterval;
    payload.chart_saved_at = new Date().toISOString();

    try {
      const url = trade ? `/api/trades/${trade.id}` : "/api/trades";
      const method = trade ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { onSaved(); onClose(); }
      else { const d = await res.json(); setError(d.error ?? "Failed to save"); }
    } finally { setSaving(false); }
  };

  const loadTemplate = (tmpl: TradeTemplate) => setForm(f => ({ ...f, ...tmpl.fields }));

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return;
    const { id, created_at, user_id, pnl, ...fields } = form as any;
    const newTmpl: TradeTemplate = { id: crypto.randomUUID(), name: templateName.trim(), fields };
    const updated = [...templates, newTmpl];
    setTemplates(updated);
    setShowTemplateSave(false);
    setTemplateName("");
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_templates: JSON.stringify(updated) }),
    });
  };

  const rrData = useMemo(() => {
    const e = form.entry_price, s = form.stop_loss, t = form.take_profit;
    if (!e || !s || !t) return null;
    const risk = Math.abs(e - s), reward = Math.abs(t - e);
    if (risk === 0) return null;
    const ratio = reward / risk;
    let color = "bg-slate-500/10 text-slate-400 border-slate-500/20";
    if (ratio >= 3) color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    else if (ratio >= 2) color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    else if (ratio >= 1) color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    else color = "bg-red-500/10 text-red-400 border-red-500/20";
    return { ratio: ratio.toFixed(2), color };
  }, [form.entry_price, form.stop_loss, form.take_profit]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" 
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div ref={modalRef} className="w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-2xl dark:bg-slate-900 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden border dark:border-slate-800 border-slate-200 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b dark:border-slate-800 border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-2xl transition-all", form.direction === "long" ? "bg-emerald-600 rotate-0" : "bg-red-600 -rotate-12")}>
              {form.symbol ? form.symbol[0].toUpperCase() : <Plus className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="font-black dark:text-white text-slate-900 flex items-center gap-3 text-xl sm:text-2xl tracking-tighter">
                {trade ? "Edit Trade" : "New Entry"} 
                {form.symbol && <span className="text-slate-500 font-medium">/ {form.symbol.toUpperCase()}</span>}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={clsx("text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg border", form.direction === "long" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                  {form.direction}
                </span>
                {rrData && (
                  <span className={clsx("text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg border", rrData.color)}>
                    R:R 1:{rrData.ratio}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-all active:scale-90" aria-label="Close modal">
            <X className="w-6 h-6 dark:text-slate-400 text-slate-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 sm:px-10 pt-2 border-b dark:border-slate-800 border-slate-100 dark:bg-slate-950 bg-slate-50/50 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: "setup", label: "Setup & Strategy", icon: Target },
            { id: "execution", label: "Market Execution", icon: Layout },
            { id: "reflection", label: "Psychology & Reflection", icon: BookOpen },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={clsx(
                "px-6 py-4 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 flex items-center gap-2.5 whitespace-nowrap",
                activeTab === t.id 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent dark:text-slate-500 text-slate-400 hover:dark:text-slate-300 hover:text-slate-600"
              )}
            >
              <t.icon className={clsx("w-4 h-4", activeTab === t.id ? "text-emerald-400" : "text-slate-500")} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 scrollbar-thin custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            
            {/* Left Panel: Form Content */}
            <div className="lg:col-span-7 space-y-10">
              
              {activeTab === "setup" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
                  <section>
                    <SectionHeader icon={Target} title="Core Setup" sub="Select your asset and bias" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className={LABEL}>Asset Symbol</label>
                        <SymbolSearch value={form.symbol ?? ""} onChange={(v) => set("symbol", v)} placeholder="AAPL, TSLA, BTC..." />
                      </div>
                      <div>
                        <label className={LABEL}>Trade Bias</label>
                        <div className="flex h-11 p-1 rounded-2xl dark:bg-slate-800 bg-slate-200/50 shadow-inner">
                          <button onClick={() => set("direction", "long")} className={clsx("flex-1 rounded-xl text-xs font-black uppercase tracking-widest transition-all", form.direction === "long" ? "bg-emerald-600 text-white shadow-xl scale-[1.02]" : "dark:text-slate-500 text-slate-500")}>Long</button>
                          <button onClick={() => set("direction", "short")} className={clsx("flex-1 rounded-xl text-xs font-black uppercase tracking-widest transition-all", form.direction === "short" ? "bg-red-600 text-white shadow-xl scale-[1.02]" : "dark:text-slate-500 text-slate-500")}>Short</button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="pt-6 border-t dark:border-slate-800 border-slate-200">
                    <SectionHeader icon={Wallet} title="Account & Status" sub="Manage risk allocation" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {accounts.length > 1 && (
                        <div>
                          <label className={LABEL}>Target Account</label>
                          <div className="relative">
                            <select value={selectedAccountId ?? ""} onChange={(e) => setSelectedAccountId(e.target.value || null)} className={clsx(INPUT, "appearance-none pr-10 h-11")}>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <Wallet className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className={LABEL}>Trade Lifecycle</label>
                        <div className="relative">
                          <select value={form.status} onChange={e => set("status", e.target.value as any)} className={clsx(INPUT, "appearance-none pr-10 h-11")}>
                            <option value="planned">Planned Idea</option>
                            <option value="open">Active Order</option>
                            <option value="closed">Closed / History</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="pt-6 border-t dark:border-slate-800 border-slate-200">
                    <StrategyChecklist 
                      strategies={strategies} direction={form.direction ?? "long"} 
                      strategyId={form.strategy_id} checklist={form.checklist_items ?? ""}
                      onStrategyChange={(sid: string) => set("strategy_id", sid)} onChecklistChange={(val: string) => set("checklist_items", val)}
                    />
                  </section>
                </div>
              )}

              {activeTab === "execution" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
                  <section>
                    <SectionHeader icon={Layout} title="Price Levels" sub="Entry and risk boundaries" />
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className={LABEL}>Entry</label><input placeholder="0.00" {...numField("entry_price")} /></div>
                      <div><label className={LABEL}>Stop</label><input placeholder="0.00" {...numField("stop_loss")} /></div>
                      <div><label className={LABEL}>Target</label><input placeholder="0.00" {...numField("take_profit")} /></div>
                    </div>
                  </section>

                  <section className="pt-6 border-t dark:border-slate-800 border-slate-200">
                    <SectionHeader icon={RefreshCw} title="Position Detail" sub="Execution timing and size" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div><label className={LABEL}>Size / Shares</label><input placeholder="0" {...numField("shares")} /></div>
                      <div><label className={LABEL}>Entry Date</label><input type="date" value={form.entry_date ?? ""} onChange={e => set("entry_date", e.target.value)} className={INPUT} /></div>
                    </div>
                  </section>

                  {form.status === "closed" && (
                    <section className="pt-6 border-t dark:border-slate-800 border-slate-200 bg-emerald-500/5 p-6 rounded-2xl border-2 border-emerald-500/20">
                      <SectionHeader icon={Sparkles} title="Exit Result" sub="Finalized trade data" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div><label className={LABEL}>Final Exit Price</label><input placeholder="0.00" {...numField("exit_price")} /></div>
                        <div><label className={LABEL}>Exit Date</label><input type="date" value={form.exit_date ?? ""} onChange={e => set("exit_date", e.target.value)} className={INPUT} /></div>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {activeTab === "reflection" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
                  <section>
                    <SectionHeader icon={Smile} title="Psychology" sub="How did you feel?" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div>
                        <label className={LABEL}>Star Performance</label>
                        <div className="flex items-center gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button" onClick={() => set("rating", form.rating === n ? null : n)}
                              className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center transition-all", (form.rating ?? 0) >= n ? "bg-amber-400 text-white shadow-xl shadow-amber-400/20 scale-110" : "dark:bg-slate-800 bg-slate-100 dark:text-slate-600 text-slate-300 hover:scale-105")}>
                              <Star className={clsx("w-6 h-6", (form.rating ?? 0) >= n ? "fill-current" : "")} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={LABEL}>Market Vibe</label>
                        <div className="relative">
                          <select value={form.market_context ?? ""} onChange={e => set("market_context", e.target.value || null)} className={clsx(INPUT, "appearance-none pr-10 h-11")}>
                            <option value="">— Select Context —</option>
                            <option value="trending_up">Trending Up (Bullish)</option>
                            <option value="trending_down">Trending Down (Bearish)</option>
                            <option value="ranging">Ranging / Sideways</option>
                            <option value="choppy">Choppy / No Trend</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="pt-6 border-t dark:border-slate-800 border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <TagsInput value={form.tags ?? ""} onChange={(v: string) => set("tags", v)} defaultTags={defaultTags} />
                      <EmotionsInput value={form.emotions ?? ""} onChange={(v: string) => set("emotions", v)} />
                    </div>
                  </section>

                  <section className="pt-6 border-t dark:border-slate-800 border-slate-200">
                    <SectionHeader icon={BookOpen} title="Lessons & Notes" sub="Final journaling" />
                    <div className="space-y-6">
                      <div><label className={LABEL}>Lessons Learned</label><textarea value={form.lessons ?? ""} onChange={e => set("lessons", e.target.value)} className={clsx(INPUT, "min-h-[120px] resize-none p-5 rounded-2xl")} placeholder="Key takeaways from this setup..." /></div>
                      <div><label className={LABEL}>Inner Dialogue</label><textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={clsx(INPUT, "min-h-[140px] resize-none p-5 rounded-2xl")} placeholder="Detailed thoughts and execution notes..." /></div>
                    </div>
                  </section>
                </div>
              )}

            </div>

            {/* Right Panel: Tools & Analytics */}
            <div className="lg:col-span-5 space-y-10 lg:border-l dark:border-slate-800 border-slate-100 pt-8 lg:pt-0 lg:pl-16">
              <div className="rounded-2xl overflow-hidden border dark:border-slate-800 border-slate-100 shadow-2xl bg-white dark:bg-slate-950 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none" />
                <SetupChart
                  symbol={form.symbol ?? ""} entry={form.entry_price ?? null} stopLoss={form.stop_loss ?? null}
                  takeProfit={form.take_profit ?? null} direction={form.direction ?? "long"}
                  onEntryChange={p => set("entry_price", p)} onStopChange={p => set("stop_loss", p)}
                  onTargetChange={p => set("take_profit", p)} height={320}
                  initialInterval={trade?.chart_tf ?? undefined} onIntervalChange={setChartInterval} savedAt={trade?.chart_saved_at}
                />
              </div>
              
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
                <RiskCalculator
                  entry={form.entry_price ?? null} stopLoss={form.stop_loss ?? null} takeProfit={form.take_profit ?? null}
                  shares={form.shares ?? null} direction={form.direction ?? "long"} commission={form.commission ?? defaultCommission}
                />
                <PositionSizer
                  accountSize={form.account_size ?? accountSize} riskPercent={form.risk_per_trade ?? riskPercent}
                  entry={form.entry_price ?? null} stopLoss={form.stop_loss ?? null} direction={form.direction ?? "long"}
                  manualShares={form.shares ?? null} onApplyShares={(s) => set("shares", s)} commission={form.commission ?? defaultCommission}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-6 sm:p-8 border-t dark:border-slate-800 border-slate-100 dark:bg-slate-950 bg-slate-50/50 gap-6">
          <div className="flex items-center gap-6">
            {!trade && !showTemplateSave && (
              <button onClick={() => setShowTemplateSave(true)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 hover:text-emerald-400 transition-colors">
                <Layout className="w-4 h-4" /> Save as Template
              </button>
            )}
            {showTemplateSave && (
              <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300">
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name..." className={INPUT + " !py-1.5 h-9 w-48 text-xs"} />
                <button onClick={saveAsTemplate} className="px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 text-white">Save</button>
                <button onClick={() => setShowTemplateSave(false)} className="text-xs font-black uppercase tracking-widest text-slate-500">Cancel</button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse mr-2">{error}</p>}
            <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-200 transition-all active:scale-95">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 sm:flex-none px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : (trade ? "Update Trade" : "Initialize Setup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: any, title: string, sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-emerald-500" />
      </div>
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest dark:text-white text-slate-900">{title}</h3>
        {sub && <p className="text-[9px] dark:text-slate-500 text-slate-400 font-bold uppercase tracking-widest mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StrategyChecklist({ strategies, direction, strategyId, checklist, onStrategyChange, onChecklistChange }: any) {
  const currentStratId = strategyId || (strategies.length > 0 ? (strategies.find((s: any) => direction === "long" ? s.id.includes("buy") : s.id.includes("sell"))?.id || strategies[0].id) : "");
  const selected = useMemo(() => checklist ? checklist.split(",").map((t: any) => t.trim()).filter(Boolean) : [], [checklist]);
  const currentStrat = strategies.find((s: any) => s.id === currentStratId) || strategies[0];

  const toggle = (item: string) => {
    const next = selected.includes(item) ? selected.filter((s: any) => s !== item) : [...selected, item];
    onChecklistChange(next.join(", "));
  };

  if (strategies.length === 0) return null;

  return (
    <div className="space-y-6">
      <SectionHeader icon={Target} title="System Strategy" sub="Operational checklist" />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <select value={currentStratId} onChange={(e) => { onStrategyChange(e.target.value); onChecklistChange(""); }} className={clsx(INPUT, "appearance-none pr-10 h-11")}>
              {strategies.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400 pointer-events-none" />
          </div>
          <div className="px-4 py-2.5 rounded-xl dark:bg-slate-800 bg-slate-200 dark:text-emerald-400 text-emerald-600 text-xs font-black tabular-nums border dark:border-emerald-500/20 border-emerald-500/10">
            {selected.length} / {currentStrat?.checklist.length || 0}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentStrat?.checklist.map((item: string) => {
            const isSelected = selected.includes(item);
            return (
              <label key={item} className={clsx("flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group", isSelected ? "dark:border-emerald-500/50 border-emerald-500/50 dark:bg-emerald-500/10 bg-emerald-50" : "dark:border-slate-800 border-slate-100 dark:bg-slate-800/30 bg-slate-50 hover:border-slate-400 dark:hover:border-slate-600")}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(item)} className="w-5 h-5 rounded-lg border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                <span className={clsx("text-xs font-bold transition-colors", isSelected ? "dark:text-emerald-400 text-emerald-600" : "dark:text-slate-500 text-slate-600")}>{item}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TagsInput({ value, onChange, defaultTags = [] }: any) {
  const tags = value ? value.split(",").map((t: any) => t.trim()).filter(Boolean) : [];
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commitTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag].join(", "));
    setInput("");
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Tag} title="Categorization" sub="Metadata tags" />
      <div className="flex flex-wrap gap-2 mb-2">
        {defaultTags.filter((dt: any) => !tags.includes(dt)).map((dt: any) => (
          <button key={dt} type="button" onClick={() => onChange([...tags, dt].join(", "))} className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 border dark:border-slate-700 border-slate-200">+ {dt}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 p-3 rounded-2xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-white focus-within:ring-2 focus-within:ring-emerald-500/50 min-h-[50px] transition-all shadow-inner" onClick={() => inputRef.current?.focus()}>
        {tags.map((tag: string, i: number) => (
          <span key={i} className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
            {tag}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_: any, idx: number) => idx !== i).join(", ")); }} className="hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(input); } }} placeholder={tags.length ? "" : "Add tags..."} className="flex-1 bg-transparent text-sm outline-none dark:text-white" />
      </div>
    </div>
  );
}

function EmotionsInput({ value, onChange }: any) {
  const selected = value ? value.split(",").map((t: any) => t.trim()).filter(Boolean) : [];
  const toggle = (emo: string) => {
    const next = selected.includes(emo) ? selected.filter((s: any) => s !== emo) : [...selected, emo];
    onChange(next.join(", "));
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Smile} title="Mood Tracker" sub="Emotional state" />
      <div className="flex flex-wrap gap-2">
        {["Fear", "Greed", "Fomo", "Anxiety", "Regret", "Frustration", "Calm", "Confident"].map(emo => {
          const isSelected = selected.includes(emo);
          return (
            <button key={emo} type="button" onClick={() => toggle(emo)} className={clsx("px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all", isSelected ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-xl" : "dark:bg-slate-800 bg-slate-50 dark:border-slate-700 border-slate-200 dark:text-slate-500 text-slate-500 hover:border-slate-400")}>
              {emo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
