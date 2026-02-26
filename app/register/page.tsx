"use client";
import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Eye, EyeOff, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email,
          password: form.password, confirmPassword: form.confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
    } finally {
      setLoading(false);
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
          <p className="text-sm dark:text-slate-400 text-slate-500">Create your account</p>
        </div>

        <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-xl p-6 shadow-lg">
          {success ? (
            <div className="text-center py-4">
              <p className="text-emerald-400 font-medium text-lg mb-2">Check your email!</p>
              <p className="text-sm dark:text-slate-400 text-slate-500 mb-4">
                We sent a verification link to <strong>{form.email}</strong>.
                Click it to activate your account.
              </p>
              <Link href="/login"
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              {error && <p className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Name</label>
                  <input type="text" value={form.name} onChange={set("name")} required
                    placeholder="Your name"
                    className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={set("email")} required
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={form.password}
                      onChange={set("password")} required minLength={8}
                      placeholder="At least 8 characters"
                      className="w-full px-3 py-2 pr-10 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium dark:text-slate-300 text-slate-700 mb-1.5">Confirm password</label>
                  <input type={showPw ? "text" : "password"} value={form.confirm}
                    onChange={set("confirm")} required placeholder="Repeat password"
                    className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50 dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm dark:text-slate-400 text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
