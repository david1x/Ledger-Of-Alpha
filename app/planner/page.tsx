"use client";
import { useEffect, useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import RiskCalculator from "@/components/RiskCalculator";
import PositionSizer from "@/components/PositionSizer";
import { Save, Calculator } from "lucide-react";

export default function PlannerPage() {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState<number | null>(null);
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [takeProfit, setTakeProfit] = useState<number | null>(null);
  const [shares, setShares] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      if (s.account_size) setAccountSize(parseFloat(s.account_size));
      if (s.risk_per_trade) setRiskPercent(parseFloat(s.risk_per_trade));
    });
  }, []);

  const n = (v: string) => (v === "" ? null : parseFloat(v));

  const save = async () => {
    if (!symbol) { setError("Symbol required"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol, direction, status: "planned",
        entry_price: entry, stop_loss: stopLoss, take_profit: takeProfit,
        shares, entry_date: entryDate || null, notes, tags,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Reset form
      setSymbol(""); setEntry(null); setStopLoss(null); setTakeProfit(null);
      setShares(null); setNotes(""); setTags(""); setEntryDate("");
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    }
  };

  const INPUT = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const LABEL = "block text-xs font-medium dark:text-slate-400 text-slate-500 mb-1";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white text-slate-900">Trade Planner</h1>
        <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Plan your next trade with live risk analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4 rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Setup Details
          </h2>

          <div>
            <label className={LABEL}>Symbol</label>
            <SymbolSearch value={symbol} onChange={setSymbol} placeholder="Search symbol..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Direction</label>
              <div className="grid grid-cols-2 gap-2">
                {(["long", "short"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      direction === d
                        ? d === "long"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-red-500/20 text-red-400 border-red-500/40"
                        : "dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>Planned Entry Date</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Entry Price</label>
              <input type="number" step="0.01" placeholder="0.00" value={entry ?? ""} onChange={(e) => setEntry(n(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Stop Loss</label>
              <input type="number" step="0.01" placeholder="0.00" value={stopLoss ?? ""} onChange={(e) => setStopLoss(n(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Take Profit</label>
              <input type="number" step="0.01" placeholder="0.00" value={takeProfit ?? ""} onChange={(e) => setTakeProfit(n(e.target.value))} className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Shares (optional — auto-calculated below)</label>
            <input type="number" step="1" placeholder="0" value={shares ?? ""} onChange={(e) => setShares(n(e.target.value))} className={INPUT} />
          </div>

          <div>
            <label className={LABEL}>Tags</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="breakout, gap, swing..." className={INPUT} />
          </div>

          <div>
            <label className={LABEL}>Trade Thesis / Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Why are you taking this trade? Key levels, catalyst, setup name..."
              className={INPUT + " resize-none"}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {saved && <p className="text-emerald-400 text-sm">Trade saved to your log!</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save as Planned Trade"}
          </button>
        </div>

        {/* Calculators */}
        <div className="space-y-4">
          {/* Account settings reminder */}
          <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">Account Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Account Size ($)</label>
                <input
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Risk Per Trade (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          <RiskCalculator
            entry={entry}
            stopLoss={stopLoss}
            takeProfit={takeProfit}
            shares={shares}
            direction={direction}
          />
          <PositionSizer
            accountSize={accountSize}
            riskPercent={riskPercent}
            entry={entry}
            stopLoss={stopLoss}
            direction={direction}
            manualShares={shares}
            onApplyShares={(s) => setShares(s)}
          />
        </div>
      </div>
    </div>
  );
}
