"use client";
import { useEffect, useState } from "react";
import { Save, RefreshCw, CheckCircle, Key, Bell, DollarSign } from "lucide-react";

interface Settings {
  discord_webhook: string;
  fmp_api_key: string;
  account_size: string;
  risk_per_trade: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    discord_webhook: "",
    fmp_api_key: "",
    account_size: "10000",
    risk_per_trade: "1",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [symbolCount, setSymbolCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      setSettings((s) => ({ ...s, ...data }));
    });
    // Get symbol count
    fetch("/api/symbols?q=").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setSymbolCount(data.length);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const refreshSymbols = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    // Save settings first so the API key is available for live search
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const res = await fetch("/api/symbols?refresh=1");
    const data = await res.json();
    setRefreshing(false);
    if (res.ok && Array.isArray(data)) {
      setRefreshMsg(`Symbol list ready — ${data.length} pre-loaded symbols. Live FMP search active when you type.`);
      setSymbolCount(data.length);
    } else {
      setRefreshMsg(data.error ?? "Failed to load symbols.");
    }
  };

  const INPUT = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const LABEL = "block text-sm font-medium dark:text-white text-slate-900 mb-1";
  const HINT = "text-xs dark:text-slate-500 text-slate-400 mt-1";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white text-slate-900">Settings</h1>
        <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Configure your account preferences and integrations</p>
      </div>

      {/* Account */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Account Settings
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Account Size ($)</label>
            <input
              type="number"
              value={settings.account_size}
              onChange={(e) => setSettings((s) => ({ ...s, account_size: e.target.value }))}
              className={INPUT}
            />
            <p className={HINT}>Your total trading capital</p>
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
        </div>
      </section>

      {/* FMP API */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Key className="w-4 h-4 text-yellow-400" />
          Financial Modeling Prep API
        </h2>
        <div>
          <label className={LABEL}>FMP API Key</label>
          <input
            type="password"
            value={settings.fmp_api_key}
            onChange={(e) => setSettings((s) => ({ ...s, fmp_api_key: e.target.value }))}
            placeholder="Enter your FMP API key..."
            className={INPUT}
          />
          <p className={HINT}>
            Get a free key at{" "}
            <span className="text-emerald-400">financialmodelingprep.com</span>.
            Enables live symbol search as you type. Without it, the built-in list of ~250 large-cap stocks is used.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshSymbols}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Loading..." : "Load Symbol List"}
          </button>
          {symbolCount !== null && (
            <span className="text-sm dark:text-slate-400 text-slate-500">{symbolCount} symbols cached</span>
          )}
        </div>
        {refreshMsg && (
          <p className={`text-sm ${refreshMsg.includes("Successfully") ? "text-emerald-400" : "text-red-400"}`}>
            {refreshMsg}
          </p>
        )}
      </section>

      {/* Discord */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          Discord Integration
        </h2>
        <div>
          <label className={LABEL}>Webhook URL</label>
          <input
            type="password"
            value={settings.discord_webhook}
            onChange={(e) => setSettings((s) => ({ ...s, discord_webhook: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
            className={INPUT}
          />
          <p className={HINT}>
            Create a webhook in your Discord channel settings (Integrations → Webhooks). Chart snapshots will be posted there.
          </p>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
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
            <CheckCircle className="w-4 h-4" />
            Settings saved!
          </span>
        )}
      </div>
    </div>
  );
}
