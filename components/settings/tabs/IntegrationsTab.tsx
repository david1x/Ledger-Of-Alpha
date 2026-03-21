"use client";
import { useEffect, useState } from "react";
import { Key, BrainCircuit, Bell, RefreshCw, Send, Save, CheckCircle } from "lucide-react";
import { INPUT, LABEL, HINT, INITIAL_SETTINGS, useTabDirty } from "@/components/settings/types";
import type { Settings } from "@/components/settings/types";

export default function IntegrationsTab() {
  const [settings, setSettings] = useState<Pick<Settings, "discord_webhook" | "alert_discord_webhook" | "fmp_api_key" | "openai_api_key">>({
    discord_webhook: INITIAL_SETTINGS.discord_webhook,
    alert_discord_webhook: INITIAL_SETTINGS.alert_discord_webhook,
    fmp_api_key: INITIAL_SETTINGS.fmp_api_key,
    openai_api_key: INITIAL_SETTINGS.openai_api_key,
  });
  const { resetBaseline } = useTabDirty("integrations", settings);
  const [testingChart, setTestingChart] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [chartTestMsg, setChartTestMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [alertTestMsg, setAlertTestMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [symbolCount, setSymbolCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings((s) => ({
          ...s,
          discord_webhook: data.discord_webhook ?? s.discord_webhook,
          alert_discord_webhook: data.alert_discord_webhook ?? s.alert_discord_webhook,
          fmp_api_key: data.fmp_api_key ?? s.fmp_api_key,
          openai_api_key: data.openai_api_key ?? s.openai_api_key,
        }));
      });
    fetch("/api/symbols?q=")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSymbolCount(data.length);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    resetBaseline();
    setTimeout(() => setSaved(false), 3000);
  };

  const testWebhook = async (which: "chart" | "alert") => {
    const url =
      which === "chart" ? settings.discord_webhook : settings.alert_discord_webhook;
    const setTesting = which === "chart" ? setTestingChart : setTestingAlert;
    const setMsg = which === "chart" ? setChartTestMsg : setAlertTestMsg;

    if (!url) {
      setMsg({ text: "Enter a webhook URL first", type: "err" });
      return;
    }
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/discord/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook: url }),
      });
      if (res.ok) {
        setMsg({ text: "Test message sent! Check your Discord channel.", type: "ok" });
      } else {
        const data = await res.json();
        setMsg({ text: data.error || "Test failed", type: "err" });
      }
    } catch {
      setMsg({ text: "Network error", type: "err" });
    } finally {
      setTesting(false);
    }
  };

  const refreshSymbols = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    // Save current settings first
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const res = await fetch("/api/symbols?refresh=1");
    const data = await res.json();
    setRefreshing(false);
    if (res.ok && Array.isArray(data)) {
      setRefreshMsg(`Symbol list ready — ${data.length} pre-loaded symbols.`);
      setSymbolCount(data.length);
    } else {
      setRefreshMsg(data.error ?? "Failed to load symbols.");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FMP */}
        <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-yellow-400" /> Financial Modeling Prep API
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
              <a
                href="https://financialmodelingprep.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                financialmodelingprep.com
              </a>
              . Enables live symbol search as you type.
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
              <span className="text-sm dark:text-slate-400 text-slate-500">
                {symbolCount} symbols cached
              </span>
            )}
          </div>
          {refreshMsg && <p className="text-sm dark:text-slate-400 text-slate-500">{refreshMsg}</p>}
        </section>

        {/* AI Chart Analysis */}
        <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-violet-400" /> AI Chart Analysis
          </h2>
          <div>
            <label className={LABEL}>Gemini API Key</label>
            <input
              type="password"
              value={settings.openai_api_key}
              onChange={(e) => setSettings((s) => ({ ...s, openai_api_key: e.target.value }))}
              placeholder="Enter your Gemini API key..."
              className={INPUT}
            />
            <p className={HINT}>
              Get a key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                aistudio.google.com
              </a>
              . Powers AI chart pattern recognition with Gemini.
            </p>
          </div>
        </section>

        {/* Discord */}
        <section className="lg:col-span-2 rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" /> Discord Integration
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className={LABEL}>Chart Webhook URL</label>
              <input
                type="password"
                value={settings.discord_webhook}
                onChange={(e) => setSettings((s) => ({ ...s, discord_webhook: e.target.value }))}
                placeholder="https://discord.com/api/webhooks/..."
                className={INPUT}
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => testWebhook("chart")}
                  disabled={testingChart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingChart ? "Sending..." : "Test Connection"}
                </button>
                {chartTestMsg && (
                  <span
                    className={`text-xs ${
                      chartTestMsg.type === "ok" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {chartTestMsg.text}
                  </span>
                )}
              </div>
              <p className={HINT}>Chart snapshots will be posted here.</p>
            </div>
            <div>
              <label className={LABEL}>Alerts Webhook URL</label>
              <input
                type="password"
                value={settings.alert_discord_webhook}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, alert_discord_webhook: e.target.value }))
                }
                placeholder="https://discord.com/api/webhooks/..."
                className={INPUT}
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => testWebhook("alert")}
                  disabled={testingAlert}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingAlert ? "Sending..." : "Test Connection"}
                </button>
                {alertTestMsg && (
                  <span
                    className={`text-xs ${
                      alertTestMsg.type === "ok" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {alertTestMsg.text}
                  </span>
                )}
              </div>
              <p className={HINT}>
                Separate webhook for price alerts. Leave empty to use chart webhook.
              </p>
            </div>
          </div>
        </section>
      </div>

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
            <CheckCircle className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </>
  );
}
