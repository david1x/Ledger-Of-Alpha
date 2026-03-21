"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Trade, TradeStrategy } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Tag, FileText, Pencil, Trash2, ChevronDown, ChevronUp, LineChart, Search, LayoutGrid, List, Columns, RefreshCw, ShieldCheck, Star, Lightbulb, AlertTriangle, Smile, Plus } from "lucide-react";
import ChecklistRing from "@/components/ChecklistRing";
import { calcRRAchieved, calcPercentReturn, formatHoldDuration } from "@/lib/trade-utils";
import AccountBanner from "@/components/AccountBanner";
import { useRouter } from "next/navigation";
import TradeModal from "@/components/TradeModal";
import MiniChart from "@/components/MiniChart";
import clsx from "clsx";
import TradeTable from "@/components/TradeTable";
import Logo from "@/components/Logo";
import { useAccounts } from "@/lib/account-context";
import { usePrivacy } from "@/lib/privacy-context";

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

export default function JournalPage() {
  const router = useRouter();
  const { accounts, activeAccountId, activeAccount } = useAccounts();
  const [me, setMe] = useState<any>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const [filter, setFilter] = useState<"all" | "with-notes">("all");
  const [symbolQ, setSymbolQ] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [accountSize, setAccountSize] = useState(10000);
  const { hidden, toggleHidden } = usePrivacy();

  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Trade>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [saveError, setSaveError] = useState("");

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

  const displayed = trades.filter((t) => {
    if (filter === "with-notes" && (!t.notes || !t.notes.trim().length)) return false;
    if (symbolQ && !t.symbol.toLowerCase().includes(symbolQ.toLowerCase())) return false;
    if (status !== "all" && t.status !== status) return false;
    if (direction !== "all" && t.direction !== direction) return false;
    return true;
  });

  const selectedTrade = trades.find(t => t.id === selectedTradeId) || displayed[0];

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

  const STATUS_COLOR: Record<string, string> = {
    planned: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
    closed: "bg-slate-500/20 dark:text-slate-400 text-slate-500 border-slate-500/20",
  };

  const mask = "------";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">Trade Journal</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-1 font-medium">Deep reflections and execution audit.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex h-9 rounded-xl dark:bg-slate-800/50 bg-slate-100/50 p-1 border dark:border-slate-800 border-slate-200">
            {[ { id: "cards", icon: LayoutGrid, label: "Cards" }, { id: "list", icon: List, label: "List" }, { id: "review", icon: Columns, label: "Review" } ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id as any)}
                className={clsx("px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all", viewMode === v.id ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-sm" : "dark:text-slate-500 text-slate-500 hover:dark:text-slate-300")}
              >
                <v.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setChartsVisible(v => !v)} className="px-3 h-9 rounded-xl text-xs font-black uppercase tracking-widest dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50 transition-colors flex items-center gap-2 border dark:border-slate-800 border-slate-200">
            {chartsVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Charts
          </button>
          <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-xl dark:bg-slate-800/50 bg-slate-100/50 hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors border dark:border-slate-800 border-slate-200">
            <RefreshCw className={clsx("w-4 h-4 dark:text-slate-400 text-slate-500", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <AccountBanner trades={trades} accountSize={accountSize} hidden={hidden} onToggleHidden={toggleHidden} />

      <div className="rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white p-2 sm:p-3 space-y-3 shadow-sm">
        <div className="flex items-center flex-wrap gap-3">
          <button onClick={toggleAll} className={clsx("flex items-center gap-2 px-3 h-9 rounded-xl border transition-all duration-300", selected.size > 0 ? "dark:bg-emerald-500/10 bg-emerald-50 border-emerald-500/50 shadow-lg shadow-emerald-500/5" : "dark:bg-slate-800/50 bg-slate-50 dark:border-slate-700/50 border-slate-200 hover:border-slate-400")}>
            <div className={clsx("w-4 h-4 rounded-md border flex items-center justify-center transition-colors", displayed.length > 0 && selected.size === displayed.length ? "bg-emerald-500 border-emerald-500" : selected.size > 0 ? "bg-emerald-500/50 border-emerald-500" : "dark:border-slate-600 border-slate-300")}>
              {selected.size > 0 && <div className={clsx("w-1.5 rounded-full bg-white", selected.size === displayed.length ? "h-1.5" : "h-0.5")} />}
            </div>
            <span className={clsx("text-[10px] font-black uppercase tracking-widest", selected.size > 0 ? "text-emerald-400" : "dark:text-slate-500 text-slate-500")}>
              {selected.size > 0 ? `${selected.size} Selected` : "Bulk Select"}
            </span>
            {selected.size > 0 && ( <div onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }} className="ml-2 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></div> )}
          </button>
          <div className="h-6 w-px dark:bg-slate-800 bg-slate-200 mx-1 hidden sm:block" />
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-600 text-slate-400" />
            <input type="text" placeholder="Quick find by symbol..." value={symbolQ} onChange={(e) => setSymbolQ(e.target.value)} className="w-full h-9 pl-10 pr-4 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" />
          </div>
          <div className="flex items-center gap-2">
            {[ { val: filter, set: setFilter, opts: [{l:"All",v:"all"},{l:"Notes",v:"with-notes"}] }, { val: status, set: setStatus, opts: [{l:"Any Status",v:"all"},{l:"Planned",v:"planned"},{l:"Open",v:"open"},{l:"Closed",v:"closed"}] }, { val: direction, set: setDirection, opts: [{l:"Any Side",v:"all"},{l:"Long",v:"long"},{l:"Short",v:"short"}] } ].map((f, i) => (
              <select key={i} value={f.val} onChange={(e) => f.set(e.target.value as any)} className="h-9 px-3 rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 text-[10px] font-black uppercase tracking-widest dark:text-slate-300 text-slate-600 focus:outline-none hover:border-slate-400 transition-all shadow-sm">
                {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      {!loading && (filter !== "all" || symbolQ || status !== "all" || direction !== "all") && displayed.length > 0 && (
        <div className="rounded-xl dark:bg-slate-900/60 bg-slate-50 px-5 py-3 flex items-center gap-6 flex-wrap text-[10px] font-black uppercase tracking-[0.15em] border dark:border-slate-800 border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          <span className="dark:text-slate-500 text-slate-400">Match: {displayed.length}</span>
          {(() => {
            const cls = displayed.filter(t => t.status === "closed");
            const w = cls.filter(t => (t.pnl ?? 0) > 0), l = cls.filter(t => (t.pnl ?? 0) < 0);
            const p = cls.reduce((s, t) => s + (t.pnl ?? 0), 0);
            const wr = cls.length > 0 ? (w.length / cls.length) * 100 : 0;
            return (
              <>
                <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
                <span className="dark:text-slate-400 text-slate-500">P&L</span>
                <span className={p >= 0 ? "text-emerald-400" : "text-red-400"}>{hidden ? mask : (p >= 0 ? "+" : "-") + fmt$(p)}</span>
                <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
                <span className="dark:text-slate-400 text-slate-500">Win Rate</span>
                <span className={wr >= 50 ? "text-emerald-400" : "text-amber-400"}>{hidden ? mask : wr.toFixed(1) + "%"}</span>
                <span className="dark:text-slate-600 text-slate-400">{hidden ? "" : `(${w.length}W / ${l.length}L)`}</span>
              </>
            );
          })()}
        </div>
      )}

      {loading ? (
        <div className="text-center py-24 dark:text-slate-400 text-slate-500 animate-pulse">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em]">Syncing Journal Ledger</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl dark:bg-slate-800/20 bg-slate-50 p-20 text-center border-2 border-dashed dark:border-slate-800 border-slate-200">
          <p className="text-sm font-bold dark:text-slate-500 text-slate-400">No matching history found.</p>
          <button onClick={() => { setSymbolQ(""); setStatus("all"); setDirection("all"); setFilter("all"); }} 
            className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300 transition-colors">Reset Global Filters</button>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 overflow-hidden shadow-xl">
          <TradeTable trades={displayed} selectedIds={selected} onToggleSelect={toggleOne} selectable={true} visibleColumns={["symbol", "direction", "status", "entry", "stop", "target", "pnl", "date"]} onEdit={(t) => { setEditTrade(t); setShowModal(true); }} onDelete={(id) => confirm("Delete this trade?") && fetch(`/api/trades/${id}`, { method: "DELETE" }).then(load)} onSelectAll={(ids) => setSelected(new Set(ids))} />
        </div>
      ) : viewMode === "review" ? (
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-320px)] lg:min-h-[600px]">
          <div className="lg:col-span-4 flex flex-col rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white overflow-hidden max-h-[400px] lg:max-h-full shadow-lg">
            <div className="p-4 border-b dark:border-slate-800 border-slate-100 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400">Entries</span>
              <span className="px-2 py-0.5 rounded-md dark:bg-slate-800 bg-slate-200 text-[10px] font-black tabular-nums dark:text-slate-400 text-slate-500">{displayed.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y dark:divide-slate-800 divide-slate-100 scrollbar-thin">
              {displayed.map((t) => (
                <button key={t.id} onClick={() => setSelectedTradeId(t.id)} className={clsx("w-full p-4 text-left transition-all flex items-center gap-4 group", selectedTradeId === t.id ? "dark:bg-emerald-500/10 bg-emerald-50 border-l-2 border-emerald-500" : "hover:dark:bg-slate-800 hover:bg-slate-50 border-l-2 border-transparent")}>
                  <div className={clsx("w-1.5 h-10 rounded-full shrink-0 transition-transform group-hover:scale-y-110", STATUS_COLOR[t.status].split(" ")[0])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-black dark:text-white text-slate-900 tracking-tight">{t.symbol}</span>
                      <span className={clsx("text-xs font-black tabular-nums", (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${hidden ? mask : t.pnl.toFixed(2)}` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">{t.entry_date ?? t.created_at.slice(0,10)}</span>
                      <span className="text-[9px] font-medium dark:text-slate-600 text-slate-400 truncate ml-2 max-w-[120px]">{t.notes || "No notes"}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white overflow-y-auto p-4 sm:p-10 scrollbar-thin shadow-2xl relative">
            {selectedTrade ? (
              <div className="space-y-10 sm:space-y-12">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 sm:mb-12">
                      <div className="flex items-center gap-5">
                        <div className="h-16 w-16 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 flex items-center justify-center border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/10 shrink-0"><Logo className="w-9 h-9" /></div>
                        <div>
                          <div className="flex items-center gap-3"><h2 className="text-3xl font-black dark:text-white text-slate-900 tracking-tighter">{selectedTrade.symbol}</h2><span className={clsx("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border", STATUS_COLOR[selectedTrade.status])}>{selectedTrade.status}</span></div>
                          <div className="flex items-center gap-3 mt-2 text-[10px] dark:text-slate-400 text-slate-500 font-black uppercase tracking-[0.2em]"><span className={selectedTrade.direction === "long" ? "text-emerald-400" : "text-red-400"}>{selectedTrade.direction}</span><span>•</span><span className="tabular-nums">{selectedTrade.entry_date ?? selectedTrade.created_at.slice(0, 10)}</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button onClick={handleReviewEdit} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95"><Pencil className="w-4 h-4" /> Edit</button>
                        <button onClick={() => router.push(buildChartUrl(selectedTrade))} className="p-3 rounded-xl dark:bg-slate-800 bg-slate-50 hover:dark:bg-slate-700 transition-all border dark:border-slate-800 border-slate-200 active:scale-90" title="Full Chart"><LineChart className="w-5 h-5 dark:text-slate-400 text-slate-500" /></button>
                        <button onClick={handleReviewDelete} className="p-3 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-red-500/10 hover:text-red-400 transition-all border dark:border-slate-800 border-slate-200 active:scale-90" title="Delete"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-12">
                      {[ { label: 'Entry Price', val: selectedTrade.entry_price ? `$${selectedTrade.entry_price}` : "—" }, { label: 'Exit Price', val: selectedTrade.exit_price ? `$${selectedTrade.exit_price}` : "—" }, { label: 'Shares', val: selectedTrade.shares ?? "—" }, { label: 'Net P&L', val: selectedTrade.pnl != null ? `${selectedTrade.pnl >= 0 ? "+" : ""}${hidden ? mask : selectedTrade.pnl.toFixed(2)}` : "—", color: (selectedTrade.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" } ].map((stat, i) => (
                        <div key={i} className="p-6 rounded-xl dark:bg-slate-800/40 bg-slate-50/80 border dark:border-slate-800 border-slate-100 shadow-inner group transition-all hover:dark:bg-slate-800/60">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 mb-3">{stat.label}</p>
                          <p className={clsx("text-xl font-black tabular-nums tracking-tighter", stat.color || "dark:text-white text-slate-900")}>{stat.val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-6 sm:gap-12 p-8 rounded-xl border-2 border-dashed dark:border-slate-800 border-slate-100 mb-10 shadow-sm">
                      {selectedTrade.rating != null && ( <div className="space-y-3"><span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400">Execution Quality</span><div className="flex items-center gap-1.5">{[1,2,3,4,5].map(n => ( <Star key={n} className={clsx("w-5 h-5", n <= selectedTrade.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-200")} /> ))}</div></div> )}
                      {[
                        { l: 'R:R Achieved', val: calcRRAchieved(selectedTrade)?.toFixed(2) + 'R', color: (r:number)=>r>=2?'text-emerald-400':r>=1?'text-blue-400':r>=0?'text-amber-400':'text-red-400', raw: calcRRAchieved(selectedTrade) },
                        { l: '% Return', val: (calcPercentReturn(selectedTrade, accountSize)??0)>=0?'+'+calcPercentReturn(selectedTrade, accountSize)?.toFixed(2)+'%':calcPercentReturn(selectedTrade, accountSize)?.toFixed(2)+'%', color: (r:number)=>r>=0?'text-emerald-400':'text-red-400', raw: calcPercentReturn(selectedTrade, accountSize), hide: hidden },
                        { l: 'Hold Duration', val: formatHoldDuration(selectedTrade.entry_date, selectedTrade.exit_date) }
                      ].map((ind, i) => ind.val && !ind.hide && (
                        <div key={i} className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 block">{ind.l}</span>
                          <span className={clsx("text-2xl font-black tabular-nums tracking-tighter", ind.color ? ind.color(ind.raw as number) : "dark:text-slate-200 text-slate-800")}>{ind.val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-12">
                      {selectedTrade.emotions && ( <div className="space-y-5"><div className="flex items-center gap-3"><Smile className="w-5 h-5 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.25em] dark:text-slate-500 text-slate-400">Emotional Intelligence</h3></div><div className="flex flex-wrap gap-2.5">{selectedTrade.emotions.split(",").map(emo => ( <span key={emo} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest dark:bg-emerald-500/10 bg-emerald-50 text-emerald-400 border border-emerald-500/20 shadow-sm">{emo.trim()}</span> ))}</div></div> )}
                      {selectedTrade.mistakes && ( <div className="space-y-5"><div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-400" /><h3 className="text-[10px] font-black uppercase tracking-[0.25em] dark:text-slate-500 text-slate-400">Correction Areas</h3></div><div className="flex flex-wrap gap-2.5">{selectedTrade.mistakes.split(",").map(m => m.trim()).filter(Boolean).map(m => ( <span key={m} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">{m}</span> ))}</div></div> )}
                    </div>
                    {selectedTrade.lessons && ( <div className="space-y-5 mb-12"><div className="flex items-center gap-3"><Lightbulb className="w-5 h-5 text-amber-400" /><h3 className="text-[10px] font-black uppercase tracking-[0.25em] dark:text-slate-500 text-slate-400">Executive Summary</h3></div><div className="p-8 rounded-xl dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100 shadow-sm"><p className="text-base dark:text-amber-300/90 text-amber-800 leading-relaxed font-medium italic">&ldquo;{selectedTrade.lessons}&rdquo;</p></div></div> )}
                    <div className="space-y-5"><div className="flex items-center gap-3"><FileText className="w-5 h-5 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.25em] dark:text-slate-500 text-slate-400">Reflective Narrative</h3></div><div className="p-10 rounded-xl dark:bg-slate-800/30 bg-slate-50/50 border dark:border-slate-800 border-slate-100 min-h-[250px] shadow-inner">{selectedTrade.notes ? ( <p className="text-base dark:text-slate-300 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{selectedTrade.notes}</p> ) : ( <p className="text-sm dark:text-slate-600 text-slate-400 italic font-medium opacity-50">No reflective narrative captured for this execution event.</p> )}</div></div>
                  </div>
                )}
                {chartsVisible && (
                  <div className="space-y-6 mt-12 pt-12 border-t dark:border-slate-800 border-slate-100">
                    <div className="flex items-center gap-3"><LineChart className="w-5 h-5 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-[0.25em] dark:text-slate-500 text-slate-400">Contextual Replay</h3></div>
                    <div className="rounded-xl overflow-hidden border dark:border-slate-800 border-slate-100 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] relative group">
                      <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
                      <MiniChart symbol={selectedTrade.symbol} entry={selectedTrade.entry_price} stopLoss={selectedTrade.stop_loss} takeProfit={selectedTrade.take_profit} height={450} showPriceScale={true} showTimeframeToggle={true} chartTf={selectedTrade.chart_tf} chartSavedAt={selectedTrade.chart_saved_at} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-xs opacity-30">Select entry to begin review</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((t) => {
            const pnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
            const tags = t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const isSelected = selected.has(t.id);
            const pot = calcPotentialPnl(t);
            return (
              <div key={t.id} className={clsx("rounded-xl dark:bg-slate-900 bg-white p-6 space-y-5 hover:bg-emerald-500/5 transition-all border dark:border-slate-800 border-slate-100 group shadow-sm", isSelected && "ring-2 ring-emerald-500")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={clsx("transition-opacity duration-300 mt-1", !isSelected && selected.size === 0 ? "opacity-0 group-hover:opacity-100" : "opacity-100")}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(t.id)} className="w-5 h-5 rounded-lg border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0 transition-transform active:scale-90" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3"><span className="font-black text-emerald-400 text-xl cursor-pointer hover:underline tracking-tight" onClick={() => { setEditTrade(t); setShowModal(true); }}>{t.symbol}</span><span className={clsx("px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border", STATUS_COLOR[t.status])}>{t.status}</span></div>
                      <div className="flex items-center gap-2 mt-1">{t.direction === "long" ? <span className="flex items-center text-[10px] font-black uppercase text-emerald-400 gap-1"><ArrowUpRight className="w-3 h-3" />Long</span> : <span className="flex items-center text-[10px] font-black uppercase text-red-400 gap-1"><ArrowDownRight className="w-3 h-3" />Short</span>}<span className="text-[10px] font-bold dark:text-slate-500 text-slate-400 tabular-nums">{t.entry_date ?? t.created_at.slice(0, 10)}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ChecklistRing checklistState={t.checklist_state} size={26} />
                    <button onClick={() => router.push(buildChartUrl(t))} className="p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors" title="Open Chart"><LineChart className="w-4 h-4 dark:text-slate-400 text-slate-500" /></button>
                    <button onClick={() => { setEditTrade(t); setShowModal(true); }} className="p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors" title="Edit"><Pencil className="w-4 h-4 dark:text-slate-400 text-slate-500" /></button>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t dark:border-slate-800 border-slate-50 pt-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col"><span className="text-[9px] font-black uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5">Entry</span><span className="font-bold dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] font-black uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5">Risk</span><span className="font-bold text-red-400">{t.stop_loss ? `$${t.stop_loss}` : "—"}</span></div>
                  </div>
                  {t.pnl !== null && ( <div className="text-right"><span className="text-[9px] font-black uppercase tracking-widest dark:text-slate-600 text-slate-400 mb-0.5 block">Result</span><span className={clsx("text-lg font-black tabular-nums", pnlColor)}>{t.pnl >= 0 ? "+" : ""}{hidden ? mask : t.pnl.toFixed(2)}</span></div> )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {t.rating != null && ( <div className="flex items-center gap-0.5 mr-1">{[1,2,3,4,5].map(n => ( <Star key={n} className={clsx("w-3.5 h-3.5", n <= t.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-200")} /> ))}</div> )}
                  {(() => { const rr = calcRRAchieved(t); return rr !== null ? ( <span className={clsx("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border", rr >= 2 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : rr >= 1 ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : rr >= 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>{rr.toFixed(2)}R</span> ) : null; })()}
                  {(() => { const pct = calcPercentReturn(t, accountSize); return pct !== null && !hidden ? ( <span className={clsx("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border", pct >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span> ) : null; })()}
                </div>
                {t.lessons && ( <div className="flex items-start gap-3 p-4 rounded-xl dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100"><Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /><p className="text-xs dark:text-amber-300/80 text-amber-700 leading-relaxed font-medium italic line-clamp-2">{t.lessons}</p></div> )}
                {t.notes ? ( <div className="rounded-xl dark:bg-slate-800 bg-slate-50 p-4 text-xs dark:text-slate-300 text-slate-600 leading-relaxed font-medium line-clamp-3 shadow-inner">{t.notes}</div> ) : ( <div className="rounded-xl dark:bg-slate-800/50 bg-slate-50 p-4 text-xs dark:text-slate-600 text-slate-400 italic font-medium opacity-50 shadow-inner">Reflection notes pending...</div> )}
                {tags.length > 0 && ( <div className="flex flex-wrap gap-2 pt-1">{tags.map((tag) => ( <span key={tag} className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 border dark:border-slate-700 border-slate-200">{tag}</span> ))}</div> )}
                {chartsVisible && (
                  <div className="space-y-4 pt-4 border-t dark:border-slate-800 border-slate-50">
                    {pot && ( <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest dark:text-slate-500 text-slate-400"><span>Projected Range:</span><div className="flex gap-3">{pot.profit != null && ( <span className="text-emerald-400">+${pot.profit.toFixed(0)}</span> )}{pot.loss != null && ( <span className="text-red-400">-${Math.abs(pot.loss).toFixed(0)}</span> )}</div></div> )}
                    <div className="rounded-xl overflow-hidden border dark:border-slate-800 border-slate-100 shadow-md"><MiniChart symbol={t.symbol} entry={t.entry_price} stopLoss={t.stop_loss} takeProfit={t.take_profit} height={180} chartTf={t.chart_tf} chartSavedAt={t.chart_saved_at} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showModal && ( <TradeModal trade={editTrade} onClose={() => { setShowModal(false); setEditTrade(null); }} onSaved={load} /> )}
    </div>
  );
}
