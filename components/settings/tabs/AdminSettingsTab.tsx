"use client";
import { useEffect, useState } from "react";
import { Settings, Eye, EyeOff, Save, CheckCircle } from "lucide-react";
import { INPUT, LABEL, HINT, SYS_DEFAULTS } from "@/components/settings/types";
import type { SystemSettings } from "@/components/settings/types";

interface Props {
  isAdmin: boolean;
}

export default function AdminSettingsTab({ isAdmin }: Props) {
  const [sysSettings, setSysSettings] = useState<SystemSettings>(SYS_DEFAULTS);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysSaved, setSysSaved] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

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
    setTimeout(() => setSysSaved(false), 2500);
  };

  return (
    <>
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-400" /> System Settings
        </h2>
        {sysLoading ? (
          <p className="text-sm dark:text-slate-400 text-slate-500">Loading...</p>
        ) : (
          <>
            {/* New user defaults */}
            <div>
              <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-3">
                New User Defaults
              </h3>
              <p className={HINT + " mb-3"}>
                These values are seeded for every new account at registration.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            {/* App URL */}
            <div className="pt-4 border-t dark:border-slate-800 border-slate-100">
              <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-1">App URL</h3>
              <p className={HINT + " mb-3"}>
                Used in email links. Leave blank to use the NEXT_PUBLIC_APP_URL env var.
              </p>
              <input
                type="url"
                value={sysSettings.app_url}
                onChange={(e) => setSysSettings((s) => ({ ...s, app_url: e.target.value }))}
                placeholder="https://yourdomain.com"
                className={INPUT}
              />
            </div>

            {/* SMTP */}
            <div className="pt-4 border-t dark:border-slate-800 border-slate-100 space-y-4">
              <div>
                <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-1">
                  SMTP Email
                </h3>
                <p className={HINT + " mb-3"}>Leave all blank to fall back to .env.local vars.</p>
              </div>
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
      </section>
    </>
  );
}
