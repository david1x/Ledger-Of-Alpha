"use client";
import { useEffect, useState } from "react";
import { Save, CheckCircle, Eye, EyeOff } from "lucide-react";

interface SystemSettings {
  account_size: string;
  risk_per_trade: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  app_url: string;
}

const DEFAULTS: SystemSettings = {
  account_size: "10000", risk_per_trade: "1",
  smtp_host: "", smtp_port: "587", smtp_secure: "false",
  smtp_user: "", smtp_pass: "", smtp_from: "", app_url: "",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) setSettings(s => ({ ...s, ...d.settings }));
      setLoading(false);
    });
  }, []);

  function set(key: keyof SystemSettings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setSettings(s => ({ ...s, [key]: e.target.value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  if (loading) return <p className="text-sm dark:text-slate-400 text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold dark:text-white text-slate-900 mb-6">System Settings</h1>

      <form onSubmit={save} className="space-y-8">
        {/* ── New user defaults ── */}
        <section className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold dark:text-white text-slate-900 mb-4">New User Defaults</h2>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-4">
            These values are seeded for every new account at registration.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Account Size ($)</label>
              <input type="number" value={settings.account_size} onChange={set("account_size")} min="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Risk Per Trade (%)</label>
              <input type="number" value={settings.risk_per_trade} onChange={set("risk_per_trade")} min="0" step="0.1" className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── App URL ── */}
        <section className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold dark:text-white text-slate-900 mb-1">App URL</h2>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-4">
            Used in email links. Leave blank to use the <code className="text-xs">NEXT_PUBLIC_APP_URL</code> env var.
          </p>
          <input type="url" value={settings.app_url} onChange={set("app_url")}
            placeholder="https://yourdomain.com" className={inputCls} />
        </section>

        {/* ── SMTP ── */}
        <section className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold dark:text-white text-slate-900 mb-1">SMTP Email</h2>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-4">
            These settings take precedence over <code className="text-xs">.env.local</code>. Leave all blank to fall back to env vars.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">SMTP Host</label>
                <input type="text" value={settings.smtp_host} onChange={set("smtp_host")}
                  placeholder="smtp.gmail.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Port</label>
                <input type="number" value={settings.smtp_port} onChange={set("smtp_port")}
                  placeholder="587" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Security</label>
              <select value={settings.smtp_secure} onChange={set("smtp_secure")} className={inputCls}>
                <option value="false">STARTTLS (port 587)</option>
                <option value="true">SSL/TLS (port 465)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Username</label>
              <input type="text" value={settings.smtp_user} onChange={set("smtp_user")}
                placeholder="you@gmail.com" autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Password / App Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={settings.smtp_pass} onChange={set("smtp_pass")}
                  placeholder="••••••••••••••••" autoComplete="new-password" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">From Address</label>
              <input type="text" value={settings.smtp_from} onChange={set("smtp_from")}
                placeholder='Ledger Of Alpha <noreply@yourdomain.com>' className={inputCls} />
            </div>
          </div>
        </section>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
