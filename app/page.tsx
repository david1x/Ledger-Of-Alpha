"use client";
import { useEffect, useState } from "react";
import { Trade, QuoteMap } from "@/lib/types";
import StatsCards from "@/components/StatsCards";
import PnLChart from "@/components/PnLChart";
import TradeTable from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, RefreshCw } from "lucide-react";

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);

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

  const handleDelete = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    load();
  };

  const handleEdit = (t: Trade) => {
    setEditTrade(t);
    setShowModal(true);
  };

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

      {/* Stats */}
      <StatsCards trades={trades} quotes={quotes} />

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
          accountSize={accountSize}
          riskPercent={riskPercent}
        />
      )}
    </div>
  );
}
