"use client";
import { useEffect, useState } from "react";
import { Save, RefreshCw, CheckCircle, Key, Bell, DollarSign, ShieldCheck, ShieldOff, Copy, Eye, EyeOff } from "lucide-react";

interface Settings {
  discord_webhook: string;
  fmp_api_key: string;
  account_size: string;
  risk_per_trade: string;
}

interface TwoFactorSetup {
  secret: string;
  qrDataUrl: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    discord_webhook: "", fmp_api_key: "", account_size: "10000", risk_per_trade: "1",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [symbolCount, setSymbolCount] = useState<number | null>(null);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [tfaSetup, setTfaSetup] = useState<TwoFactorSetup | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaMsg, setTfaMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => setSettings(s => ({ ...s, ...data })));
    fetch("/api/symbols?q=").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSymbolCount(data.length);
    }).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      setTwoFactorEnabled(!!data.twoFactorEnabled);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const refreshSymbols = async () => {
    setRefreshing(true); setRefreshMsg("");
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
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

  // ── 2FA handlers ───────────────────────────────────────────────────────
  const startTfaSetup = async () => {
    setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup");
    if (res.ok) setTfaSetup(await res.json());
  };

  const enableTfa = async () => {
    if (!tfaSetup || !tfaCode) return;
    setTfaLoading(true); setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", secret: tfaSetup.secret, code: tfaCode }),
    });
    const data = await res.json();
    setTfaLoading(false);
    if (res.ok) {
      setTwoFactorEnabled(true);
      setTfaSetup(null); setTfaCode("");
      setBackupCodes(data.backupCodes);
      setTfaMsg({ text: "2FA enabled. Save your backup codes below!", type: "ok" });
    } else {
      setTfaMsg({ text: data.error, type: "err" });
    }
  };

  const disableTfa = async () => {
    setTfaLoading(true); setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", code: tfaCode }),
    });
    const data = await res.json();
    setTfaLoading(false);
    if (res.ok) {
      setTwoFactorEnabled(false); setTfaCode("");
      setTfaMsg({ text: "2FA disabled.", type: "ok" });
    } else {
      setTfaMsg({ text: data.error, type: "err" });
    }
  };

  const INPUT = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const LABEL = "block text-sm font-medium dark:text-white text-slate-900 mb-1";
  const HINT  = "text-xs dark:text-slate-500 text-slate-400 mt-1";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white text-slate-900">Settings</h1>
        <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Configure your account preferences and integrations</p>
      </div>

      {/* Account */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Account Settings
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Account Size ($)</label>
            <input type="number" value={settings.account_size}
              onChange={e => setSettings(s => ({ ...s, account_size: e.target.value }))} className={INPUT} />
            <p className={HINT}>Your total trading capital</p>
          </div>
          <div>
            <label className={LABEL}>Risk Per Trade (%)</label>
            <input type="number" step="0.1" value={settings.risk_per_trade}
              onChange={e => setSettings(s => ({ ...s, risk_per_trade: e.target.value }))} className={INPUT} />
            <p className={HINT}>Max % of account to risk per trade</p>
          </div>
        </div>
      </section>

      {/* Security / 2FA */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm dark:text-white text-slate-900 font-medium">Two-Factor Authentication</p>
            <p className={HINT}>Add an extra layer of security to your account.</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${twoFactorEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 dark:text-slate-400 text-slate-500"}`}>
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {tfaMsg && (
          <p className={`text-sm rounded-lg px-3 py-2 ${tfaMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {tfaMsg.text}
          </p>
        )}

        {/* Backup codes after enabling */}
        {backupCodes.length > 0 && (
          <div className="rounded-lg border dark:border-slate-700 border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium dark:text-white text-slate-900">Backup Codes</p>
              <button onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); }}
                className="flex items-center gap-1 text-xs dark:text-slate-400 text-slate-500 hover:text-emerald-400">
                <Copy className="w-3.5 h-3.5" /> Copy all
              </button>
            </div>
            <p className="text-xs dark:text-slate-400 text-slate-500 mb-3">
              Save these codes somewhere safe. Each can be used once if you lose access to your authenticator.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {backupCodes.map(c => (
                <code key={c} className="text-xs font-mono dark:bg-slate-800 bg-slate-100 px-2 py-1 rounded text-center dark:text-slate-300 text-slate-700">
                  {c}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Setup flow */}
        {!twoFactorEnabled && !tfaSetup && (
          <button onClick={startTfaSetup}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
            <ShieldCheck className="w-4 h-4" /> Set Up 2FA
          </button>
        )}

        {!twoFactorEnabled && tfaSetup && (
          <div className="space-y-4">
            <p className="text-sm dark:text-slate-300 text-slate-700">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password…), then enter the 6-digit code to confirm.
            </p>
            <div className="flex gap-6 items-start">
              {/* QR code */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tfaSetup.qrDataUrl} alt="2FA QR Code" className="w-40 h-40 rounded-lg border dark:border-slate-700 border-slate-200" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs dark:text-slate-400 text-slate-500 mb-1">Or enter this secret manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono dark:bg-slate-800 bg-slate-100 px-2 py-1 rounded flex-1 dark:text-slate-300 text-slate-700 break-all">
                      {showSecret ? tfaSetup.secret : "••••••••••••••••"}
                    </code>
                    <button onClick={() => setShowSecret(v => !v)} className="dark:text-slate-400 text-slate-500">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(tfaSetup.secret)} className="dark:text-slate-400 text-slate-500 hover:text-emerald-400">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Confirmation Code</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={tfaCode}
                    onChange={e => setTfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000" className={INPUT} />
                </div>
                <div className="flex gap-2">
                  <button onClick={enableTfa} disabled={tfaLoading || tfaCode.length < 6}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <ShieldCheck className="w-4 h-4" /> {tfaLoading ? "Enabling…" : "Enable 2FA"}
                  </button>
                  <button onClick={() => { setTfaSetup(null); setTfaCode(""); }}
                    className="px-4 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-400 text-slate-600 text-sm transition-colors hover:dark:bg-slate-800 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disable flow */}
        {twoFactorEnabled && (
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Enter your current TOTP code to disable 2FA</label>
              <input type="text" inputMode="numeric" maxLength={6} value={tfaCode}
                onChange={e => setTfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" className={`${INPUT} max-w-xs`} />
            </div>
            <button onClick={disableTfa} disabled={tfaLoading || tfaCode.length < 6}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50">
              <ShieldOff className="w-4 h-4" /> {tfaLoading ? "Disabling…" : "Disable 2FA"}
            </button>
          </div>
        )}
      </section>

      {/* FMP API */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Key className="w-4 h-4 text-yellow-400" /> Financial Modeling Prep API
        </h2>
        <div>
          <label className={LABEL}>FMP API Key</label>
          <input type="password" value={settings.fmp_api_key}
            onChange={e => setSettings(s => ({ ...s, fmp_api_key: e.target.value }))}
            placeholder="Enter your FMP API key..." className={INPUT} />
          <p className={HINT}>
            Get a free key at <span className="text-emerald-400">financialmodelingprep.com</span>.
            Enables live symbol search as you type.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refreshSymbols} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Loading..." : "Load Symbol List"}
          </button>
          {symbolCount !== null && <span className="text-sm dark:text-slate-400 text-slate-500">{symbolCount} symbols cached</span>}
        </div>
        {refreshMsg && <p className="text-sm dark:text-slate-400 text-slate-500">{refreshMsg}</p>}
      </section>

      {/* Discord */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" /> Discord Integration
        </h2>
        <div>
          <label className={LABEL}>Webhook URL</label>
          <input type="password" value={settings.discord_webhook}
            onChange={e => setSettings(s => ({ ...s, discord_webhook: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..." className={INPUT} />
          <p className={HINT}>Create a webhook in your Discord channel (Integrations → Webhooks). Chart snapshots will be posted there.</p>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" /> Settings saved!
          </span>
        )}
      </div>
    </div>
  );
}
