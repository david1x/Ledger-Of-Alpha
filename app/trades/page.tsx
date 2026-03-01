"use client";
import { useEffect, useState, useRef } from "react";
import { Trade, QuoteMap } from "@/lib/types";
import TradeTable, { ALL_COLUMNS, DEFAULT_COLUMNS, ColumnKey } from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import { Plus, Search, Filter, SlidersHorizontal, Download, Upload, ChevronDown } from "lucide-react";
import { tradesToCsv, csvToTrades } from "@/lib/csv";
import { TRADE_FIELDS } from "@/lib/validate-trade";

type StatusFilter = "all" | "planned" | "open" | "closed";
type DirectionFilter = "all" | "long" | "short";

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
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
      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
        await loadQuotes(tradesData);
      }
      if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));
      if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
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

  useEffect(() => { load(); }, [status, direction, symbolQ]);

  // Auto-refresh quotes every 60s
  useEffect(() => {
    if (!trades.length) return;
    const id = setInterval(() => loadQuotes(trades), 60_000);
    return () => clearInterval(id);
  }, [trades]);

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
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_table_columns: JSON.stringify(cols) }),
    });
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
      const res = await fetch("/api/trades");
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
        body: JSON.stringify({ trades: parsedTrades }),
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
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white shadow-xl py-1">
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Trade
          </button>
        </div>
      </div>

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
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white shadow-xl py-2">
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
        <TradeTable trades={trades} onEdit={(t) => { setEditTrade(t); setShowModal(true); }} onDelete={handleDelete} onBulkDelete={handleBulkDelete} quotes={quotes} visibleColumns={visibleColumns} defaultRiskPercent={riskPercent} />
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
