"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Trade, TradeStrategy, TradeFilterState, DEFAULT_FILTER } from "@/lib/types";
import { FileText, Pencil, Trash2, LineChart, LayoutGrid, List, Columns, RefreshCw, ShieldCheck, Star, Lightbulb, AlertTriangle, Smile, X } from "lucide-react";
import ChecklistRing from "@/components/ChecklistRing";
import { calcRRAchieved, calcPercentReturn, formatHoldDuration } from "@/lib/trade-utils";
import { useRouter } from "next/navigation";
import TradeModal from "@/components/TradeModal";
import MiniChart from "@/components/MiniChart";
import clsx from "clsx";
import TradeTable from "@/components/TradeTable";
import Logo from "@/components/Logo";
import { useAccounts } from "@/lib/account-context";
import { usePrivacy } from "@/lib/privacy-context";
import TradeFilterBar from "@/components/trades/TradeFilterBar";
import TradingViewIcon from "@/components/TradingViewIcon";

type ViewMode = "cards" | "list" | "review";

function calcPotentialPnl(t: Trade) {
  if (t.status === "closed") return null;
  if (t.entry_price == null) return null;
  const shares = t.shares ?? 1;
  const comm = (t.commission ?? 0) * 2;
  const profit =
    t.take_profit != null
      ? Math.abs(t.take_profit - t.entry_price) * shares - comm
      : null;
  const loss =
    t.stop_loss != null
      ? -(Math.abs(t.stop_loss - t.entry_price) * shares + comm)
      : null;
  if (profit == null && loss == null) return null;
  const rr = profit != null && loss != null && loss !== 0
    ? Math.abs(profit / loss)
    : null;
  return { profit, loss, rr };
}

function buildChartUrl(t: Trade): string {
  const params = new URLSearchParams({ symbol: t.symbol });
  if (t.entry_price != null) params.set("entry", String(t.entry_price));
  if (t.stop_loss != null) params.set("stop", String(t.stop_loss));
  if (t.take_profit != null) params.set("target", String(t.take_profit));
  if (t.direction) params.set("direction", t.direction);
  if (t.status) params.set("status", t.status);
  return `/chart?${params}`;
}

function fmt$(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

function applyFilter(trades: Trade[], filter: TradeFilterState): Trade[] {
  return trades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    if (filter.symbols && filter.symbols.length > 0) {
      if (!filter.symbols.includes(t.symbol.toUpperCase())) return false;
    } else if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) {
      return false;
    }
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false;
    if (filter.dateTo && t.exit_date && t.exit_date > filter.dateTo) return false;
    if (filter.tags.length > 0) {
      const tradeTags = t.tags ? t.tags.split(",").map(s => s.trim()) : [];
      if (!filter.tags.some(ft => tradeTags.includes(ft))) return false;
    }
    if (filter.mistakeId) {
      const ids = t.mistake_tag_ids ? t.mistake_tag_ids.split(",") : [];
      if (!ids.includes(filter.mistakeId)) return false;
    }
    if (filter.accountId && t.account_id !== filter.accountId) return false;
    return true;
  });
}

function isFilterActive(filter: TradeFilterState): boolean {
  return (
    filter.status !== "all" ||
    filter.direction !== "all" ||
    filter.pnlFilter !== "all" ||
    (filter.symbols != null && filter.symbols.length > 0) ||
    (filter.symbol !== "" && filter.symbol !== DEFAULT_FILTER.symbol) ||
    filter.dateFrom !== null ||
    filter.dateTo !== null ||
    filter.tags.length > 0 ||
    filter.mistakeId !== null ||
    filter.accountId !== null
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function JournalPage() {
  const router = useRouter();
  const { accounts, activeAccountId, activeAccount } = useAccounts();
  const [me, setMe] = useState<any>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [filter, setFilter] = useState<TradeFilterState>({ ...DEFAULT_FILTER, status: "closed" });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("review");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [accountSize, setAccountSize] = useState(10000);
  const { hidden, toggleHidden } = usePrivacy();

  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Trade>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [saveError, setSaveError] = useState("");

  const updateFilter = (partial: Partial<TradeFilterState>) => {
    setFilter(prev => ({ ...prev, ...partial }));
  };

  const load = async () => {
    setLoading(true);
    try {
      const tradesUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
      const [tradesRes, settingsRes, meRes] = await Promise.all([
        fetch(tradesUrl),
        fetch("/api/settings"),
        fetch("/api/auth/me"),
      ]);
      const data = await tradesRes.json();
      const settingsData = await settingsRes.json();
      const meData = await meRes.json();

      setMe(meData);
      if (Array.isArray(data)) {
        setTrades(data);
        if (data.length > 0 && selectedTradeId === null) setSelectedTradeId(data[0].id);
      }
      if (activeAccount) {
        setAccountSize(activeAccount.starting_balance);
      } else if (accounts.length > 0) {
        setAccountSize(accounts.reduce((sum, a) => sum + a.starting_balance, 0));
      } else if (settingsData.account_size) {
        setAccountSize(parseFloat(settingsData.account_size));
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeAccountId, accounts.length]);

  const displayed = applyFilter(trades, filter);

  const selectedTrade = trades.find(t => t.id === selectedTradeId) || displayed[0];

  const hasFilter = isFilterActive(filter);

  const clearAllFilters = () => {
    setFilter(DEFAULT_FILTER);
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === displayed.length) setSelected(new Set());
    else setSelected(new Set(displayed.map(t => t.id)));
  };

  const handleReviewEdit = () => {
    if (!selectedTrade) return;
    setEditFormData({ ...selectedTrade });
    setIsEditingReview(true);
    setSaveError("");
  };

  const handleReviewSave = async () => {
    if (!selectedTrade || !editFormData) return;
    setSavingReview(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/trades/${selectedTrade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        setIsEditingReview(false);
        await load();
      } else {
        const d = await res.json();
        setSaveError(d.error || "Failed to save changes.");
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError("A network error occurred.");
    } finally {
      setSavingReview(false);
    }
  };

  const handleReviewDelete = async () => {
    if (!selectedTrade) return;
    if (!confirm("Delete this trade?")) return;
    try {
      const res = await fetch(`/api/trades/${selectedTrade.id}`, { method: "DELETE" });
      if (res.ok) { await load(); } else { const d = await res.json(); alert(d.error || "Failed to delete trade."); }
    } catch { alert("A network error occurred."); }
  };

  const toggleReviewEmotion = (emo: string) => {
    const selected = editFormData.emotions ? editFormData.emotions.split(",").map(t => t.trim()).filter(Boolean) : [];
    const next = selected.includes(emo) ? selected.filter(s => s !== emo) : [...selected, emo];
    setEditFormData({ ...editFormData, emotions: next.join(", ") });
  };

  const EMOTIONS = ["Fear", "Greed", "Fomo", "Anxiety", "Regret", "Frustration", "Calm", "Confident"];

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} trade${selected.size > 1 ? "s" : ""}?`)) return;
    try {
      const res = await fetch("/api/trades", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) { setSelected(new Set()); await load(); }
      else { const d = await res.json(); alert(d.error || "Failed to delete trades."); }
    } catch { alert("A network error occurred."); }
  };

  const mask = "------";

  return (
    <div className="flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden" style={{ height: "100vh" }}>
      {/* Filter bar — identical to trades page */}
      <div className="px-6 flex items-center h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* View mode toggle */}
          <div className="flex h-9 rounded-md dark:bg-slate-800/40 bg-slate-200/40 p-0.5">
            {[
              { id: "review", icon: Columns, label: "Review" },
              { id: "cards", icon: LayoutGrid, label: "Cards" },
              { id: "list", icon: List, label: "List" },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id as ViewMode)}
                className={clsx("px-2.5 rounded flex items-center gap-1.5 text-xs font-medium transition-all", viewMode === v.id ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-sm" : "dark:text-slate-500 text-slate-500 hover:dark:text-slate-300")}
              >
                <v.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          <div className="h-6 w-px dark:bg-slate-700 bg-slate-300 mx-1 hidden sm:block" />

          <TradeFilterBar
            filter={filter}
            onFilterChange={updateFilter}
            allTrades={trades}
            accounts={accounts}
            activeAccountId={activeAccountId}
            isGuest={me?.guest ?? true}
          />

          {hasFilter && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 h-9 px-2.5 rounded-md text-xs font-medium text-slate-400 hover:text-red-400 hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors whitespace-nowrap"
              title="Clear all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button onClick={() => setChartsVisible(v => !v)} className={clsx("h-9 w-9 flex items-center justify-center rounded-md transition-colors relative group", chartsVisible ? "dark:text-emerald-400 text-emerald-600" : "dark:text-slate-500 text-slate-400 hover:dark:bg-slate-800 hover:bg-slate-200/60 dark:bg-slate-800/40 bg-slate-200/40")}>
            <LineChart className="w-4 h-4" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 text-white shadow-xl ring-1 ring-slate-700/50 whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-100 z-50">
              {chartsVisible ? "Hide Charts" : "Show Charts"}
            </span>
          </button>
          <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-md dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-200/60 dark:bg-slate-800/40 bg-slate-200/40 transition-colors relative group">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 text-white shadow-xl ring-1 ring-slate-700/50 whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-100 z-50">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center dark:text-slate-400 text-slate-500 animate-pulse">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]">Syncing Journal Ledger</p>
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-bold dark:text-slate-500 text-slate-400">No matching trades found.</p>
              {hasFilter && (
                <button onClick={clearAllFilters}
                  className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300 transition-colors">Reset Filters</button>
              )}
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="h-full overflow-auto p-6">
            <div className="rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 overflow-hidden shadow-xl">
              <TradeTable trades={displayed} selectedIds={selected} onToggleSelect={toggleOne} selectable={true} visibleColumns={["symbol", "direction", "status", "entry", "stop", "target", "pnl", "date"]} onEdit={(t) => { setEditTrade(t); setShowModal(true); }} onDelete={(id) => confirm("Delete this trade?") && fetch(`/api/trades/${id}`, { method: "DELETE" }).then(load)} onSelectAll={(ids) => setSelected(new Set(ids))} />
            </div>
          </div>
        ) : viewMode === "review" ? (
          <div className="h-full flex flex-col lg:flex-row gap-0 overflow-hidden">
            {/* Entries sidebar */}
            <div className="lg:w-[340px] shrink-0 flex flex-col border-r dark:border-slate-800 border-slate-200 max-h-[300px] lg:max-h-full overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-slate-800 border-slate-100 flex items-center justify-between shrink-0 dark:bg-slate-900/50 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400">Entries</span>
                <span className="px-2 py-0.5 rounded-md dark:bg-slate-800 bg-slate-200 text-[10px] font-black tabular-nums dark:text-slate-400 text-slate-500">{displayed.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y dark:divide-slate-800/50 divide-slate-100 scrollbar-thin">
                {displayed.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTradeId(t.id)} className={clsx("w-full px-4 py-3 text-left transition-all flex items-center gap-3 group", selectedTradeId === t.id ? "dark:bg-emerald-500/10 bg-emerald-50 border-l-2 border-emerald-500" : "hover:dark:bg-slate-800/50 hover:bg-slate-50 border-l-2 border-transparent")}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-violet-400 tracking-tight text-sm">{t.symbol}</span>
                          <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-semibold ring-1 ring-inset",
                            t.direction === "long" ? "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" : "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30"
                          )}>
                            {t.direction === "long" ? "Long" : "Short"}
                          </span>
                        </div>
                        <span className={clsx("text-xs font-bold tabular-nums", (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${hidden ? mask : t.pnl.toFixed(2)}` : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium dark:text-slate-500 text-slate-400 tabular-nums">{t.entry_date ?? t.created_at.slice(0,10)}</span>
                        <span className="text-[10px] dark:text-slate-600 text-slate-400 truncate ml-2 max-w-[100px]">{t.notes ? "Has notes" : ""}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Review panel */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-thin">
              {selectedTrade ? (
                <div className="space-y-6">
                  {isEditingReview ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {me?.guest && ( <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Guest Mode: Preview Only</div> )}
                      {saveError && ( <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">{saveError}</div> )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 flex items-center justify-center font-black text-xl text-emerald-500 border border-emerald-500/20 shadow-xl shadow-emerald-500/5">{selectedTrade.symbol[0]}</div>
                          <div><h2 className="text-2xl font-black dark:text-white text-slate-900 tracking-tighter">{selectedTrade.symbol}</h2><p className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400">Refining entry data</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setIsEditingReview(false)} className="flex-1 sm:flex-none px-6 h-11 rounded-xl border dark:border-slate-700 border-slate-200 dark:text-slate-300 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:dark:bg-slate-800 transition-all">Cancel</button>
                          <button onClick={handleReviewSave} disabled={savingReview} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 h-11 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">{savingReview ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Updates"}</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t dark:border-slate-800 border-slate-100">
                        {[ { label: 'Lifecycle Status', key: 'status', opts: [{l:'Planned',v:'planned'},{l:'Open',v:'open'},{l:'Closed',v:'closed'}] }, { label: 'Trade Direction', key: 'direction', opts: [{l:'Long',v:'long'},{l:'Short',v:'short'}] } ].map(f => (
                          <div key={f.key} className="space-y-2"><label className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 ml-1">{f.label}</label><select value={(editFormData as any)[f.key]} onChange={(e) => setEditFormData({...editFormData, [f.key]: e.target.value as any})} className="w-full h-12 px-4 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm">{f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[ { label: 'Entry', key: 'entry_price' }, { label: 'Stop Loss', key: 'stop_loss' }, { label: 'Target', key: 'take_profit' }, { label: 'Shares', key: 'shares' } ].map(f => (
                          <div key={f.key} className="space-y-2"><label className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 ml-1">{f.label}</label><input type="number" step="any" value={(editFormData as any)[f.key] ?? ""} onChange={(e) => setEditFormData({...editFormData, [f.key]: parseFloat(e.target.value) || 0})} className="w-full h-12 px-4 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm" /></div>
                        ))}
                      </div>
                      <div className="space-y-4 pt-6 border-t dark:border-slate-800 border-slate-100"><label className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 ml-1">Journal Reflection</label><textarea rows={8} value={editFormData.notes ?? ""} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} placeholder="Describe the setup..." className="w-full p-6 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm leading-relaxed font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none transition-all shadow-inner" /></div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5 shrink-0"><Logo className="w-7 h-7" /></div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h2 className="text-2xl font-black text-violet-400 tracking-tighter">{selectedTrade.symbol}</h2>
                              <span className={clsx("px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset",
                                selectedTrade.status === "open" ? "bg-yellow-500/15 dark:text-white text-slate-900 ring-yellow-500/30" :
                                selectedTrade.status === "planned" ? "bg-blue-500/15 dark:text-white text-slate-900 ring-blue-500/30" :
                                (selectedTrade.pnl ?? 0) > 0 ? "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" :
                                (selectedTrade.pnl ?? 0) < 0 ? "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30" :
                                "bg-slate-500/15 dark:text-slate-300 text-slate-600 ring-slate-500/30"
                              )}>
                                {selectedTrade.status === "closed" ? ((selectedTrade.pnl ?? 0) > 0 ? "Win" : (selectedTrade.pnl ?? 0) < 0 ? "Loss" : "BE") : capitalize(selectedTrade.status)}
                              </span>
                              <span className={clsx("px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-semibold", selectedTrade.direction === "long" ? "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" : "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30")}>{selectedTrade.direction === "long" ? "Long" : "Short"}</span>
                            </div>
                            <span className="text-[10px] dark:text-slate-500 text-slate-400 font-medium tabular-nums mt-1 block">{selectedTrade.entry_date ?? selectedTrade.created_at.slice(0, 10)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleReviewEdit} className="flex items-center gap-2 px-5 h-9 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-95"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                          <button onClick={() => router.push(buildChartUrl(selectedTrade))} className="h-9 w-9 flex items-center justify-center rounded-md dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 transition-all border dark:border-slate-700 border-slate-200" title="Full Chart"><LineChart className="w-4 h-4 dark:text-slate-400 text-slate-500" /></button>
                          <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(selectedTrade.symbol)}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 flex items-center justify-center rounded-md dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 transition-all border dark:border-slate-700 border-slate-200" title="Open in TradingView"><TradingViewIcon className="w-4 h-4 dark:text-slate-400 text-slate-500" /></a>
                          <button onClick={handleReviewDelete} className="h-9 w-9 flex items-center justify-center rounded-md dark:bg-slate-800 bg-slate-100 hover:bg-red-500/10 hover:text-red-400 transition-all border dark:border-slate-700 border-slate-200" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {/* Row 1: two columns — data left, reflection right */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Left — stats, metrics, emotions/mistakes */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Entry Price', val: selectedTrade.entry_price ? `$${selectedTrade.entry_price}` : "—" },
                              { label: 'Exit Price', val: selectedTrade.exit_price ? `$${selectedTrade.exit_price}` : "—" },
                              { label: 'Shares', val: selectedTrade.shares ?? "—" },
                              { label: 'Net P&L', val: selectedTrade.pnl != null ? `${selectedTrade.pnl >= 0 ? "+" : ""}${hidden ? mask : selectedTrade.pnl.toFixed(2)}` : "—", color: (selectedTrade.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" }
                            ].map((stat, i) => (
                              <div key={i} className="p-3 rounded-xl dark:bg-slate-800/40 bg-slate-50/80 border dark:border-slate-800 border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400 mb-1">{stat.label}</p>
                                <p className={clsx("text-base font-black tabular-nums tracking-tight", stat.color || "dark:text-white text-slate-900")}>{stat.val}</p>
                              </div>
                            ))}
                          </div>

                          {/* Metrics row */}
                          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/20 bg-slate-50/50">
                            {[
                              { l: 'R:R', val: calcRRAchieved(selectedTrade)?.toFixed(2) + 'R', color: (r:number)=>r>=2?'text-emerald-400':r>=1?'text-blue-400':r>=0?'text-amber-400':'text-red-400', raw: calcRRAchieved(selectedTrade) },
                              { l: 'Return', val: (calcPercentReturn(selectedTrade, accountSize)??0)>=0?'+'+calcPercentReturn(selectedTrade, accountSize)?.toFixed(2)+'%':calcPercentReturn(selectedTrade, accountSize)?.toFixed(2)+'%', color: (r:number)=>r>=0?'text-emerald-400':'text-red-400', raw: calcPercentReturn(selectedTrade, accountSize), hide: hidden },
                              { l: 'Duration', val: formatHoldDuration(selectedTrade.entry_date, selectedTrade.exit_date) }
                            ].map((ind, i) => ind.val && !ind.hide && (
                              <div key={i} className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400 block">{ind.l}</span>
                                <span className={clsx("text-base font-black tabular-nums tracking-tight", ind.color ? ind.color(ind.raw as number) : "dark:text-slate-200 text-slate-800")}>{ind.val}</span>
                              </div>
                            ))}
                          </div>

                          {/* Rating + Emotions + Mistakes — side by side in cards */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Rating + Emotions card */}
                            <div className="p-4 rounded-xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/20 bg-slate-50/50 space-y-3">
                              {selectedTrade.rating != null && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2"><Star className="w-3.5 h-3.5 text-amber-400" /><span className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Rating</span></div>
                                  <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(n => ( <Star key={n} className={clsx("w-4 h-4", n <= selectedTrade.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-200")} /> ))}</div>
                                </div>
                              )}
                              {selectedTrade.emotions && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2"><Smile className="w-3.5 h-3.5 text-emerald-500" /><span className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Emotions</span></div>
                                  <div className="flex flex-wrap gap-1.5">{selectedTrade.emotions.split(",").map(emo => ( <span key={emo} className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest dark:bg-emerald-500/10 bg-emerald-50 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">{emo.trim()}</span> ))}</div>
                                </div>
                              )}
                              {!selectedTrade.rating && !selectedTrade.emotions && (
                                <p className="text-xs dark:text-slate-600 text-slate-400 italic">No rating or emotions</p>
                              )}
                            </div>

                            {/* Mistakes card */}
                            <div className="p-4 rounded-xl border dark:border-slate-800 border-slate-100 dark:bg-slate-800/20 bg-slate-50/50">
                              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /><span className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Mistakes</span></div>
                              {selectedTrade.mistakes ? (
                                <div className="flex flex-wrap gap-1.5">{selectedTrade.mistakes.split(",").map(m => m.trim()).filter(Boolean).map(m => ( <span key={m} className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20">{m}</span> ))}</div>
                              ) : (
                                <p className="text-xs dark:text-slate-600 text-slate-400 italic">No mistakes tagged</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right — reflection & lessons */}
                        <div className="flex flex-col gap-4">
                          {selectedTrade.lessons && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2"><Lightbulb className="w-3.5 h-3.5 text-amber-400" /><h3 className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Key Takeaway</h3></div>
                              <div className="p-5 rounded-xl dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100">
                                <p className="text-sm dark:text-amber-300/90 text-amber-800 leading-relaxed font-medium italic">&ldquo;{selectedTrade.lessons}&rdquo;</p>
                              </div>
                            </div>
                          )}
                          <div className="space-y-2 flex-1 flex flex-col">
                            <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Reflection</h3></div>
                            <div className="p-6 rounded-xl dark:bg-slate-800/30 bg-slate-50/50 border dark:border-slate-800 border-slate-100 flex-1">
                              {selectedTrade.notes ? (
                                <p className="text-sm dark:text-slate-300 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{selectedTrade.notes}</p>
                              ) : (
                                <p className="text-sm dark:text-slate-600 text-slate-400 italic font-medium opacity-50">No reflection captured for this trade.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: full-width chart */}
                      {chartsVisible && (
                        <div className="space-y-3 mt-6">
                          <div className="flex items-center gap-2"><LineChart className="w-3.5 h-3.5 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.15em] dark:text-slate-500 text-slate-400">Chart Replay</h3></div>
                          <div className="rounded-xl overflow-hidden border dark:border-slate-800 border-slate-100 shadow-lg">
                            <MiniChart
                              key={selectedTrade.id}
                              symbol={selectedTrade.symbol}
                              entry={selectedTrade.entry_price}
                              exitPrice={selectedTrade.status === "closed" ? selectedTrade.exit_price : null}
                              stopLoss={selectedTrade.status === "closed" ? null : selectedTrade.stop_loss}
                              takeProfit={selectedTrade.status === "closed" ? null : selectedTrade.take_profit}
                              height={400}
                              showPriceScale={true}
                              showTimeframeToggle={true}
                              chartTf={selectedTrade.chart_tf}
                              chartSavedAt={selectedTrade.chart_saved_at}
                              entryDate={selectedTrade.entry_date}
                              exitDate={selectedTrade.exit_date}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-medium text-sm opacity-50">Select a trade to review</div>
              )}
            </div>
          </div>
        ) : (
          /* Cards view */
          <div className="h-full overflow-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayed.map((t) => {
                const pnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
                const tags = t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
                const isSelected = selected.has(t.id);
                const pot = calcPotentialPnl(t);
                return (
                  <div key={t.id} className={clsx("rounded-xl dark:bg-slate-900 bg-white p-5 space-y-4 hover:bg-emerald-500/5 transition-all border dark:border-slate-800 border-slate-200 group shadow-sm", isSelected && "ring-2 ring-emerald-500")}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={clsx("transition-opacity duration-300 mt-1", !isSelected && selected.size === 0 ? "opacity-0 group-hover:opacity-100" : "opacity-100")}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleOne(t.id)} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-violet-400 text-lg cursor-pointer hover:underline tracking-tight" onClick={() => { setEditTrade(t); setShowModal(true); }}>{t.symbol}</span>
                            <span className={clsx("px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset",
                              t.status === "open" ? "bg-yellow-500/15 dark:text-white text-slate-900 ring-yellow-500/30" :
                              t.status === "planned" ? "bg-blue-500/15 dark:text-white text-slate-900 ring-blue-500/30" :
                              "bg-slate-500/15 dark:text-slate-300 text-slate-600 ring-slate-500/30"
                            )}>{t.status}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-semibold ring-1 ring-inset", t.direction === "long" ? "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" : "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30")}>{t.direction === "long" ? "Long" : "Short"}</span>
                            <span className="text-[10px] font-medium dark:text-slate-500 text-slate-400 tabular-nums">{t.entry_date ?? t.created_at.slice(0, 10)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ChecklistRing checklistState={t.checklist_state} size={24} />
                        <button onClick={() => router.push(buildChartUrl(t))} className="p-1.5 rounded-md hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors" title="Chart"><LineChart className="w-4 h-4 dark:text-slate-400 text-slate-500" /></button>
                        <button onClick={() => { setEditTrade(t); setShowModal(true); }} className="p-1.5 rounded-md hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors" title="Edit"><Pencil className="w-4 h-4 dark:text-slate-400 text-slate-500" /></button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t dark:border-slate-800 border-slate-100 pt-3">
                      <div className="flex gap-4">
                        <div className="flex flex-col"><span className="text-[9px] font-bold uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5">Entry</span><span className="font-medium dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</span></div>
                        <div className="flex flex-col"><span className="text-[9px] font-bold uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5">Risk</span><span className="font-medium text-red-400">{t.stop_loss ? `$${t.stop_loss}` : "—"}</span></div>
                      </div>
                      {t.pnl !== null && ( <div className="text-right"><span className="text-[9px] font-bold uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5 block">Result</span><span className={clsx("text-lg font-black tabular-nums", pnlColor)}>{t.pnl >= 0 ? "+" : ""}{hidden ? mask : t.pnl.toFixed(2)}</span></div> )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {t.rating != null && ( <div className="flex items-center gap-0.5 mr-1">{[1,2,3,4,5].map(n => ( <Star key={n} className={clsx("w-3 h-3", n <= t.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-200")} /> ))}</div> )}
                      {(() => { const rr = calcRRAchieved(t); return rr !== null ? ( <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-semibold ring-1 ring-inset", rr >= 2 ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : rr >= 1 ? "bg-blue-500/10 text-blue-400 ring-blue-500/20" : rr >= 0 ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" : "bg-red-500/10 text-red-400 ring-red-500/20")}>{rr.toFixed(2)}R</span> ) : null; })()}
                      {(() => { const pct = calcPercentReturn(t, accountSize); return pct !== null && !hidden ? ( <span className={clsx("px-1.5 py-0.5 rounded-md text-[9px] font-semibold ring-1 ring-inset", pct >= 0 ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-red-500/10 text-red-400 ring-red-500/20")}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span> ) : null; })()}
                    </div>

                    {t.lessons && ( <div className="flex items-start gap-2 p-3 rounded-xl dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100"><Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /><p className="text-xs dark:text-amber-300/80 text-amber-700 leading-relaxed font-medium italic line-clamp-2">{t.lessons}</p></div> )}
                    {t.notes ? ( <div className="rounded-xl dark:bg-slate-800/50 bg-slate-50 p-3 text-xs dark:text-slate-300 text-slate-600 leading-relaxed font-medium line-clamp-3">{t.notes}</div> ) : ( <div className="rounded-xl dark:bg-slate-800/30 bg-slate-50 p-3 text-xs dark:text-slate-600 text-slate-400 italic font-medium opacity-50">No notes...</div> )}
                    {tags.length > 0 && ( <div className="flex flex-wrap gap-1.5 pt-1">{tags.map((tag) => ( <span key={tag} className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 ring-1 ring-inset dark:ring-slate-700 ring-slate-200">{tag}</span> ))}</div> )}
                    {chartsVisible && (
                      <div className="space-y-3 pt-3 border-t dark:border-slate-800 border-slate-100">
                        {pot && ( <div className="flex items-center justify-between text-[10px] font-bold dark:text-slate-500 text-slate-400"><span>Projected:</span><div className="flex gap-2">{pot.profit != null && ( <span className="text-emerald-400">+${pot.profit.toFixed(0)}</span> )}{pot.loss != null && ( <span className="text-red-400">-${Math.abs(pot.loss).toFixed(0)}</span> )}</div></div> )}
                        <div className="rounded-xl overflow-hidden border dark:border-slate-800 border-slate-100"><MiniChart symbol={t.symbol} entry={t.entry_price} stopLoss={t.stop_loss} takeProfit={t.take_profit} height={180} chartTf={t.chart_tf} chartSavedAt={t.chart_saved_at} /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-6 py-2 shrink-0 border-t dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-50 flex items-center gap-3">
          <span className="text-sm dark:text-slate-300 text-slate-700 font-medium">{selected.size} selected</span>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs dark:text-slate-400 text-slate-500 hover:dark:text-white transition-colors ml-auto">Clear</button>
        </div>
      )}

      {showModal && ( <TradeModal trade={editTrade} onClose={() => { setShowModal(false); setEditTrade(null); }} onSaved={load} /> )}
    </div>
  );
}
