"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { TradeFilterState, DEFAULT_FILTER, Trade, QuoteMap, SavedView, MistakeType } from "@/lib/types";
import TradeTable, { ALL_COLUMNS, DEFAULT_COLUMNS, ColumnKey } from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, Settings, PanelRightClose, PanelRightOpen } from "lucide-react";
import SummaryStatsBar from "./SummaryStatsBar";
import AlertModal from "@/components/AlertModal";
import { useAccounts } from "@/lib/account-context";
import TradeImportExport from "./TradeImportExport";
import TradeFilterChips from "./TradeFilterChips";
import TradeFilterBar from "./TradeFilterBar";
import SavedViewsDropdown from "./SavedViewsDropdown";
import TradesSidebar from "./TradesSidebar";

function applyFilter(trades: Trade[], filter: TradeFilterState): Trade[] {
  return trades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    // Multi-symbol filter (new checklist)
    if (filter.symbols && filter.symbols.length > 0) {
      if (!filter.symbols.includes(t.symbol.toUpperCase())) return false;
    }
    // Legacy single-symbol filter (backward compat with old saved views)
    else if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) {
      return false;
    }
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false;
    if (filter.dateTo && t.exit_date && t.exit_date > filter.dateTo) return false;
    // Tags filter (OR semantics — trade matches if it has ANY selected tag)
    if (filter.tags.length > 0) {
      const tradeTags = t.tags ? t.tags.split(",").map(s => s.trim()) : [];
      if (!filter.tags.some(ft => tradeTags.includes(ft))) return false;
    }
    // Mistake filter (uses junction table data from API)
    if (filter.mistakeId) {
      const ids = t.mistake_tag_ids ? t.mistake_tag_ids.split(",") : [];
      if (!ids.includes(filter.mistakeId)) return false;
    }
    // Account filter (client-side, only used in All Accounts mode)
    if (filter.accountId && t.account_id !== filter.accountId) return false;
    return true;
  });
}

export default function TradesShell() {
  const { accounts, activeAccountId, activeAccount } = useAccounts();

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
  const [mistakeTypes, setMistakeTypes] = useState<MistakeType[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<"Table" | "Analytics">("Table");

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
      const loadedSettings = await settingsRes.json();
      const meData = await meRes.json();
      setMe(meData);
      setSettingsData(loadedSettings);

      if (loadedSettings.trades_sidebar_open !== undefined) {
        setSidebarOpen(loadedSettings.trades_sidebar_open === "true");
      }

      if (Array.isArray(tradesData)) {
        setAllTrades(tradesData);
        await loadQuotes(tradesData);
      }

      if (activeAccount) {
        setAccountSize(activeAccount.starting_balance);
        setRiskPercent(activeAccount.risk_per_trade);
      } else if (accounts.length > 0) {
        setAccountSize(accounts.reduce((sum, a) => sum + a.starting_balance, 0));
        if (loadedSettings.risk_per_trade) setRiskPercent(parseFloat(loadedSettings.risk_per_trade));
      } else {
        if (loadedSettings.account_size) setAccountSize(parseFloat(loadedSettings.account_size));
        if (loadedSettings.risk_per_trade) setRiskPercent(parseFloat(loadedSettings.risk_per_trade));
      }

      if (loadedSettings.trade_table_columns) {
        try {
          const saved = JSON.parse(loadedSettings.trade_table_columns) as ColumnKey[];
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

  // Fetch mistake types once on mount (non-guests only)
  useEffect(() => {
    if (me && !me.guest) {
      fetch("/api/mistakes")
        .then(res => res.ok ? res.json() : [])
        .then(data => { if (Array.isArray(data)) setMistakeTypes(data); })
        .catch(() => { /* silent */ });
    }
  }, [me]);

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

  const [settingsData, setSettingsData] = useState<any>({});

  // Filter helpers
  const updateFilter = (partial: Partial<TradeFilterState>) => {
    setFilter(prev => ({ ...prev, ...partial }));
  };
  const clearFilter = (field: keyof TradeFilterState) => {
    setFilter(prev => ({ ...prev, [field]: DEFAULT_FILTER[field] }));
  };
  const clearAllFilters = () => setFilter(DEFAULT_FILTER);

  const toggleSidebar = async () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (me && !me.guest) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades_sidebar_open: String(next) }),
      });
    }
  };

  // Saved views (Plan 02)
  const initialViews = useMemo<SavedView[]>(() => {
    if (settingsData.saved_filter_views) {
      try { return JSON.parse(settingsData.saved_filter_views); } catch { return []; }
    }
    return [];
  }, [settingsData.saved_filter_views]);

  const loadView = (viewFilter: TradeFilterState) => {
    setFilter(viewFilter);
  };

  const filteredTrades = applyFilter(allTrades, filter);

  const FILTER_BTN = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-emerald-500/20 text-emerald-400"
        : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50"
    }`;

  return (
    <>
      <div className="flex gap-0 items-stretch">
        {/* Main content column */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Filter bar row — first element, filter bar + action buttons */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <TradeFilterBar
                filter={filter}
                onFilterChange={updateFilter}
                allTrades={allTrades}
                accounts={accounts}
                activeAccountId={activeAccountId}
                isGuest={me?.guest ?? true}
              />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-0.5">
              <TradeImportExport activeAccountId={activeAccountId} onTradesChanged={load} />
              <button
                onClick={() => { setEditTrade(null); setShowModal(true); }}
                className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-sm font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">New Trade</span>
                <span className="xs:hidden">New</span>
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <TradeFilterChips filter={filter} onClear={clearFilter} onClearAll={clearAllFilters} accounts={accounts} />

          {/* Summary Stats */}
          <SummaryStatsBar
            filteredTrades={filteredTrades}
            allTrades={allTrades}
            accountSize={accountSize}
          />

          {/* Mobile tab toggle — only visible below lg */}
          <div className="flex lg:hidden border-b dark:border-slate-700 border-slate-200">
            {(["Table", "Analytics"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mobileTab === tab
                    ? "border-b-2 border-emerald-400 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:text-slate-200 hover:text-slate-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Table — visible on desktop always; on mobile only when Table tab active */}
          <div className={mobileTab === "Table" ? "block" : "hidden lg:block"}>
            {loading ? (
              <div className="text-center py-12 dark:text-slate-400 text-slate-500">Loading...</div>
            ) : (
              <div className="rounded-lg dark:bg-slate-800/50 bg-white">
                {/* Table toolbar header: SavedViews + cog icon */}
                <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-2 border-b dark:border-slate-700/50 border-slate-100">
                  <SavedViewsDropdown
                    currentFilter={filter}
                    onLoadView={loadView}
                    isGuest={me?.guest ?? true}
                    initialViews={initialViews}
                  />
                  <div className="relative" ref={columnMenuRef}>
                    <button
                      onClick={() => setShowColumnMenu(prev => !prev)}
                      className={FILTER_BTN(showColumnMenu)}
                      title="Configure columns"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    {showColumnMenu && (
                      <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-md dark:bg-slate-800 bg-white shadow-xl py-2">
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
                <div className="px-4 pb-4 pt-2">
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
                    totalCount={allTrades.length}
                    mistakeTypes={mistakeTypes}
                    onReorderColumns={saveColumns}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Analytics tab content — only on mobile when Analytics tab active */}
          <div className={mobileTab === "Analytics" ? "block lg:hidden" : "hidden"}>
            <TradesSidebar
              filteredTrades={filteredTrades}
              mistakeTypes={mistakeTypes}
              onFilterChange={updateFilter}
            />
          </div>
        </div>

        {/* Desktop sidebar — hidden below lg */}
        <aside className="hidden lg:flex flex-col shrink-0 border-l dark:border-slate-700 border-slate-200 ml-4">
          {sidebarOpen ? (
            <div className="w-80 overflow-y-auto p-3 space-y-3" style={{ maxHeight: "calc(100vh - 80px)" }}>
              {/* Collapse button at top */}
              <div className="flex justify-end">
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-md hover:dark:bg-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-400 text-slate-500"
                  title="Collapse sidebar"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <TradesSidebar
                filteredTrades={filteredTrades}
                mistakeTypes={mistakeTypes}
                onFilterChange={updateFilter}
              />
            </div>
          ) : (
            <div
              className="w-10 flex flex-col items-center pt-4 dark:bg-slate-900/60 bg-slate-50 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={toggleSidebar}
              title="Expand sidebar"
            >
              <PanelRightOpen className="w-4 h-4 dark:text-slate-400 text-slate-500" />
            </div>
          )}
        </aside>
      </div>

      {/* Modals — outside flex layout (portals/fixed positioned) */}
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
    </>
  );
}
