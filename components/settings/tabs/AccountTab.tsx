"use client";
import { useEffect, useState } from "react";
import { DollarSign, LineChart, ShieldCheck, Save, CheckCircle } from "lucide-react";
import { INPUT, LABEL, HINT, CARD, INITIAL_SETTINGS, useTabDirty } from "@/components/settings/types";
import type { Settings } from "@/components/settings/types";

export default function AccountTab() {
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const { resetBaseline } = useTabDirty("account", settings);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings((s) => ({ ...s, ...data }));
        fetch("/api/trades")
          .then((r) => r.json())
          .then((trades) => {
            if (Array.isArray(trades)) {
              const totalPnl = trades
                .filter((t: { status: string; pnl?: number }) => t.status === "closed")
                .reduce((sum: number, t: { pnl?: number }) => sum + (t.pnl ?? 0), 0);
              const startBal = parseFloat(data.account_size || "10000");
              setCurrentBalance(startBal + totalPnl);
            }
          })
          .catch(() => {});
      });
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(!!data.isAdmin);
        setHasAdmin(!!data.hasAdmin);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_size: settings.account_size,
        risk_per_trade: settings.risk_per_trade,
        commission_model: settings.commission_model,
        commission_value: settings.commission_value,
        commission_per_trade: settings.commission_value,
        daily_loss_limit: settings.daily_loss_limit,
        daily_loss_limit_type: settings.daily_loss_limit_type,
        montecarlo_ruin_threshold: settings.montecarlo_ruin_threshold,
      }),
    });
    setSaving(false);
    setSaved(true);
    resetBaseline();
    setTimeout(() => setSaved(false), 3000);
  };

  const claimAdmin = async () => {
    setClaiming(true);
    setClaimMsg(null);
    const res = await fetch("/api/admin/claim", { method: "POST" });
    const data = await res.json();
    setClaiming(false);
    if (res.ok) {
      window.location.href = "/admin";
    } else {
      setClaimMsg({ text: data.error, type: "err" });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Settings */}
        <section className={CARD + " lg:col-span-2"}>
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Account Settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Starting Balance ($)</label>
              <input
                type="number"
                value={settings.account_size}
                onChange={(e) => setSettings((s) => ({ ...s, account_size: e.target.value }))}
                className={INPUT}
              />
              <p className={HINT}>Your initial trading capital</p>
              {currentBalance != null && (
                <p
                  className={`text-xs mt-1.5 font-medium ${
                    currentBalance >= parseFloat(settings.account_size || "10000")
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  Current Balance: $
                  {currentBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            <div>
              <label className={LABEL}>Risk Per Trade (%)</label>
              <input
                type="number"
                step="0.1"
                value={settings.risk_per_trade}
                onChange={(e) => setSettings((s) => ({ ...s, risk_per_trade: e.target.value }))}
                className={INPUT}
              />
              <p className={HINT}>Max % of account to risk per trade</p>
            </div>
            <div>
              <label className={LABEL}>Commission Model</label>
              <select
                value={settings.commission_model}
                onChange={(e) => setSettings((s) => ({ ...s, commission_model: e.target.value }))}
                className={INPUT}
              >
                <option value="flat">Flat (per trade)</option>
                <option value="per_share">Per Share</option>
                <option value="percent">Percentage</option>
              </select>
              <p className={HINT}>
                {settings.commission_model === "flat"
                  ? "Fixed $ per trade (×2 round trip)"
                  : settings.commission_model === "per_share"
                  ? "$ per share (×2 round trip)"
                  : "% of total trade value"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Commission Value</label>
              <input
                type="number"
                step="0.01"
                value={settings.commission_value || settings.commission_per_trade}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    commission_value: e.target.value,
                    commission_per_trade: e.target.value,
                  }))
                }
                className={INPUT}
              />
              <p className={HINT}>
                {settings.commission_model === "flat"
                  ? "Dollar amount per trade"
                  : settings.commission_model === "per_share"
                  ? "Dollar amount per share"
                  : "Percentage value (e.g., 0.1 for 0.1%)"}
              </p>
            </div>
            <div>
              <label className={LABEL}>Daily Loss Limit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={settings.daily_loss_limit}
                  onChange={(e) => setSettings((s) => ({ ...s, daily_loss_limit: e.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="No limit"
                />
                <select
                  value={settings.daily_loss_limit_type}
                  onChange={(e) => setSettings((s) => ({ ...s, daily_loss_limit_type: e.target.value }))}
                  className="w-16 shrink-0 px-2 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="dollar">$</option>
                  <option value="percent">%</option>
                </select>
              </div>
              <p className={HINT}>
                Max daily loss before warning (
                {settings.daily_loss_limit_type === "percent" ? "% of account" : "dollar amount"})
              </p>
            </div>
          </div>
        </section>

        {/* Monte Carlo Simulation */}
        <section className={CARD + " lg:col-span-2"}>
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2 text-sm">
            <LineChart className="w-4 h-4 text-emerald-400" /> Monte Carlo Simulation
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-500">
            Configure risk analysis shown in the trade entry modal
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Ruin Probability Threshold (%)</label>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={settings.montecarlo_ruin_threshold}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, montecarlo_ruin_threshold: e.target.value }))
                }
                className={INPUT}
              />
              <p className={HINT}>
                Trades with ruin probability above this threshold will show a warning. Default: 5%
              </p>
            </div>
            <div>
              <label className={LABEL}>Severity Preview</label>
              {(() => {
                const threshold =
                  parseFloat(settings.montecarlo_ruin_threshold || "5") || 5;
                return (
                  <div className="space-y-1.5 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs dark:text-slate-400 text-slate-500">
                        Below {threshold}% — Low risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-xs dark:text-slate-400 text-slate-500">
                        {threshold}% – {threshold * 2}% — Moderate risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs dark:text-slate-400 text-slate-500">
                        Above {threshold * 2}% — High risk
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Claim Admin */}
        {!isAdmin && !hasAdmin && (
          <section className="lg:col-span-2 rounded-lg border border-amber-500/30 dark:bg-amber-500/5 bg-amber-50 p-5 space-y-3">
            <h3 className="font-medium dark:text-white text-slate-900 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Claim Admin Access
            </h3>
            <p className="text-xs dark:text-slate-400 text-slate-500">
              No admin exists yet. Claim admin privileges to manage users and system settings.
            </p>
            {claimMsg && (
              <p
                className={`text-sm rounded-lg px-3 py-2 ${
                  claimMsg.type === "ok"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {claimMsg.text}
              </p>
            )}
            <button
              onClick={claimAdmin}
              disabled={claiming}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {claiming ? "Claiming..." : "Claim Admin"}
            </button>
          </section>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </>
  );
}
