"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Eye, EyeOff } from "lucide-react";
import { INPUT, LABEL, HINT } from "@/components/settings/types";

interface TwoFactorSetup {
  secret: string;
  qrDataUrl: string;
}

export default function SecurityTab() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [tfaSetup, setTfaSetup] = useState<TwoFactorSetup | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaMsg, setTfaMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setTwoFactorEnabled(!!data.twoFactorEnabled);
      })
      .catch(() => {});
  }, []);

  const startTfaSetup = async () => {
    setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup");
    if (res.ok) setTfaSetup(await res.json());
  };

  const enableTfa = async () => {
    if (!tfaSetup || !tfaCode) return;
    setTfaLoading(true);
    setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", secret: tfaSetup.secret, code: tfaCode }),
    });
    const data = await res.json();
    setTfaLoading(false);
    if (res.ok) {
      setTwoFactorEnabled(true);
      setTfaSetup(null);
      setTfaCode("");
      setBackupCodes(data.backupCodes);
      setTfaMsg({ text: "2FA enabled. Save your backup codes below!", type: "ok" });
    } else {
      setTfaMsg({ text: data.error, type: "err" });
    }
  };

  const disableTfa = async () => {
    setTfaLoading(true);
    setTfaMsg(null);
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", code: tfaCode }),
    });
    const data = await res.json();
    setTfaLoading(false);
    if (res.ok) {
      setTwoFactorEnabled(false);
      setTfaCode("");
      setTfaMsg({ text: "2FA disabled.", type: "ok" });
    } else {
      setTfaMsg({ text: data.error, type: "err" });
    }
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Two-Factor Authentication
      </h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm dark:text-white text-slate-900 font-medium">2FA Status</p>
          <p className={HINT}>Add an extra layer of security to your account.</p>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            twoFactorEnabled
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-slate-500/15 dark:text-slate-400 text-slate-500"
          }`}
        >
          {twoFactorEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {tfaMsg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            tfaMsg.type === "ok"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {tfaMsg.text}
        </p>
      )}

      {backupCodes.length > 0 && (
        <div className="rounded-lg border dark:border-slate-700 border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium dark:text-white text-slate-900">Backup Codes</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join("\n"));
              }}
              className="flex items-center gap-1 text-xs dark:text-slate-400 text-slate-500 hover:text-emerald-400"
            >
              <Copy className="w-3.5 h-3.5" /> Copy all
            </button>
          </div>
          <p className="text-xs dark:text-slate-400 text-slate-500 mb-3">
            Save these codes somewhere safe. Each can be used once if you lose access to your
            authenticator.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {backupCodes.map((c) => (
              <code
                key={c}
                className="text-xs font-mono dark:bg-slate-800 bg-slate-100 px-2 py-1 rounded text-center dark:text-slate-300 text-slate-700"
              >
                {c}
              </code>
            ))}
          </div>
        </div>
      )}

      {!twoFactorEnabled && !tfaSetup && (
        <button
          onClick={startTfaSetup}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <ShieldCheck className="w-4 h-4" /> Set Up 2FA
        </button>
      )}

      {!twoFactorEnabled && tfaSetup && (
        <div className="space-y-4">
          <p className="text-sm dark:text-slate-300 text-slate-700">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tfaSetup.qrDataUrl}
              alt="2FA QR Code"
              className="w-40 h-40 rounded-lg border dark:border-slate-700 border-slate-200"
            />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs dark:text-slate-400 text-slate-500 mb-1">
                  Or enter this secret manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono dark:bg-slate-800 bg-slate-100 px-2 py-1 rounded flex-1 dark:text-slate-300 text-slate-700 break-all">
                    {showSecret ? tfaSetup.secret : "••••••••••••••••"}
                  </code>
                  <button
                    onClick={() => setShowSecret((v) => !v)}
                    className="dark:text-slate-400 text-slate-500"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(tfaSetup.secret)}
                    className="dark:text-slate-400 text-slate-500 hover:text-emerald-400"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className={LABEL}>Confirmation Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={INPUT}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={enableTfa}
                  disabled={tfaLoading || tfaCode.length < 6}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" /> {tfaLoading ? "Enabling..." : "Enable 2FA"}
                </button>
                <button
                  onClick={() => {
                    setTfaSetup(null);
                    setTfaCode("");
                  }}
                  className="px-4 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-400 text-slate-600 text-sm transition-colors hover:dark:bg-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {twoFactorEnabled && (
        <div className="space-y-3">
          <div>
            <label className={LABEL}>Enter your current TOTP code to disable 2FA</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={tfaCode}
              onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className={`${INPUT} max-w-xs`}
            />
          </div>
          <button
            onClick={disableTfa}
            disabled={tfaLoading || tfaCode.length < 6}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ShieldOff className="w-4 h-4" /> {tfaLoading ? "Disabling..." : "Disable 2FA"}
          </button>
        </div>
      )}
    </section>
  );
}
