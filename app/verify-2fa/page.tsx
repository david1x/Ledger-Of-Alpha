"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { ShieldCheck, Mail } from "lucide-react";

export default function Verify2FAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailOtp() {
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/2fa/email-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setOtpSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo className="w-14 h-14" />
          <div className="text-center">
            <span className="text-2xl font-bold text-emerald-400">Ledger</span>
            <span className="text-2xl font-bold dark:text-white text-slate-900"> Of Alpha</span>
          </div>
          <p className="text-sm dark:text-slate-400 text-slate-500">Two-factor verification</p>
        </div>

        <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <p className="text-sm dark:text-slate-300 text-slate-700">
              {otpSent
                ? "Enter the code sent to your email."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>

          {error && <p className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          {otpSent && !error && (
            <p className="mb-4 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
              Code sent — check your inbox (expires in 10 minutes).
            </p>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text" inputMode="numeric" pattern="\d*" maxLength={6}
              value={code} onChange={e => setCode(e.target.value)} required
              placeholder="000000" autoComplete="one-time-code" autoFocus
              className="w-full px-3 py-3 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button type="submit" disabled={loading || code.length < 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
              <ShieldCheck className="w-4 h-4" />
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t dark:border-slate-800 border-slate-200">
            <button onClick={sendEmailOtp} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 text-sm transition-colors disabled:opacity-50">
              <Mail className="w-4 h-4" />
              {sending ? "Sending…" : "Send code to my email instead"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-sm dark:text-slate-400 text-slate-500">
          Wrong account?{" "}
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
            className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
