"use client";
import { useEffect, useState, useRef } from "react";
import { TradeFilterState, DEFAULT_FILTER, Trade, QuoteMap } from "@/lib/types";
import TradeTable, { ALL_COLUMNS, DEFAULT_COLUMNS, ColumnKey } from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, Search, Filter, SlidersHorizontal } from "lucide-react";
import AccountBanner from "@/components/AccountBanner";
import AlertModal from "@/components/AlertModal";
import { useAccounts } from "@/lib/account-context";
import { usePrivacy } from "@/lib/privacy-context";
import TradeImportExport from "./TradeImportExport";
import TradeFilterChips from "./TradeFilterChips";

function applyFilter(trades: Trade[], filter: TradeFilterState): Trade[] {
  return trades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) return false;
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false;
    if (filter.dateTo && t.exit_date && t.exit_date > filter.dateTo) return false;
    return true;
  });
}

export default function TradesShell() {
  const { accounts, activeAccountId, activeAccount } = useAccounts();
  const { hidden, toggleHidden } = usePrivacy();

  const [me, setMe] = useState<any>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDefaults, setAlertDefaults] = useState<{ symbol?: string; price?: number }>({});

  // Filter state with sessionStorage persistence
  const [filter, setFilter] = useState<TradeFilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTER;
    try {
      const saved = sessionStorage.getItem("trades_filter");
      return saved ? { ...DEFAULT_FILTER, ...JSON.parse(saved) } : DEFAULT_FILTER;
    } catch { return DEFAULT_FILTER; }
  });

  // Persist filter on change
  useEffect(() => {
    sessionStorage.setItem("trades_filter", JSON.stringify(filter));
  }, [filter]);

  const columnMenuRef = useRef<HTMLDivElement>(null);

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
      const tradesUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
      const [tradesRes, settingsRes, meRes] = await Promise.all([
        fetch(tradesUrl),
        fetch("/api/settings"),
        fetch("/api/auth/me"),
      ]);
      const tradesData = await tradesRes.json();
      const settingsData = await settingsRes.json();
      const meData = await meRes.json();
      setMe(meData);

      if (Array.isArray(tradesData)) {
        setAllTrades(tradesData);
        await loadQuotes(tradesData);
      }

      if (activeAccount) {
        setAccountSize(activeAccount.starting_balance);
        setRiskPercent(activeAccount.risk_per_trade);
      } else if (accounts.length > 0) {
        setAccountSize(accounts.reduce((sum, a) => sum + a.starting_balance, 0));
        if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
      } else {
        if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));
        if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
      }

      if (settingsData.trade_table_columns) {
        try {
          const saved = JSON.parse(settingsData.trade_table_columns) as ColumnKey[];
          if (Array.isArray(saved) && saved.length > 0) setVisibleColumns(saved);
        } catch { /* use defaults */ }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeAccountId, accounts.length]);

  // Auto-refresh quotes every 60s
  useEffect(() => {
    if (!allTrades.length) return;
    const id = setInterval(() => loadQuotes(allTrades), 60_000);
    return () => clearInterval(id);
  }, [allTrades]);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu) return;
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnMenu]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    load();
  };

  const handleBulkDelete = async (ids: number[]) => {
    await fetch("/api/trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    load();
  };

  const saveColumns = async (cols: ColumnKey[]) => {
    setVisibleColumns(cols);
    if (me && !me.guest) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_table_columns: JSON.stringify(cols) }),
      });
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter(k => k !== key)
      : [...visibleColumns, key];
    if (next.length === 0) return; // prevent hiding all
    saveColumns(next);
  };

  const resetColumns = () => {
    saveColumns(DEFAULT_COLUMNS);
  };

  // Filter helpers
  const updateFilter = (partial: Partial<TradeFilterState>) => {
    setFilter(prev => ({ ...prev, ...partial }));
  };
  const clearFilter = (field: keyof TradeFilterState) => {
    setFilter(prev => ({ ...prev, [field]: DEFAULT_FILTER[field] }));
  };
  const clearAllFilters = () => setFilter(DEFAULT_FILTER);

  const filteredTrades = applyFilter(allTrades, filter);

  const FILTER_BTN = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-emerald-500/20 text-emerald-400"
        : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Trade Log</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">{filteredTrades.length} trades</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <TradeImportExport activeAccountId={activeAccountId} onTradesChanged={load} />

          {/* New Trade button */}
          <button
            onClick={() => { setEditTrade(null); setShowModal(true); }}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-sm font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">New Trade</span>
            <span className="xs:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Account Stats Banner */}
      <AccountBanner
        trades={allTrades}
        quotes={quotes}
        accountSize={accountSize}
        hidden={hidden}
        onToggleHidden={toggleHidden}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol search */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-400 text-slate-500" />
          <input
            type="text"
            value={filter.symbol}
            onChange={(e) => updateFilter({ symbol: e.target.value.toUpperCase() })}
            placeholder="Filter by symbol"
            className="w-full pl-9 pr-3 py-1.5 h-9 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 h-9">
          <Filter className="w-4 h-4 dark:text-slate-500 text-slate-400" />
          {(["all", "planned", "open", "closed"] as TradeFilterState["status"][]).map((s) => (
            <button key={s} onClick={() => updateFilter({ status: s })} className={FILTER_BTN(filter.status === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center gap-1.5 h-9">
          {(["all", "long", "short"] as TradeFilterState["direction"][]).map((d) => (
            <button key={d} onClick={() => updateFilter({ direction: d })} className={FILTER_BTN(filter.direction === d)}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Column toggle */}
        <div className="relative" ref={columnMenuRef}>
          <button
            onClick={() => setShowColumnMenu(prev => !prev)}
            className={FILTER_BTN(showColumnMenu)}
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4" />
              Columns
            </span>
          </button>
          {showColumnMenu && (
            <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-lg dark:bg-slate-800 bg-white shadow-xl py-2">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:dark:bg-slate-700/50 hover:bg-slate-50 cursor-pointer text-sm dark:text-slate-300 text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  {col.label}
                </label>
              ))}
              <div className="border-t dark:border-slate-700 border-slate-200 mt-1.5 pt-1.5 px-3">
                <button
                  onClick={resetColumns}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <TradeFilterChips filter={filter} onClear={clearFilter} onClearAll={clearAllFilters} />

      {loading ? (
        <div className="text-center py-12 dark:text-slate-400 text-slate-500">Loading...</div>
      ) : (
        <div className="rounded-xl dark:bg-slate-800/50 bg-white p-4">
          <TradeTable
            trades={filteredTrades}
            onEdit={(t) => { setEditTrade(t); setShowModal(true); }}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            quotes={quotes}
            visibleColumns={visibleColumns}
            defaultRiskPercent={riskPercent}
            accountSize={accountSize}
            onSetAlert={(symbol, price) => { setAlertDefaults({ symbol, price }); setShowAlertModal(true); }}
          />
        </div>
      )}

      {showModal && (
        <TradeModal
          trade={editTrade}
          onClose={() => { setShowModal(false); setEditTrade(null); }}
          onSaved={load}
          riskPercent={riskPercent}
        />
      )}

      <AlertModal
        open={showAlertModal}
        onClose={() => { setShowAlertModal(false); setAlertDefaults({}); }}
        onSaved={() => {}}
        defaultSymbol={alertDefaults.symbol}
        defaultPrice={alertDefaults.price}
      />
    </div>
  );
}
