"use client";
import { useEffect, useState, useRef } from "react";
import { Trade, QuoteMap } from "@/lib/types";
import TradeTable, { ALL_COLUMNS, DEFAULT_COLUMNS, ColumnKey } from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, Search, Filter, SlidersHorizontal, Download, Upload, ChevronDown } from "lucide-react";
import AccountBanner from "@/components/AccountBanner";
import AlertModal from "@/components/AlertModal";
import { tradesToCsv, csvToTrades } from "@/lib/csv";
import { TRADE_FIELDS } from "@/lib/validate-trade";
import { useAccounts } from "@/lib/account-context";

type StatusFilter = "all" | "planned" | "open" | "closed";
type DirectionFilter = "all" | "long" | "short";

function FilteredSummary({ trades, quotes, hidden, isFiltered }: { trades: Trade[]; quotes?: QuoteMap; hidden: boolean; isFiltered: boolean }) {
  const closed = trades.filter(t => t.status === "closed");
  const open = trades.filter(t => t.status === "open");
  const winners = closed.filter(t => (t.pnl ?? 0) > 0);
  const losers = closed.filter(t => (t.pnl ?? 0) < 0);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
  const unrealized = open.reduce((sum, t) => {
    if (t.entry_price == null || t.shares == null || !quotes?.[t.symbol]) return sum;
    return sum + (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1);
  }, 0);
  const hasLive = open.some(t => quotes?.[t.symbol] !== undefined);

  const mask = "------";
  const fmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="rounded-b-xl dark:bg-slate-900/60 bg-slate-50 px-4 py-2.5 flex items-center gap-5 flex-wrap text-xs border-t dark:border-slate-700/50 border-slate-200">
      <span className="dark:text-slate-500 text-slate-400 font-medium">
        {isFiltered ? "Filtered" : "Total"}: {trades.length} trade{trades.length !== 1 ? "s" : ""}
      </span>
      <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
      <span className="dark:text-slate-400 text-slate-500">P&L</span>
      <span className={`font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {hidden ? mask : `${totalPnl >= 0 ? "+" : "-"}${fmt(totalPnl)}`}
      </span>
      <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
      <span className="dark:text-slate-400 text-slate-500">Win Rate</span>
      <span className={`font-bold ${winRate >= 50 ? "text-emerald-400" : "text-yellow-400"}`}>
        {hidden ? mask : `${winRate.toFixed(1)}%`}
      </span>
      <span className="dark:text-slate-500 text-slate-400">
        {hidden ? "" : `(${winners.length}W / ${losers.length}L)`}
      </span>
      {hasLive && (
        <>
          <div className="w-px h-4 dark:bg-slate-700 bg-slate-200" />
          <span className="dark:text-slate-400 text-slate-500">Unrealized</span>
          <span className={`font-bold ${unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {hidden ? mask : `${unrealized >= 0 ? "+" : "-"}${fmt(unrealized)}`}
          </span>
        </>
      )}
    </div>
  );
}

export default function TradesPage() {
  const { accounts, activeAccountId, activeAccount } = useAccounts();
  const [me, setMe] = useState<any>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [symbolQ, setSymbolQ] = useState("");
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDefaults, setAlertDefaults] = useState<{ symbol?: string; price?: number }>({});
  const [hidden, setHidden] = useState(false);

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
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Check privacy mode if not explicitly set in localStorage
      if (localStorage.getItem("privacy_hidden") === null && settingsData.privacy_mode) {
        setHidden(settingsData.privacy_mode === "hidden");
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

  // Client-side filtering
  const trades = allTrades.filter(t => {
    if (status !== "all" && t.status !== status) return false;
    if (direction !== "all" && t.direction !== direction) return false;
    if (symbolQ && !t.symbol.toUpperCase().includes(symbolQ.toUpperCase())) return false;
    return true;
  });

  // Auto-refresh quotes every 60s
  useEffect(() => {
    if (!allTrades.length) return;
    const id = setInterval(() => loadQuotes(allTrades), 60_000);
    return () => clearInterval(id);
  }, [allTrades]);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu && !showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (showColumnMenu && columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
      if (showExportMenu && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnMenu, showExportMenu]);

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

  const exportTrades = async (format: "csv" | "json") => {
    setShowExportMenu(false);
    try {
      const exportUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
      const res = await fetch(exportUrl);
      const allTrades = await res.json();
      if (!Array.isArray(allTrades) || allTrades.length === 0) return;

      // Strip internal fields for export
      const exportFields = [...TRADE_FIELDS, "pnl", "created_at"] as const;
      const cleaned = allTrades.map((t: Record<string, unknown>) => {
        const obj: Record<string, unknown> = {};
        for (const f of exportFields) {
          obj[f] = t[f] ?? null;
        }
        return obj;
      });

      let blob: Blob;
      let ext: string;
      if (format === "csv") {
        blob = new Blob([tradesToCsv(cleaned)], { type: "text/csv" });
        ext = "csv";
      } else {
        blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: "application/json" });
        ext = "json";
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-of-alpha-trades-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      let parsedTrades: Record<string, unknown>[];

      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        parsedTrades = Array.isArray(parsed) ? parsed : parsed.trades ?? [];
      } else {
        parsedTrades = csvToTrades(text);
      }

      if (parsedTrades.length === 0) {
        setImportResult({ imported: 0, skipped: 0, errors: ["No valid trades found in file."] });
        setImporting(false);
        return;
      }

      const res = await fetch("/api/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: parsedTrades, account_id: activeAccountId ?? undefined }),
      });
      const result = await res.json();

      if (res.ok) {
        setImportResult(result);
        load();
      } else {
        setImportResult({ imported: 0, skipped: 0, errors: [result.error] });
      }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ["Failed to parse file."] });
    } finally {
      setImporting(false);
    }
  };

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
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">{trades.length} trades</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg dark:bg-slate-800 bg-white shadow-xl py-1">
                <button
                  onClick={() => exportTrades("csv")}
                  className="w-full text-left px-3 py-2 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => exportTrades("json")}
                  className="w-full text-left px-3 py-2 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                >
                  Export as JSON
                </button>
              </div>
            )}
          </div>

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Importing..." : "Import"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleImportFile}
            className="hidden"
          />

          {/* New Trade button */}
          <button
            onClick={() => { setEditTrade(null); setShowModal(true); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Trade
          </button>
        </div>
      </div>

      {/* Account Stats Banner */}
      <AccountBanner
        trades={allTrades}
        quotes={quotes}
        accountSize={accountSize}
        hidden={hidden}
        onToggleHidden={() => {
          const next = !hidden;
          setHidden(next);
          localStorage.setItem("privacy_hidden", String(next));
        }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol search */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-400 text-slate-500" />
          <input
            type="text"
            value={symbolQ}
            onChange={(e) => setSymbolQ(e.target.value.toUpperCase())}
            placeholder="Filter by symbol"
            className="w-full pl-9 pr-3 py-1.5 h-9 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 h-9">
          <Filter className="w-4 h-4 dark:text-slate-500 text-slate-400" />
          {(["all", "planned", "open", "closed"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={FILTER_BTN(status === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Direction filter */}
        <div className="flex items-center gap-1.5 h-9">
          {(["all", "long", "short"] as DirectionFilter[]).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={FILTER_BTN(direction === d)}>
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

      {/* Import result banner */}
      {importResult && (
        <div className={`rounded-lg px-4 py-3 text-sm ${importResult.imported > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <div className="flex items-center justify-between">
            <span className={importResult.imported > 0 ? "text-emerald-400" : "text-red-400"}>
              {importResult.imported > 0
                ? `Imported ${importResult.imported} trade${importResult.imported !== 1 ? "s" : ""} successfully.`
                : "No trades imported."}
              {importResult.skipped > 0 && ` ${importResult.skipped} skipped.`}
            </span>
            <button onClick={() => setImportResult(null)} className="dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 text-xs">
              Dismiss
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs dark:text-slate-400 text-slate-500">
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {importResult.errors.length > 10 && (
                <li>...and {importResult.errors.length - 10} more errors</li>
              )}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 dark:text-slate-400 text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-0">
          <div className="rounded-xl dark:bg-slate-800/50 bg-white p-4">
            <TradeTable trades={trades} onEdit={(t) => { setEditTrade(t); setShowModal(true); }} onDelete={handleDelete} onBulkDelete={handleBulkDelete} quotes={quotes} visibleColumns={visibleColumns} defaultRiskPercent={riskPercent} accountSize={accountSize} onSetAlert={(symbol, price) => { setAlertDefaults({ symbol, price }); setShowAlertModal(true); }} />
          </div>
          <FilteredSummary trades={trades} quotes={quotes} hidden={hidden} isFiltered={status !== "all" || direction !== "all" || !!symbolQ} />
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
