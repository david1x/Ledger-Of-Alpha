"use client";
import { useEffect, useState } from "react";
import { Trade } from "@/lib/types";
import TradeTable from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, Search, Filter } from "lucide-react";

type StatusFilter = "all" | "planned" | "open" | "closed";
type DirectionFilter = "all" | "long" | "short";

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [symbolQ, setSymbolQ] = useState("");
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (direction !== "all") params.set("direction", direction);
    if (symbolQ) params.set("symbol", symbolQ);

    try {
      const [tradesRes, settingsRes] = await Promise.all([
        fetch(`/api/trades?${params}`),
        fetch("/api/settings"),
      ]);
      const tradesData = await tradesRes.json();
      const settingsData = await settingsRes.json();
      if (Array.isArray(tradesData)) setTrades(tradesData);
      if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));
      if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, direction, symbolQ]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    load();
  };

  const FILTER_BTN = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
        : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 border dark:border-slate-700 border-slate-200"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Trade Log</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">{trades.length} trades</p>
        </div>
        <button
          onClick={() => { setEditTrade(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Trade
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-400 text-slate-500" />
          <input
            type="text"
            value={symbolQ}
            onChange={(e) => setSymbolQ(e.target.value.toUpperCase())}
            placeholder="Filter by symbol"
            className="pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 dark:text-slate-500 text-slate-400" />
          {(["all", "planned", "open", "closed"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={FILTER_BTN(status === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center gap-1.5">
          {(["all", "long", "short"] as DirectionFilter[]).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={FILTER_BTN(direction === d)}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 dark:text-slate-400 text-slate-500">Loading...</div>
      ) : (
        <TradeTable trades={trades} onEdit={(t) => { setEditTrade(t); setShowModal(true); }} onDelete={handleDelete} />
      )}

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
