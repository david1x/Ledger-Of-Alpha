"use client";
import { useEffect, useState } from "react";
import { Trade, QuoteMap } from "@/lib/types";
import StatsCards from "@/components/StatsCards";
import PnLChart from "@/components/PnLChart";
import TradeTable from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import Tooltip from "@/components/Tooltip";

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [accountOpen, setAccountOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  const loadQuotes = async (currentTrades: Trade[]) => {
    const symbols = [...new Set(
      currentTrades.filter(t => t.status === "open").map(t => t.symbol)
    )];
    if (!symbols.length) { setQuotes({}); return; }
    try {
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      if (res.ok) setQuotes(await res.json());
    } catch { /* silent */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [tradesRes, settingsRes] = await Promise.all([
        fetch("/api/trades"),
        fetch("/api/settings"),
      ]);
      const tradesData = await tradesRes.json();
      const settingsData = await settingsRes.json();
      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
        await loadQuotes(tradesData);
      }
      if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));
      if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh quotes every 60s
  useEffect(() => {
    if (!trades.length) return;
    const id = setInterval(() => loadQuotes(trades), 60_000);
    return () => clearInterval(id);
  }, [trades]);

  const totalPnl = trades.filter(t => t.status === "closed").reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const currentBalance = accountSize + totalPnl;
  const pnlPercent = accountSize > 0 ? (totalPnl / accountSize) * 100 : 0;
  const isUp = totalPnl >= 0;

  const handleDelete = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    load();
  };

  const handleEdit = (t: Trade) => {
    setEditTrade(t);
    setShowModal(true);
  };

  const mask = "••••••";
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Dashboard</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Your trading performance at a glance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg border dark:border-slate-700 border-slate-200 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 dark:text-slate-400 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => { setEditTrade(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Trade
          </button>
        </div>
      </div>

      {/* Account Info Banner */}
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900/80 bg-white overflow-hidden">
        <button
          onClick={() => setAccountOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium dark:text-white text-slate-900">Account Overview</span>
            <span className={`text-sm font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {hidden ? mask : `$${fmt(currentBalance)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setHidden(v => !v); }}
              className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
              title={hidden ? "Show numbers" : "Hide numbers"}
            >
              {hidden
                ? <EyeOff className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                : <Eye className="w-4 h-4 dark:text-slate-400 text-slate-500" />}
            </button>
            {accountOpen
              ? <ChevronUp className="w-4 h-4 dark:text-slate-400 text-slate-500" />
              : <ChevronDown className="w-4 h-4 dark:text-slate-400 text-slate-500" />}
          </div>
        </button>

        {accountOpen && (
          <div className="px-5 pb-4 pt-1 border-t dark:border-slate-700/50 border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Current Balance */}
              <div>
                <p className="text-xs dark:text-slate-500 text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">Current Balance <Tooltip text="Starting balance + total realized P&L from closed trades" /></p>
                <p className={`text-2xl font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {hidden ? mask : `$${fmt(currentBalance)}`}
                </p>
              </div>
              {/* Starting Balance */}
              <div>
                <p className="text-xs dark:text-slate-500 text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">Starting Balance <Tooltip text="Your initial trading capital, configured in Settings" /></p>
                <p className="text-2xl font-bold dark:text-slate-200 text-slate-700">
                  {hidden ? mask : `$${fmt(accountSize)}`}
                </p>
              </div>
              {/* Total P&L */}
              <div>
                <p className="text-xs dark:text-slate-500 text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">Total P&L <Tooltip text="Total realized profit & loss across all closed trades" /></p>
                <div className="flex items-center gap-2">
                  {isUp
                    ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                    : <TrendingDown className="w-5 h-5 text-red-400" />}
                  <p className={`text-2xl font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {hidden ? mask : `${isUp ? "+" : ""}$${fmt(totalPnl)}`}
                  </p>
                  <span className={`text-sm font-medium ${isUp ? "text-emerald-400/70" : "text-red-400/70"}`}>
                    {hidden ? "" : `(${isUp ? "+" : ""}${pnlPercent.toFixed(1)}%)`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <StatsCards trades={trades} quotes={quotes} hidden={hidden} />

      {/* P&L Chart */}
      <PnLChart trades={trades} />

      {/* Recent Trades */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold dark:text-white text-slate-900">Recent Trades</h2>
          <a href="/trades" className="text-sm text-emerald-400 hover:underline">View all →</a>
        </div>
        <TradeTable
          trades={trades}
          onEdit={handleEdit}
          onDelete={handleDelete}
          limit={8}
          quotes={quotes}
        />
      </div>

      {showModal && (
        <TradeModal
          trade={editTrade}
          onClose={() => { setShowModal(false); setEditTrade(null); }}
          onSaved={load}
          accountSize={currentBalance}
          riskPercent={riskPercent}
        />
      )}
    </div>
  );
}
