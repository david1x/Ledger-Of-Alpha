"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Eye, EyeOff, LogIn, User } from "lucide-react";

const UNVERIFIED_ERROR = "Please verify your email before signing in.";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (params.get("verified") === "1") setInfo("Email verified! You can now sign in.");
    if (params.get("error") === "invalid-token") setError("Verification link is invalid or expired.");
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      if (data.requires2fa) {
        router.push("/verify-2fa");
      } else {
        router.push(params.get("next") ?? "/");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to send email. Check your SMTP settings.");
        return;
      }
      setError("");
      setInfo("Verification email sent! Check your inbox.");
    } finally {
      setResendLoading(false);
    }
  }

  async function continueAsGuest() {
    document.cookie = "guest=true; path=/; max-age=86400; SameSite=Lax";
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-slate-950 bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo className="w-14 h-14" />
          <div className="text-center">
            <span className="text-2xl font-bold text-emerald-400">Ledger</span>
            <span className="text-2xl font-bold dark:text-white text-slate-900"> Of Alpha</span>
          </div>
          <p className="text-sm dark:text-slate-400 text-slate-500">Sign in to your account</p>
        </div>

        <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6 shadow-lg">
          {info && <p className="mb-4 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{info}</p>}
          {error && (
            <div className="mb-4">
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              {error === UNVERIFIED_ERROR && email && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 underline underline-offset-2"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
              <LogIn className="w-4 h-4" />
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-3 relative flex items-center">
            <div className="flex-1 border-t dark:border-slate-700 border-slate-200" />
            <span className="mx-3 text-xs dark:text-slate-500 text-slate-400">or</span>
            <div className="flex-1 border-t dark:border-slate-700 border-slate-200" />
          </div>

          <button onClick={continueAsGuest}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-50 text-sm font-medium transition-colors">
            <User className="w-4 h-4" />
            Continue as Guest
          </button>
          <p className="mt-1 text-center text-xs dark:text-slate-500 text-slate-400">
            Guests see demo data only — nothing is saved
          </p>
        </div>

        <p className="mt-4 text-center text-sm dark:text-slate-400 text-slate-500">
          No account?{" "}
          <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
