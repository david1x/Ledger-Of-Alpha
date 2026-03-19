"use client";
import { useState } from "react";
import { Database, Download, Upload, Cable, ChevronDown } from "lucide-react";
import { tradesToCsv, csvToTrades, isIbkrCsv, ibkrCsvToTrades } from "@/lib/csv";
import { TRADE_FIELDS } from "@/lib/validate-trade";

export default function DataTab() {
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  const exportTrades = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/trades");
      const allTrades = await res.json();
      if (!Array.isArray(allTrades) || allTrades.length === 0) return;

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
    } catch {
      /* silent */
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    setImportMenuOpen(false);
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
    setImportMenuOpen(false);
    try {
      const text = await file.text();

      if (!isIbkrCsv(text)) {
        setImportResult({
          imported: 0,
          skipped: 0,
          errors: [
            "This does not look like an IBKR Transaction History CSV. Make sure you export from Account Management → Reports → Activity / Transaction History.",
          ],
        });
        setImporting(false);
        return;
      }

      const parsedTrades = ibkrCsvToTrades(text);

      if (parsedTrades.length === 0) {
        setImportResult({
          imported: 0,
          skipped: 0,
          errors: [
            "No trades found in the IBKR file. Only Buy/Sell transactions with valid symbols are imported (adjustments, dividends, and FX translations are skipped).",
          ],
        });
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
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <Database className="w-4 h-4 text-blue-400" /> Data Management
      </h2>
      <p className="text-sm dark:text-slate-400 text-slate-500">
        Export your complete trading history for backup or import trades from a CSV or JSON file.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => exportTrades("csv")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Export as CSV
        </button>
        <button
          onClick={() => exportTrades("json")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Export as JSON
        </button>
        <div className="relative">
          <button
            onClick={() => setImportMenuOpen((v) => !v)}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Importing..." : "Import Trades"}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {importMenuOpen && !importing && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setImportMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white shadow-xl overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700 hover:bg-slate-50 cursor-pointer transition-colors border-b dark:border-slate-700 border-slate-100">
                  <Upload className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-medium">From Backup</div>
                    <div className="text-xs dark:text-slate-500 text-slate-400">CSV or JSON file</div>
                  </div>
                  <input type="file" accept=".csv,.json" onChange={handleImportFile} className="hidden" />
                </label>
                <label className="flex items-center gap-3 px-4 py-3 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                  <Cable className="w-4 h-4 shrink-0 text-blue-400" />
                  <div>
                    <div className="font-medium">From IBKR</div>
                    <div className="text-xs dark:text-slate-500 text-slate-400">
                      Transaction History CSV
                    </div>
                  </div>
                  <input type="file" accept=".csv" onChange={handleImportIbkr} className="hidden" />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
      {importResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            importResult.imported > 0
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={importResult.imported > 0 ? "text-emerald-400" : "text-red-400"}>
              {importResult.imported > 0
                ? `Imported ${importResult.imported} trade${
                    importResult.imported !== 1 ? "s" : ""
                  } successfully.`
                : "No trades imported."}
              {importResult.skipped > 0 && ` ${importResult.skipped} skipped.`}
            </span>
            <button
              onClick={() => setImportResult(null)}
              className="dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 text-xs"
            >
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
    </section>
  );
}
