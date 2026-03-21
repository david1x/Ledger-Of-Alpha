"use client";
import { useState, useRef, useEffect } from "react";
import { Download, Upload, ChevronDown, Cable } from "lucide-react";
import { tradesToCsv, csvToTrades, isIbkrCsv, ibkrCsvToTrades } from "@/lib/csv";
import { TRADE_FIELDS } from "@/lib/validate-trade";

interface Props {
  activeAccountId: string | null;
  onTradesChanged: () => void;
}

export default function TradeImportExport({ activeAccountId, onTradesChanged }: Props) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

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
    setShowImportMenu(false);
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
        onTradesChanged();
      } else {
        setImportResult({ imported: 0, skipped: 0, errors: [result.error] });
      }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ["Failed to parse file."] });
    } finally {
      setImporting(false);
    }
  };

  const handleImportIbkr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    setShowImportMenu(false);
    try {
      const text = await file.text();

      if (!isIbkrCsv(text)) {
        setImportResult({ imported: 0, skipped: 0, errors: ["This does not look like an IBKR Transaction History CSV."] });
        setImporting(false);
        return;
      }

      const parsedTrades = ibkrCsvToTrades(text);

      if (parsedTrades.length === 0) {
        setImportResult({ imported: 0, skipped: 0, errors: ["No trades found in IBKR file. Only Buy/Sell transactions are imported."] });
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
        onTradesChanged();
      } else {
        setImportResult({ imported: 0, skipped: 0, errors: [result.error] });
      }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ["Failed to parse IBKR file."] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* Export dropdown */}
      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => setShowExportMenu(prev => !prev)}
          className="flex items-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 dark:text-slate-300 text-slate-700 text-[10px] sm:text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Export</span>
          <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl dark:bg-slate-900 bg-white shadow-2xl py-1 border dark:border-slate-800 border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => exportTrades("csv")}
              className="w-full text-left px-4 py-2.5 text-xs font-bold dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors border-b dark:border-slate-800 border-slate-100"
            >
              Export as CSV
            </button>
            <button
              onClick={() => exportTrades("json")}
              className="w-full text-left px-4 py-2.5 text-xs font-bold dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
            >
              Export as JSON
            </button>
          </div>
        )}
      </div>

      {/* Import button with dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowImportMenu(v => !v)}
          disabled={importing}
          className="flex items-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 dark:text-slate-300 text-slate-700 text-[10px] sm:text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-50 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{importing ? "..." : "Import"}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showImportMenu ? "rotate-180" : ""}`} />
        </button>
        {showImportMenu && !importing && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white shadow-xl overflow-hidden">
              <label className="flex items-center gap-3 px-3 py-2.5 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700 hover:bg-slate-50 cursor-pointer transition-colors border-b dark:border-slate-700 border-slate-100">
                <Upload className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-medium text-xs">From Backup</div>
                  <div className="text-[10px] dark:text-slate-500 text-slate-400">CSV or JSON file</div>
                </div>
                <input type="file" accept=".csv,.json" onChange={handleImportFile} className="hidden" />
              </label>
              <label className="flex items-center gap-3 px-3 py-2.5 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                <Cable className="w-4 h-4 shrink-0 text-blue-400" />
                <div>
                  <div className="font-medium text-xs">From IBKR</div>
                  <div className="text-[10px] dark:text-slate-500 text-slate-400">Transaction History CSV</div>
                </div>
                <input type="file" accept=".csv" onChange={handleImportIbkr} className="hidden" />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`w-full rounded-lg px-4 py-3 text-sm ${importResult.imported > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
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
    </>
  );
}
