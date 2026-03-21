"use client";
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { Settings, Eye, EyeOff, Save, CheckCircle, Key, Loader2 } from "lucide-react";
import { INPUT, LABEL, HINT, CARD, SYS_DEFAULTS, useTabDirty } from "@/components/settings/types";
import type { SystemSettings } from "@/components/settings/types";

interface Props {
  isAdmin: boolean;
}

export default function AdminSettingsTab({ isAdmin }: Props) {
  const [sysSettings, setSysSettings] = useState<SystemSettings>(SYS_DEFAULTS);
  const { resetBaseline } = useTabDirty("admin-settings", sysSettings);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysSaved, setSysSaved] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showFmpKey, setShowFmpKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState("");
  const [smtpTest, setSmtpTest] = useState<{ loading: boolean; result: { text: string; type: "ok" | "err" } | null }>({ loading: false, result: null });
  const [fmpTest, setFmpTest] = useState<{ loading: boolean; result: { text: string; type: "ok" | "err" } | null }>({ loading: false, result: null });
  const [geminiTest, setGeminiTest] = useState<{ loading: boolean; result: { text: string; type: "ok" | "err" } | null }>({ loading: false, result: null });

  useEffect(() => {
    if (!isAdmin) return;
    setSysLoading(true);
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSysSettings((s) => ({ ...s, ...data.settings }));
        setSysLoading(false);
      })
      .catch(() => setSysLoading(false));

    fetch("/api/admin/detected-url")
      .then((r) => r.json())
      .then((data) => {
        if (data.url) setDetectedUrl(data.url);
      })
      .catch(() => {});
  }, [isAdmin]);

  const saveSysSettings = async () => {
    setSysSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sysSettings),
    });
    setSysSaving(false);
    setSysSaved(true);
    resetBaseline();
    setTimeout(() => setSysSaved(false), 2500);
  };

  type TestState = { loading: boolean; result: { text: string; type: "ok" | "err" } | null };
  type SetTestState = Dispatch<SetStateAction<TestState>>;

  const runTest = async (endpoint: string, setState: SetTestState) => {
    setState({ loading: true, result: null });
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      const result: { text: string; type: "ok" | "err" } = data.ok
        ? { text: "Connection successful", type: "ok" }
        : { text: data.error || "Test failed", type: "err" };
      setState({ loading: false, result });
      setTimeout(() => setState((s) => ({ ...s, result: null })), 5000);
    } catch {
      setState({ loading: false, result: { text: "Network error", type: "err" } });
      setTimeout(() => setState((s) => ({ ...s, result: null })), 5000);
    }
  };

  return (
    <>
      {sysLoading ? (
        <section className={CARD}>
          <p className="text-sm dark:text-slate-400 text-slate-500">Loading...</p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* New User Defaults */}
            <section className={CARD}>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" /> New User Defaults
              </h2>
              <p className={HINT}>
                These values are seeded for every new account at registration.
              </p>
              <div className="space-y-4">
                <div>
                  <label className={LABEL}>Account Size ($)</label>
                  <input
                    type="number"
                    value={sysSettings.account_size}
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, account_size: e.target.value }))
                    }
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Risk Per Trade (%)</label>
                  <input
                    type="number"
                    value={sysSettings.risk_per_trade}
                    step="0.1"
                    onChange={(e) =>
                      setSysSettings((s) => ({ ...s, risk_per_trade: e.target.value }))
                    }
                    className={INPUT}
                  />
                </div>
              </div>
            </section>

            {/* App URL */}
            <section className={CARD}>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" /> App URL
              </h2>
              <p className={HINT}>
                Used in email links. Leave blank to use the NEXT_PUBLIC_APP_URL env var.
              </p>
              <input
                type="url"
                value={sysSettings.app_url}
                onChange={(e) => setSysSettings((s) => ({ ...s, app_url: e.target.value }))}
                placeholder="https://yourdomain.com"
                className={INPUT}
              />
              {detectedUrl && (
                <p className={HINT + " mt-2"}>
                  Auto-detected: <span className="dark:text-slate-300 text-slate-600 font-mono">{detectedUrl}</span>
                </p>
              )}
              <p className={HINT}>
                This is what the server detects from request headers. The override above takes priority when set.
              </p>
            </section>

            {/* SMTP Email */}
            <section className={CARD + " lg:col-span-2"}>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" /> SMTP Email
              </h2>
              <p className={HINT}>Leave all blank to fall back to .env.local vars.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL}>SMTP Host</label>
                  <input
                    type="text"
                    value={sysSettings.smtp_host}
                    onChange={(e) => setSysSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Port</label>
                  <input
                    type="number"
                    value={sysSettings.smtp_port}
                    onChange={(e) => setSysSettings((s) => ({ ...s, smtp_port: e.target.value }))}
                    placeholder="587"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Security</label>
                  <select
                    value={sysSettings.smtp_secure}
                    onChange={(e) => setSysSettings((s) => ({ ...s, smtp_secure: e.target.value }))}
                    className={INPUT}
                  >
                    <option value="false">STARTTLS (port 587)</option>
                    <option value="true">SSL/TLS (port 465)</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Username</label>
                  <input
                    type="text"
                    value={sysSettings.smtp_user}
                    onChange={(e) => setSysSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                    placeholder="you@gmail.com"
                    autoComplete="off"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Password / App Password</label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? "text" : "password"}
                      value={sysSettings.smtp_pass}
                      onChange={(e) => setSysSettings((s) => ({ ...s, smtp_pass: e.target.value }))}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`${INPUT} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500"
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={LABEL}>From Address</label>
                  <input
                    type="text"
                    value={sysSettings.smtp_from}
                    onChange={(e) => setSysSettings((s) => ({ ...s, smtp_from: e.target.value }))}
                    placeholder="Ledger Of Alpha <noreply@yourdomain.com>"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => runTest("/api/admin/test-smtp", setSmtpTest)}
                  disabled={smtpTest.loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {smtpTest.loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {smtpTest.loading ? "Testing..." : "Test Connection"}
                </button>
                {smtpTest.result && (
                  <span className={`text-xs ${smtpTest.result.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                    {smtpTest.result.text}
                  </span>
                )}
                <p className={HINT + " ml-auto"}>Save first, then test.</p>
              </div>
            </section>

            {/* API Keys */}
            <section className={CARD}>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" /> FMP API Key
              </h2>
              <p className={HINT}>
                System-level FMP key used as fallback when users have no personal key set.
              </p>
              <div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showFmpKey ? "text" : "password"}
                      value={sysSettings.fmp_api_key}
                      onChange={(e) => setSysSettings((s) => ({ ...s, fmp_api_key: e.target.value }))}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`${INPUT} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFmpKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500"
                    >
                      {showFmpKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => runTest("/api/admin/test-fmp", setFmpTest)}
                    disabled={fmpTest.loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {fmpTest.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {fmpTest.loading ? "Testing..." : "Test"}
                  </button>
                </div>
                {fmpTest.result && (
                  <span className={`text-xs mt-1 block ${fmpTest.result.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                    {fmpTest.result.text}
                  </span>
                )}
                <p className={HINT + " mt-1"}>Tests the saved key. Save first if you made changes.</p>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" /> Gemini API Key
              </h2>
              <p className={HINT}>
                System-level Gemini key used as fallback when users have no personal key set.
              </p>
              <div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showGeminiKey ? "text" : "password"}
                      value={sysSettings.openai_api_key}
                      onChange={(e) => setSysSettings((s) => ({ ...s, openai_api_key: e.target.value }))}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`${INPUT} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500"
                    >
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => runTest("/api/admin/test-gemini", setGeminiTest)}
                    disabled={geminiTest.loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {geminiTest.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {geminiTest.loading ? "Testing..." : "Test"}
                  </button>
                </div>
                {geminiTest.result && (
                  <span className={`text-xs mt-1 block ${geminiTest.result.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                    {geminiTest.result.text}
                  </span>
                )}
                <p className={HINT + " mt-1"}>Tests the saved key. Save first if you made changes.</p>
              </div>
            </section>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveSysSettings}
              disabled={sysSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
            >
              {sysSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {sysSaved ? "Saved!" : sysSaving ? "Saving..." : "Save System Settings"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
