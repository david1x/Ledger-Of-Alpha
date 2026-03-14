"use client";
import { useEffect, useState } from "react";
import { Trade } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Tag, FileText, Pencil, Trash2, ChevronDown, ChevronUp, LineChart, ExternalLink, Search, LayoutGrid, List, Columns, RefreshCw, ShieldCheck, Star, Lightbulb, AlertTriangle } from "lucide-react";
import { calcRRAchieved, calcPercentReturn, formatHoldDuration } from "@/lib/trade-utils";
import AccountBanner from "@/components/AccountBanner";
import { useRouter } from "next/navigation";
import TradeModal from "@/components/TradeModal";
import MiniChart from "@/components/MiniChart";
import clsx from "clsx";
import TradeTable from "@/components/TradeTable";
import Logo from "@/components/Logo";

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

export default function JournalPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filters
  const [filter, setFilter] = useState<"all" | "with-notes">("all");
  const [symbolQ, setSymbolQ] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [chartsVisible, setChartsVisible] = useState(true);
  const [accountSize, setAccountSize] = useState(10000);
  const [hidden, setHidden] = useState(false);

  // Review Mode Inline Editing
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Trade>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Privacy persistence ──
  useEffect(() => {
    const saved = localStorage.getItem("privacy_hidden");
    if (saved === "true") setHidden(true);
    if (saved === "false") setHidden(false);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "privacy_hidden") setHidden(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const load = async () => {
    setLoading(true);
    const [tradesRes, settingsRes, meRes] = await Promise.all([
      fetch("/api/trades"),
      fetch("/api/settings"),
      fetch("/api/auth/me"),
    ]);
    const data = await tradesRes.json();
    const settingsData = await settingsRes.json();
    const meData = await meRes.json();
    
    setMe(meData);
    if (Array.isArray(data)) {
      setTrades(data);
      if (data.length > 0) setSelectedTradeId(data[0].id);
    }
    if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));

    // Check privacy mode if not explicitly set in localStorage
    if (localStorage.getItem("privacy_hidden") === null && settingsData.privacy_mode) {
      setHidden(settingsData.privacy_mode === "hidden");
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
      if (res.ok) {
        await load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete trade.");
      }
    } catch {
      alert("A network error occurred.");
    }
  };

  const toggleReviewEmotion = (emo: string) => {
    const selected = editFormData.emotions ? editFormData.emotions.split(",").map(t => t.trim()).filter(Boolean) : [];
    let next: string[];
    if (selected.includes(emo)) {
      next = selected.filter(s => s !== emo);
    } else {
      next = [...selected, emo];
    }
    setEditFormData({ ...editFormData, emotions: next.join(", ") });
  };

  const EMOTIONS = [
    "Fear", "Greed", "Frustration", "Impatience", "FOMO", 
    "Overconfidence", "Anxiety", "Regret", "Hope", "Boredom", "Satisfaction"
  ];

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} trade${selected.size > 1 ? "s" : ""}?`)) return;
    try {
      const res = await fetch("/api/trades", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) {
        setSelected(new Set());
        await load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete trades.");
      }
    } catch {
      alert("A network error occurred.");
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    planned: "bg-blue-500/20 text-blue-400",
    open: "bg-yellow-500/20 text-yellow-400",
    closed: "bg-slate-500/20 dark:text-slate-400 text-slate-500",
  };

  const mask = "------";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Trade Journal</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Notes, tags, and reflections per trade</p>
        </div>
        <div className="flex items-center gap-2">
           {/* View Toggles */}
           <div className="flex h-9 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={clsx(
                "px-2 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
                viewMode === "cards" ? "bg-emerald-500 text-white shadow-sm" : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-200"
              )}
              title="Card Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={clsx(
                "px-2 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
                viewMode === "list" ? "bg-emerald-500 text-white shadow-sm" : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-200"
              )}
              title="Table List"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("review")}
              className={clsx(
                "px-2 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
                viewMode === "review" ? "bg-emerald-500 text-white shadow-sm" : "dark:text-slate-400 text-slate-500 hover:dark:text-slate-200"
              )}
              title="Review Mode"
            >
              <Columns className="w-3.5 h-3.5" />
              Review
            </button>
          </div>
          
          <button
            onClick={() => setChartsVisible(v => !v)}
            className="px-3 h-9 rounded-lg text-sm font-medium dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50 transition-colors flex items-center gap-1.5"
          >
            {chartsVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Charts
          </button>
          <button onClick={load}
            className="h-9 w-9 flex items-center justify-center rounded-lg dark:bg-slate-800/50 bg-slate-100/50 hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors">
            <RefreshCw className={`w-4 h-4 dark:text-slate-400 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Account Stats Banner */}
      <AccountBanner
        trades={trades}
        accountSize={accountSize}
        hidden={hidden}
        onToggleHidden={() => {
          const next = !hidden;
          setHidden(next);
          localStorage.setItem("privacy_hidden", String(next));
        }}
      />

      {/* Management Bar */}
      <div className="rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white p-3 space-y-3">
        <div className="flex items-center flex-wrap gap-3">
          {/* Select All */}
          <button 
            onClick={toggleAll}
            className={clsx(
              "flex items-center gap-2 px-3 h-9 rounded-lg border transition-all duration-200",
              selected.size > 0 
                ? "dark:bg-emerald-500/10 bg-emerald-50 border-emerald-500/50" 
                : "dark:bg-slate-800/50 bg-slate-50 dark:border-slate-700/50 border-slate-200 hover:border-slate-400"
            )}
          >
            <div className={clsx(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              displayed.length > 0 && selected.size === displayed.length
                ? "bg-emerald-500 border-emerald-500"
                : selected.size > 0
                  ? "bg-emerald-500/50 border-emerald-500"
                  : "dark:border-slate-600 border-slate-300"
            )}>
              {displayed.length > 0 && selected.size === displayed.length && (
                <div className="w-2 h-2 bg-white rounded-sm" />
              )}
              {selected.size > 0 && selected.size < displayed.length && (
                <div className="w-2 h-0.5 bg-white rounded-full" />
              )}
            </div>
            <span className={clsx(
              "text-xs font-bold whitespace-nowrap",
              selected.size > 0 ? "text-emerald-400" : "dark:text-slate-400 text-slate-500"
            )}>
              {selected.size > 0 ? `${selected.size} Selected` : "Select All"}
            </span>
            {selected.size > 0 && (
              <div 
                onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }}
                className="ml-2 p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                title="Delete Selected"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          <div className="h-6 w-px dark:bg-slate-800 bg-slate-200 mx-1 hidden sm:block" />

          {/* Search */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by symbol..."
              value={symbolQ}
              onChange={(e) => setSymbolQ(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-9 px-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-xs font-medium dark:text-slate-300 text-slate-600 focus:outline-none"
            >
              <option value="all">All Entries</option>
              <option value="with-notes">With Notes</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 px-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-xs font-medium dark:text-slate-300 text-slate-600 focus:outline-none"
            >
              <option value="all">Any Status</option>
              <option value="planned">Planned</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="h-9 px-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700/50 border-slate-200 text-xs font-medium dark:text-slate-300 text-slate-600 focus:outline-none"
            >
              <option value="all">Any Direction</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filtered Summary */}
      {!loading && (filter !== "all" || symbolQ || status !== "all" || direction !== "all") && displayed.length > 0 && (
        <div className="rounded-xl dark:bg-slate-900/60 bg-slate-50 px-4 py-2.5 flex items-center gap-5 flex-wrap text-xs border dark:border-slate-800 border-slate-200">
          <span className="dark:text-slate-500 text-slate-400 font-medium">
            Filtered: {displayed.length} trade{displayed.length !== 1 ? "s" : ""}
          </span>
          {(() => {
            const closed = displayed.filter(t => t.status === "closed");
            const winners = closed.filter(t => (t.pnl ?? 0) > 0);
            const losers = closed.filter(t => (t.pnl ?? 0) < 0);
            const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
            const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
            return (
              <>
                <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
                <span className="dark:text-slate-400 text-slate-500">P&L</span>
                <span className={`font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {hidden ? mask : `${totalPnl >= 0 ? "+" : "-"}$${Math.abs(totalPnl).toFixed(2)}`}
                </span>
                <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
                <span className="dark:text-slate-400 text-slate-500">Win Rate</span>
                <span className={`font-bold ${winRate >= 50 ? "text-emerald-400" : "text-yellow-400"}`}>
                  {hidden ? mask : `${winRate.toFixed(1)}%`}
                </span>
                <span className="dark:text-slate-500 text-slate-400">
                  {hidden ? "" : `(${winners.length}W / ${losers.length}L)`}
                </span>
              </>
            );
          })()}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 dark:text-slate-400 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading journal...
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl dark:bg-slate-800/50 bg-slate-50 p-12 text-center border-2 border-dashed dark:border-slate-800 border-slate-200">
          <p className="dark:text-slate-500 text-slate-400 font-medium">No trades match your filters.</p>
          <button onClick={() => { setSymbolQ(""); setStatus("all"); setDirection("all"); setFilter("all"); }} 
            className="mt-4 text-sm text-emerald-400 hover:underline">Clear all filters</button>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 overflow-hidden">
          <TradeTable
            trades={displayed}
            visibleColumns={["symbol", "direction", "status", "entry", "stop", "target", "pnl", "date", "notes"]}
            onEdit={(t) => { setEditTrade(t); setShowModal(true); }}
            onDelete={(id) => {
              if (confirm("Delete this trade?")) {
                fetch(`/api/trades/${id}`, { method: "DELETE" }).then(load);
              }
            }}
            selectedIds={selected}
            onToggleSelect={toggleOne}
            onSelectAll={(ids) => setSelected(new Set(ids))}
            selectable={true}
          />
        </div>
      ) : viewMode === "review" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-320px)] min-h-[600px]">
          {/* Sidebar List */}
          <div className="lg:col-span-4 flex flex-col rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white overflow-hidden">
            <div className="p-3 border-b dark:border-slate-800 border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider dark:text-slate-500 text-slate-400">Entries</span>
              <span className="text-xs dark:text-slate-400 text-slate-500">{displayed.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y dark:divide-slate-800 divide-slate-100">
              {displayed.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTradeId(t.id)}
                  className={clsx(
                    "w-full p-4 text-left transition-colors flex items-center gap-3",
                    selectedTradeId === t.id ? "dark:bg-emerald-500/10 bg-emerald-50" : "hover:dark:bg-slate-800 hover:bg-slate-50"
                  )}
                >
                  <div className={clsx("w-1.5 h-10 rounded-full", STATUS_COLOR[t.status].split(" ")[0])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold dark:text-white text-slate-900">{t.symbol}</span>
                      <span className={clsx("text-xs font-bold", (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${hidden ? mask : t.pnl.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-400">{t.entry_date ?? t.created_at.slice(0,10)}</span>
                      <span className="text-[10px] dark:text-slate-500 text-slate-400 truncate ml-2 max-w-[100px]">{t.notes || "No notes"}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail View */}
          <div className="lg:col-span-8 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white overflow-y-auto p-6 scrollbar-thin">
            {selectedTrade && (
              <div className="space-y-6">
                {isEditingReview ? (
                  /* Inline Edit Form */
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {me?.guest && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Guest Mode: You can preview changes here, but they won't be saved to the database.
                      </div>
                    )}
                    {saveError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                        {saveError}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 flex items-center justify-center">
                          <Logo className="w-7 h-7" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold dark:text-white text-slate-900">{selectedTrade.symbol}</h2>
                          <p className="text-xs dark:text-slate-500 text-slate-400">Editing entry details</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditingReview(false)}
                          className="px-4 h-10 rounded-lg border dark:border-slate-700 border-slate-200 dark:text-slate-300 text-slate-600 text-sm font-bold hover:dark:bg-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReviewSave}
                          disabled={savingReview}
                          className="flex items-center gap-2 px-6 h-10 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                          {savingReview ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Status</label>
                        <select 
                          value={editFormData.status}
                          onChange={(e) => setEditFormData({...editFormData, status: e.target.value as any})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        >
                          <option value="planned">Planned</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Direction</label>
                        <select 
                          value={editFormData.direction}
                          onChange={(e) => setEditFormData({...editFormData, direction: e.target.value as any})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        >
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Entry</label>
                        <input 
                          type="number" step="any"
                          value={editFormData.entry_price ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, entry_price: parseFloat(e.target.value) || 0})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Stop Loss</label>
                        <input 
                          type="number" step="any"
                          value={editFormData.stop_loss ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, stop_loss: parseFloat(e.target.value) || 0})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Target</label>
                        <input 
                          type="number" step="any"
                          value={editFormData.take_profit ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, take_profit: parseFloat(e.target.value) || 0})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Quantity</label>
                        <input 
                          type="number" step="any"
                          value={editFormData.shares ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, shares: parseFloat(e.target.value) || 0})}
                          className="w-full h-11 px-4 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Emotions / Feelings</label>
                      <div className="flex flex-wrap gap-2">
                        {EMOTIONS.map(emo => {
                          const selected = editFormData.emotions ? editFormData.emotions.split(",").map(t => t.trim()).filter(Boolean) : [];
                          const isSelected = selected.includes(emo);
                          return (
                            <button
                              key={emo}
                              type="button"
                              onClick={() => toggleReviewEmotion(emo)}
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

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Notes & Reflection</label>
                      <textarea 
                        rows={8}
                        value={editFormData.notes ?? ""}
                        onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                        placeholder="What did you see? How did you feel?"
                        className="w-full p-4 rounded-2xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Static View */
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 flex items-center justify-center">
                          <Logo className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold dark:text-white text-slate-900">{selectedTrade.symbol}</h2>
                            <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider", STATUS_COLOR[selectedTrade.status])}>
                              {selectedTrade.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm dark:text-slate-400 text-slate-500 font-medium">
                            <span className={selectedTrade.direction === "long" ? "text-emerald-400" : "text-red-400"}>
                              {selectedTrade.direction.toUpperCase()}
                            </span>
                            <span>•</span>
                            <span>{selectedTrade.entry_date ?? selectedTrade.created_at.slice(0, 10)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleReviewEdit}
                          className="flex items-center gap-2 px-4 h-10 rounded-lg dark:bg-slate-800 bg-slate-100 dark:text-white text-slate-900 font-bold text-sm transition-colors hover:dark:bg-slate-700"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => router.push(buildChartUrl(selectedTrade))}
                          className="p-2.5 rounded-lg dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 transition-colors"
                          title="View in Chart"
                        >
                          <LineChart className="w-5 h-5 dark:text-slate-400 text-slate-500" />
                        </button>
                        <button
                          onClick={handleReviewDelete}
                          className="p-2.5 rounded-lg dark:bg-slate-800 bg-slate-100 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Delete Trade"
                        >
                          <Trash2 className="w-5 h-5 dark:text-slate-400 text-slate-500" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl dark:bg-slate-800/50 bg-slate-50">
                        <p className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold mb-1">Entry Price</p>
                        <p className="text-lg font-bold dark:text-white text-slate-900">{selectedTrade.entry_price ? `$${selectedTrade.entry_price}` : "—"}</p>
                      </div>
                      <div className="p-4 rounded-xl dark:bg-slate-800/50 bg-slate-50">
                        <p className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold mb-1">Exit Price</p>
                        <p className="text-lg font-bold dark:text-white text-slate-900">{selectedTrade.exit_price ? `$${selectedTrade.exit_price}` : "—"}</p>
                      </div>
                      <div className="p-4 rounded-xl dark:bg-slate-800/50 bg-slate-50">
                        <p className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold mb-1">Quantity</p>
                        <p className="text-lg font-bold dark:text-white text-slate-900">{selectedTrade.shares ?? "—"}</p>
                      </div>
                      <div className="p-4 rounded-xl dark:bg-slate-800/50 bg-slate-50">
                        <p className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold mb-1">P&L</p>
                        <p className={clsx("text-lg font-bold", (selectedTrade.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {selectedTrade.pnl != null ? `${selectedTrade.pnl >= 0 ? "+" : ""}${hidden ? mask : selectedTrade.pnl.toFixed(2)}` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Rating + R:R + % Return + Hold Time */}
                    <div className="flex flex-wrap items-center gap-3">
                      {selectedTrade.rating != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold">Rating</span>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className={clsx("w-4 h-4", n <= selectedTrade.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-300")} />
                            ))}
                          </div>
                        </div>
                      )}
                      {(() => { const rr = calcRRAchieved(selectedTrade); return rr !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold">R:R</span>
                          <span className={clsx("text-sm font-bold", rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-blue-400" : rr >= 0 ? "text-amber-400" : "text-red-400")}>{rr.toFixed(2)}R</span>
                        </div>
                      ) : null; })()}
                      {(() => { const pct = calcPercentReturn(selectedTrade, accountSize); return pct !== null && !hidden ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold">Return</span>
                          <span className={clsx("text-sm font-bold", pct >= 0 ? "text-emerald-400" : "text-red-400")}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>
                        </div>
                      ) : null; })()}
                      {(() => { const hold = formatHoldDuration(selectedTrade.entry_date, selectedTrade.exit_date); return hold ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold">Hold</span>
                          <span className="text-sm font-medium dark:text-slate-300 text-slate-700">{hold}</span>
                        </div>
                      ) : null; })()}
                      {selectedTrade.market_context && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest dark:text-slate-500 text-slate-400 font-bold">Context</span>
                          <span className="text-sm font-medium dark:text-slate-300 text-slate-700 capitalize">{selectedTrade.market_context.replace("_", " ")}</span>
                        </div>
                      )}
                    </div>

                    {selectedTrade.emotions && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Emotions / Feelings</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTrade.emotions.split(",").map(emo => (
                            <span key={emo} className="px-2.5 py-1 rounded-full text-xs font-medium dark:bg-emerald-500/10 bg-emerald-50 text-emerald-400 border dark:border-emerald-500/20 border-emerald-100">
                              {emo.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mistakes */}
                    {selectedTrade.mistakes && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Mistakes</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTrade.mistakes.split(",").map(m => m.trim()).filter(Boolean).map(m => (
                            <span key={m} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lessons */}
                    {selectedTrade.lessons && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Lessons Learned</h3>
                        <div className="flex items-start gap-2.5 p-4 rounded-xl dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100">
                          <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-sm dark:text-amber-300/80 text-amber-700 leading-relaxed">{selectedTrade.lessons}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Notes & Reflection</h3>
                      <div className="p-6 rounded-2xl dark:bg-slate-800/30 bg-slate-50 border dark:border-slate-800 border-slate-100 min-h-[150px]">
                        {selectedTrade.notes ? (
                          <p className="text-sm dark:text-slate-300 text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTrade.notes}</p>
                        ) : (
                          <p className="text-sm dark:text-slate-600 text-slate-400 italic">No notes captured for this trade.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {chartsVisible && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Chart Context</h3>
                    <div className="rounded-2xl overflow-hidden border dark:border-slate-800 border-slate-100">
                      <MiniChart
                        symbol={selectedTrade.symbol}
                        entry={selectedTrade.entry_price}
                        stopLoss={selectedTrade.stop_loss}
                        takeProfit={selectedTrade.take_profit}
                        height={350}
                        showPriceScale={true}
                        showTimeframeToggle={true}
                        chartTf={selectedTrade.chart_tf}
                        chartSavedAt={selectedTrade.chart_saved_at}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((t) => {
            const pnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
            const tags = t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const isSelected = selected.has(t.id);
            const pot = calcPotentialPnl(t);

            return (
              <div key={t.id} className={clsx("rounded-xl dark:bg-slate-900 bg-white p-4 space-y-3 hover:bg-emerald-500/5 transition-colors border dark:border-slate-800 border-slate-100 group", isSelected && "ring-2 ring-emerald-500")}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className={clsx(
                      "transition-opacity duration-200 mt-1",
                      !isSelected && selected.size === 0 ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                    )}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(t.id)}
                        className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                    </div>
                    <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 text-lg cursor-pointer hover:underline" onClick={() => { setEditTrade(t); setShowModal(true); }}>{t.symbol}</span>
                      <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_COLOR[t.status])}>
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
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => router.push(buildChartUrl(t))}
                      className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
                      title="Open in Chart"
                    >
                      <LineChart className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </button>
                    <button
                      onClick={() => { setEditTrade(t); setShowModal(true); }}
                      className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* Price info */}
                <div className="flex gap-3 text-xs">
                  <span className="dark:text-slate-500 text-slate-400">Entry <span className="dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</span></span>
                  <span className="text-red-400 font-medium">SL <span>{t.stop_loss ? `$${t.stop_loss}` : "—"}</span></span>
                  <span className="text-emerald-400 font-medium">TP <span>{t.take_profit ? `$${t.take_profit}` : "—"}</span></span>
                  {t.pnl !== null && (
                    <span className={clsx("ml-auto font-bold", pnlColor)}>
                      {t.pnl >= 0 ? "+" : ""}{hidden ? mask : t.pnl.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Rating + R:R + % Return + Market Context badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {t.rating != null && (
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={clsx("w-3 h-3", n <= t.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-300")} />
                      ))}
                    </div>
                  )}
                  {(() => { const rr = calcRRAchieved(t); return rr !== null ? (
                    <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold", rr >= 2 ? "bg-emerald-500/10 text-emerald-400" : rr >= 1 ? "bg-blue-500/10 text-blue-400" : rr >= 0 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400")}>
                      {rr.toFixed(2)}R
                    </span>
                  ) : null; })()}
                  {(() => { const pct = calcPercentReturn(t, accountSize); return pct !== null && !hidden ? (
                    <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold", pct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                      {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                    </span>
                  ) : null; })()}
                  {t.market_context && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 dark:text-slate-400 text-slate-500 capitalize">
                      {t.market_context.replace("_", " ")}
                    </span>
                  )}
                </div>

                {/* Mistakes */}
                {t.mistakes && (
                  <div className="flex flex-wrap gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    {t.mistakes.split(",").map(m => m.trim()).filter(Boolean).map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {/* Lessons */}
                {t.lessons && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg dark:bg-amber-500/5 bg-amber-50 border dark:border-amber-500/10 border-amber-100">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs dark:text-amber-300/80 text-amber-700 leading-relaxed">{t.lessons}</p>
                  </div>
                )}

                {/* Notes */}
                {t.notes ? (
                  <div className="rounded-lg dark:bg-slate-800 bg-slate-50 p-3 text-xs dark:text-slate-300 text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {t.notes}
                  </div>
                ) : (
                  <div className="rounded-lg dark:bg-slate-800/50 bg-slate-50 p-3 text-xs dark:text-slate-600 text-slate-400 italic">
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

                {/* Chart + potential P&L section */}
                {chartsVisible && (
                  <div className="space-y-3 pt-2">
                    {/* Potential P&L */}
                    {pot && (
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <span className="dark:text-slate-500 text-slate-400">Potential:</span>
                        {pot.profit != null && (
                          <span className="text-emerald-400">+${pot.profit.toFixed(2)}</span>
                        )}
                        {pot.loss != null && (
                          <span className="text-red-400">-${Math.abs(pot.loss).toFixed(2)}</span>
                        )}
                        {pot.rr != null && (
                          <span className="dark:text-slate-400 text-slate-500">R:R {pot.rr.toFixed(1)}</span>
                        )}
                      </div>
                    )}

                    {/* Mini chart */}
                    <div className="rounded-xl overflow-hidden border dark:border-slate-800 border-slate-100">
                      <MiniChart
                        symbol={t.symbol}
                        entry={t.entry_price}
                        stopLoss={t.stop_loss}
                        takeProfit={t.take_profit}
                        height={160}
                        chartTf={t.chart_tf}
                        chartSavedAt={t.chart_saved_at}
                      />
                    </div>
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
