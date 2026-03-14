"use client";
import { useEffect, useState } from "react";
import { Save, RefreshCw, CheckCircle, Key, Bell, DollarSign, ShieldCheck, ShieldOff, Copy, Eye, EyeOff, Download, Upload, Database, Send, Grid3X3, Users, Settings, Trash2, UserCheck, UserX, LineChart, ListChecks, Plus, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { tradesToCsv, csvToTrades } from "@/lib/csv";
import { TRADE_FIELDS } from "@/lib/validate-trade";
import clsx from "clsx";

interface Settings {
  discord_webhook: string;
  alert_discord_webhook: string;
  fmp_api_key: string;
  account_size: string;
  risk_per_trade: string;
  commission_per_trade: string;
  commission_model: string;
  commission_value: string;
  heatmap_ranges: string;
  charts_collapsed: string;
  privacy_mode: string;
  tv_hide_side_toolbar: string;
  tv_withdateranges: string;
  tv_details: string;
  tv_hotlist: string;
  tv_calendar: string;
  tv_studies: string;
  strategies: string;
  daily_loss_limit: string;
  daily_loss_limit_type: string;
  default_tags: string;
  default_mistakes: string;
  trade_templates: string;
}

interface TwoFactorSetup {
  secret: string;
  qrDataUrl: string;
}

type Category = "account" | "tags" | "templates" | "display" | "chart" | "strategies" | "integrations" | "security" | "data" | "admin-users" | "admin-settings";

const CATEGORIES: { id: Category; label: string; icon: typeof DollarSign; adminOnly?: boolean }[] = [
  { id: "account",        label: "Account",        icon: DollarSign },
  { id: "tags",           label: "Tags & Mistakes", icon: ListChecks },
  { id: "templates",      label: "Templates",       icon: Copy },
  { id: "display",        label: "Display",         icon: Grid3X3 },
  { id: "chart",          label: "Chart",           icon: LineChart },
  { id: "strategies",     label: "Strategies",      icon: ListChecks },
  { id: "integrations",   label: "Integrations",    icon: Key },
  { id: "security",       label: "Security",        icon: ShieldCheck },
  { id: "data",           label: "Data",             icon: Database },
  { id: "admin-users",    label: "Users",            icon: Users, adminOnly: true },
  { id: "admin-settings", label: "System",           icon: Settings, adminOnly: true },
];

interface AdminUser {
  id: string;
  email: string;
  name: string;
  email_verified: number;
  two_factor_enabled: number;
  is_admin: number;
  created_at: string;
}

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

const SYS_DEFAULTS: SystemSettings = {
  account_size: "10000", risk_per_trade: "1",
  smtp_host: "", smtp_port: "587", smtp_secure: "false",
  smtp_user: "", smtp_pass: "", smtp_from: "", app_url: "",
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = (searchParams.get("tab") ?? "account") as Category;
  const [settings, setSettings] = useState<Settings>({
    discord_webhook: "", alert_discord_webhook: "", fmp_api_key: "", account_size: "10000", risk_per_trade: "1", commission_per_trade: "0",
    commission_model: "flat", commission_value: "0",
    heatmap_ranges: JSON.stringify({ high: 500, mid: 200, low: 1 }), charts_collapsed: "false", privacy_mode: "revealed",
    tv_hide_side_toolbar: "false", tv_withdateranges: "true", tv_details: "false", tv_hotlist: "false", tv_calendar: "false", tv_studies: JSON.stringify(["Moving Average Simple@tv-basicstudies"]),
    daily_loss_limit: "", daily_loss_limit_type: "dollar",
    default_tags: "[]", default_mistakes: JSON.stringify(["Entered too early", "Exited too early", "Exited too late", "Moved stop loss", "Oversized position", "No stop loss", "Chased the trade", "Revenge trade", "Ignored plan", "FOMO entry"]),
    trade_templates: "[]",
    strategies: JSON.stringify([
      { id: "wyckoff_buy", name: "Wyckoff Buying Tests", checklist: ["Downside objective accomplished", "Activity bullish (Vol increase on rallies)", "Preliminary support / Selling climax", "Relative strength (Bullish vs Market)", "Downward trendline broken", "Higher lows", "Higher highs", "Base forming (Cause)", "RR Potential 3:1 or better"] },
      { id: "wyckoff_sell", name: "Wyckoff Selling Tests", checklist: ["Upside objective accomplished", "Activity bearish (Vol increase on drops)", "Preliminary supply / Buying climax", "Relative weakness (Bearish vs Market)", "Upward trendline broken", "Lower highs", "Lower lows", "Top forming (Cause)", "RR Potential 3:1 or better"] }
    ])
  });

  // Strategy helpers
  const strategies = (() => { try { return JSON.parse(settings.strategies || "[]"); } catch { return []; } })();
  
  const updateStrategies = (newStrats: any[]) => {
    setSettings(s => ({ ...s, strategies: JSON.stringify(newStrats) }));
  };

  const addStrategy = () => {
    const newStrat = { id: crypto.randomUUID(), name: "New Strategy", checklist: ["Checklist Item 1"] };
    updateStrategies([...strategies, newStrat]);
  };

  const removeStrategy = (id: string) => {
    updateStrategies(strategies.filter((s: any) => s.id !== id));
  };

  const updateStrategyName = (id: string, name: string) => {
    updateStrategies(strategies.map((s: any) => s.id === id ? { ...s, name } : s));
  };

  const addChecklistItem = (stratId: string) => {
    updateStrategies(strategies.map((s: any) => s.id === stratId ? { ...s, checklist: [...s.checklist, ""] } : s));
  };

  const updateChecklistItem = (stratId: string, idx: number, val: string) => {
    updateStrategies(strategies.map((s: any) => s.id === stratId ? { 
      ...s, 
      checklist: s.checklist.map((item: string, i: number) => i === idx ? val : item) 
    } : s));
  };

  const removeChecklistItem = (stratId: string, idx: number) => {
    updateStrategies(strategies.map((s: any) => s.id === stratId ? { 
      ...s, 
      checklist: s.checklist.filter((_: any, i: number) => i !== idx) 
    } : s));
  };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [symbolCount, setSymbolCount] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>(
    CATEGORIES.some(c => c.id === initialCategory) ? initialCategory : "account"
  );

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [tfaSetup, setTfaSetup] = useState<TwoFactorSetup | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaMsg, setTfaMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [testingChart, setTestingChart] = useState(false);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [testingAlert, setTestingAlert] = useState(false);
  const [chartTestMsg, setChartTestMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [alertTestMsg, setAlertTestMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [sysSettings, setSysSettings] = useState<SystemSettings>(SYS_DEFAULTS);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysSaved, setSysSaved] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      setSettings(s => ({ ...s, ...data }));
      fetch("/api/trades").then(r => r.json()).then(trades => {
        if (Array.isArray(trades)) {
          const totalPnl = trades.filter((t: { status: string; pnl?: number }) => t.status === "closed")
            .reduce((sum: number, t: { pnl?: number }) => sum + (t.pnl ?? 0), 0);
          const startBal = parseFloat(data.account_size || "10000");
          setCurrentBalance(startBal + totalPnl);
        }
      }).catch(() => {});
    });
    fetch("/api/symbols?q=").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSymbolCount(data.length);
    }).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      setTwoFactorEnabled(!!data.twoFactorEnabled);
      setIsAdmin(!!data.isAdmin);
      setHasAdmin(!!data.hasAdmin);
    }).catch(() => {});
  }, []);

  // Admin data loading
  const loadAdminUsers = async () => {
    setAdminUsersLoading(true); setAdminUsersError("");
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setAdminUsers(data.users);
    else setAdminUsersError(data.error);
    setAdminUsersLoading(false);
  };

  const loadSysSettings = async () => {
    setSysLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    if (data.settings) setSysSettings(s => ({ ...s, ...data.settings }));
    setSysLoading(false);
  };

  useEffect(() => {
    if (activeCategory === "admin-users" && isAdmin && adminUsers.length === 0) loadAdminUsers();
    if (activeCategory === "admin-settings" && isAdmin && sysLoading === false && sysSettings === SYS_DEFAULTS) loadSysSettings();
  }, [activeCategory, isAdmin]);

  const toggleAdminRole = async (user: AdminUser) => {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !user.is_admin }),
    });
    if (res.ok) loadAdminUsers();
    else { const d = await res.json(); alert(d.error); }
  };

  const deleteAdminUser = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.email}? This is irreversible.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) loadAdminUsers();
    else { const d = await res.json(); alert(d.error); }
  };

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

  const claimAdmin = async () => {
    setClaiming(true); setClaimMsg(null);
    const res = await fetch("/api/admin/claim", { method: "POST" });
    const data = await res.json();
    setClaiming(false);
    if (res.ok) { window.location.href = "/admin"; }
    else { setClaimMsg({ text: data.error, type: "err" }); }
  };

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

  const testWebhook = async (which: "chart" | "alert") => {
    const url = which === "chart" ? settings.discord_webhook : settings.alert_discord_webhook;
    const setTesting = which === "chart" ? setTestingChart : setTestingAlert;
    const setMsg = which === "chart" ? setChartTestMsg : setAlertTestMsg;

    if (!url) { setMsg({ text: "Enter a webhook URL first", type: "err" }); return; }
    setTesting(true); setMsg(null);
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

  const exportTrades = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/trades");
      const allTrades = await res.json();
      if (!Array.isArray(allTrades) || allTrades.length === 0) return;

      const exportFields = [...TRADE_FIELDS, "pnl", "created_at"] as const;
      const cleaned = allTrades.map((t: Record<string, unknown>) => {
        const obj: Record<string, unknown> = {};
        for (const f of exportFields) { obj[f] = t[f] ?? null; }
        return obj;
      });

      let blob: Blob;
      let ext: string;
      if (format === "csv") {
        blob = new Blob([tradesToCsv(cleaned)], { type: "text/csv" });
        ext = "csv";
      } else {
        blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: "application/json" });
        ext = "json";
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-of-alpha-trades-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      let parsedTrades: Record<string, unknown>[];

      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        parsedTrades = Array.isArray(parsed) ? parsed : parsed.trades ?? [];
      } else {
        parsedTrades = csvToTrades(text);
      }

      if (parsedTrades.length === 0) {
        setImportResult({ imported: 0, skipped: 0, errors: ["No valid trades found in file."] });
        setImporting(false);
        return;
      }

      const res = await fetch("/api/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: parsedTrades }),
      });
      const result = await res.json();

      if (res.ok) { setImportResult(result); }
      else { setImportResult({ imported: 0, skipped: 0, errors: [result.error] }); }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ["Failed to parse file."] });
    } finally {
      setImporting(false);
    }
  };

  // 2FA handlers
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

  // Heatmap range helpers
  const heatRanges = (() => { try { return JSON.parse(settings.heatmap_ranges); } catch { return { high: 500, mid: 200, low: 1 }; } })();
  const setHeatRange = (key: string, value: number) => {
    const r = { ...heatRanges, [key]: value };
    setSettings(s => ({ ...s, heatmap_ranges: JSON.stringify(r) }));
  };

  const INPUT = "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const LABEL = "block text-sm font-medium dark:text-white text-slate-900 mb-1";
  const HINT  = "text-xs dark:text-slate-500 text-slate-400 mt-1";

  return (
    <div className="flex gap-6">
      {/* Category sidebar */}
      <nav className="hidden sm:flex flex-col w-48 shrink-0 sticky top-20 self-start space-y-1">
        {CATEGORIES.filter(c => !c.adminOnly).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveCategory(id)}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
              activeCategory === id
                ? "bg-emerald-500/15 text-emerald-400"
                : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
            )}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400">Admin</p>
            </div>
            {CATEGORIES.filter(c => c.adminOnly).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveCategory(id)}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                  activeCategory === id
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </>
        )}
        {!isAdmin && !hasAdmin && (
          <button onClick={() => setActiveCategory("account")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors text-left">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Claim Admin
          </button>
        )}
      </nav>

      {/* Mobile category tabs */}
      <div className="sm:hidden fixed top-14 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-sm border-b dark:border-slate-800 border-slate-200 px-4 py-2 flex gap-1 overflow-x-auto sidebar-push">
        {CATEGORIES.filter(c => !c.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveCategory(id)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              activeCategory === id
                ? "bg-emerald-500/15 text-emerald-400"
                : "dark:text-slate-400 text-slate-600"
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-6 sm:max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Settings</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">Configure your account preferences and integrations</p>
        </div>

        {/* ── Account ── */}
        {activeCategory === "account" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Account Settings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Starting Balance ($)</label>
                <input type="number" value={settings.account_size}
                  onChange={e => setSettings(s => ({ ...s, account_size: e.target.value }))} className={INPUT} />
                <p className={HINT}>Your initial trading capital</p>
                {currentBalance != null && (
                  <p className={`text-xs mt-1.5 font-medium ${currentBalance >= parseFloat(settings.account_size || "10000") ? "text-emerald-400" : "text-red-400"}`}>
                    Current Balance: ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Risk Per Trade (%)</label>
                <input type="number" step="0.1" value={settings.risk_per_trade}
                  onChange={e => setSettings(s => ({ ...s, risk_per_trade: e.target.value }))} className={INPUT} />
                <p className={HINT}>Max % of account to risk per trade</p>
              </div>
              <div>
                <label className={LABEL}>Commission Model</label>
                <select value={settings.commission_model}
                  onChange={e => setSettings(s => ({ ...s, commission_model: e.target.value }))} className={INPUT}>
                  <option value="flat">Flat (per trade)</option>
                  <option value="per_share">Per Share</option>
                  <option value="percent">Percentage</option>
                </select>
                <p className={HINT}>
                  {settings.commission_model === "flat" ? "Fixed $ per trade (×2 round trip)" :
                   settings.commission_model === "per_share" ? "$ per share (×2 round trip)" :
                   "% of total trade value"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Commission Value</label>
                <input type="number" step="0.01" value={settings.commission_value || settings.commission_per_trade}
                  onChange={e => setSettings(s => ({ ...s, commission_value: e.target.value, commission_per_trade: e.target.value }))} className={INPUT} />
                <p className={HINT}>
                  {settings.commission_model === "flat" ? "Dollar amount per trade" :
                   settings.commission_model === "per_share" ? "Dollar amount per share" :
                   "Percentage value (e.g., 0.1 for 0.1%)"}
                </p>
              </div>
              <div>
                <label className={LABEL}>Daily Loss Limit</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" value={settings.daily_loss_limit}
                    onChange={e => setSettings(s => ({ ...s, daily_loss_limit: e.target.value }))} className={INPUT} placeholder="No limit" />
                  <select value={settings.daily_loss_limit_type}
                    onChange={e => setSettings(s => ({ ...s, daily_loss_limit_type: e.target.value }))} className={INPUT + " w-24 shrink-0"}>
                    <option value="dollar">$</option>
                    <option value="percent">%</option>
                  </select>
                </div>
                <p className={HINT}>Max daily loss before warning ({settings.daily_loss_limit_type === "percent" ? "% of account" : "dollar amount"})</p>
              </div>
            </div>

            {/* Claim Admin */}
            {!isAdmin && !hasAdmin && (
              <div className="rounded-lg border border-amber-500/30 dark:bg-amber-500/5 bg-amber-50 p-4 space-y-3 mt-4">
                <h3 className="font-medium dark:text-white text-slate-900 flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Claim Admin Access
                </h3>
                <p className="text-xs dark:text-slate-400 text-slate-500">
                  No admin exists yet. Claim admin privileges to manage users and system settings.
                </p>
                {claimMsg && (
                  <p className={`text-sm rounded-lg px-3 py-2 ${claimMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {claimMsg.text}
                  </p>
                )}
                <button onClick={claimAdmin} disabled={claiming}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <ShieldCheck className="w-4 h-4" />
                  {claiming ? "Claiming..." : "Claim Admin"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Tags & Mistakes ── */}
        {activeCategory === "tags" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-6">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-emerald-400" /> Default Tags & Mistakes
            </h2>

            {/* Default Tags */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700">Quick-Select Tags</h3>
              <p className="text-xs dark:text-slate-500 text-slate-400">These appear as quick-select pills in the Trade Modal.</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  let tags: string[] = [];
                  try { tags = JSON.parse(settings.default_tags || "[]"); } catch {}
                  return tags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {tag}
                      <button type="button" onClick={() => {
                        const next = tags.filter((_, j) => j !== i);
                        setSettings(s => ({ ...s, default_tags: JSON.stringify(next) }));
                      }} className="hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ));
                })()}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a tag..."
                  className={INPUT + " flex-1"}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const val = (e.target as HTMLInputElement).value.trim();
                      let tags: string[] = [];
                      try { tags = JSON.parse(settings.default_tags || "[]"); } catch {}
                      if (!tags.includes(val)) {
                        setSettings(s => ({ ...s, default_tags: JSON.stringify([...tags, val]) }));
                      }
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>

            {/* Default Mistakes */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700">Mistake Options</h3>
              <p className="text-xs dark:text-slate-500 text-slate-400">Customizable list of common trading mistakes shown in the Reflection tab.</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  let mistakes: string[] = [];
                  try { mistakes = JSON.parse(settings.default_mistakes || "[]"); } catch {}
                  return mistakes.map((m, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      {m}
                      <button type="button" onClick={() => {
                        const next = mistakes.filter((_, j) => j !== i);
                        setSettings(s => ({ ...s, default_mistakes: JSON.stringify(next) }));
                      }} className="hover:text-white transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ));
                })()}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a mistake..."
                  className={INPUT + " flex-1"}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const val = (e.target as HTMLInputElement).value.trim();
                      let mistakes: string[] = [];
                      try { mistakes = JSON.parse(settings.default_mistakes || "[]"); } catch {}
                      if (!mistakes.includes(val)) {
                        setSettings(s => ({ ...s, default_mistakes: JSON.stringify([...mistakes, val]) }));
                      }
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* ── Templates ── */}
        {activeCategory === "templates" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <Copy className="w-4 h-4 text-emerald-400" /> Trade Templates
            </h2>
            <p className="text-xs dark:text-slate-500 text-slate-400">
              Save commonly used trade setups as templates. Load them in the Trade Modal to pre-fill fields.
            </p>
            {(() => {
              let templates: { id: string; name: string; fields: Record<string, unknown> }[] = [];
              try { templates = JSON.parse(settings.trade_templates || "[]"); } catch {}

              const removeTemplate = (id: string) => {
                setSettings(s => ({ ...s, trade_templates: JSON.stringify(templates.filter(t => t.id !== id)) }));
              };

              const updateTemplateName = (id: string, name: string) => {
                setSettings(s => ({ ...s, trade_templates: JSON.stringify(templates.map(t => t.id === id ? { ...t, name } : t)) }));
              };

              return (
                <div className="space-y-3">
                  {templates.length === 0 && (
                    <p className="text-sm dark:text-slate-500 text-slate-400 italic">No templates yet. Create one from the Trade Modal using "Save as Template".</p>
                  )}
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className="flex items-center gap-3 p-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200">
                      <input
                        type="text"
                        value={tmpl.name}
                        onChange={e => updateTemplateName(tmpl.id, e.target.value)}
                        className="flex-1 bg-transparent text-sm font-medium dark:text-white text-slate-900 outline-none"
                      />
                      <div className="flex items-center gap-2 text-xs dark:text-slate-500 text-slate-400 shrink-0">
                        {tmpl.fields.symbol ? <span>{String(tmpl.fields.symbol)}</span> : null}
                        {tmpl.fields.direction ? <span className="capitalize">{String(tmpl.fields.direction)}</span> : null}
                      </div>
                      <button onClick={() => removeTemplate(tmpl.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        )}

        {/* ── Display ── */}
        {activeCategory === "display" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-emerald-400" /> Activity Heatmap
            </h2>
            <p className="text-xs dark:text-slate-400 text-slate-500">
              Set P&L thresholds for heatmap colors. Amounts above "High" get the darkest shade, "Mid" to "High" medium, "Low" to "Mid" lightest.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>High Threshold ($)</label>
                <input type="number" value={heatRanges.high} onChange={e => setHeatRange("high", Number(e.target.value))} className={INPUT} />
                <p className={HINT}>Darkest green/red shade</p>
              </div>
              <div>
                <label className={LABEL}>Mid Threshold ($)</label>
                <input type="number" value={heatRanges.mid} onChange={e => setHeatRange("mid", Number(e.target.value))} className={INPUT} />
                <p className={HINT}>Medium green/red shade</p>
              </div>
              <div>
                <label className={LABEL}>Low Threshold ($)</label>
                <input type="number" value={heatRanges.low} onChange={e => setHeatRange("low", Number(e.target.value))} className={INPUT} />
                <p className={HINT}>Lightest green/red shade</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm dark:text-slate-300 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.charts_collapsed === "true"}
                  onChange={e => setSettings(s => ({ ...s, charts_collapsed: e.target.checked ? "true" : "false" }))}
                  className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
                Collapse charts by default
              </label>

              <div className="pt-2">
                <label className={LABEL}>Default Privacy Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSettings(s => ({ ...s, privacy_mode: "revealed" }))}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      settings.privacy_mode === "revealed"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-700 hover:bg-slate-200"
                    )}
                  >
                    <Eye className="w-4 h-4" /> Revealed
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, privacy_mode: "hidden" }))}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      settings.privacy_mode === "hidden"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-700 hover:bg-slate-200"
                    )}
                  >
                    <EyeOff className="w-4 h-4" /> Hidden
                  </button>
                </div>
                <p className={HINT}>Choose whether prices are hidden or shown by default when you load the app.</p>
              </div>
            </div>

            {/* Preview */}
            <div className="pt-2 border-t dark:border-slate-800 border-slate-100">
              <p className="text-xs dark:text-slate-500 text-slate-400 mb-2">Color preview</p>
              <div className="flex items-center gap-2 text-[10px] dark:text-slate-500 text-slate-400">
                <span>-${heatRanges.high}+</span>
                <div className="w-5 h-5 rounded" style={{ background: "#dc2626" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#ef4444" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#fca5a5" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#475569" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#86efac" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#22c55e" }} />
                <div className="w-5 h-5 rounded" style={{ background: "#16a34a" }} />
                <span>+${heatRanges.high}+</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Chart ── */}
        {activeCategory === "chart" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-6">
            <div>
              <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                <LineChart className="w-4 h-4 text-emerald-400" /> Chart Configuration
              </h2>
              <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">
                Customize the default appearance and features of the embedded TradingView charts.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Drawing Toolbar</p>
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">Show left-side drawing tools</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tv_hide_side_toolbar !== "true"}
                    onChange={e => setSettings(s => ({ ...s, tv_hide_side_toolbar: e.target.checked ? "false" : "true" }))}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Date Ranges</p>
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">Show bottom range selector (1D, 5D, 1M...)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tv_withdateranges !== "false"}
                    onChange={e => setSettings(s => ({ ...s, tv_withdateranges: e.target.checked ? "true" : "false" }))}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Symbol Details</p>
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">Show description panel on the right</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tv_details === "true"}
                    onChange={e => setSettings(s => ({ ...s, tv_details: e.target.checked ? "true" : "false" }))}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Market Hotlist</p>
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">Show gainers/losers on the right</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tv_hotlist === "true"}
                    onChange={e => setSettings(s => ({ ...s, tv_hotlist: e.target.checked ? "true" : "false" }))}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Economic Calendar</p>
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">Show events panel on the right</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tv_calendar === "true"}
                    onChange={e => setSettings(s => ({ ...s, tv_calendar: e.target.checked ? "true" : "false" }))}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="pt-2 border-t dark:border-slate-800 border-slate-100">
                <label className={LABEL}>Default Indicators (Studies)</label>
                <p className="text-[10px] dark:text-slate-400 text-slate-500 mb-3">
                  Choose indicators to load by default. <span className="text-emerald-400">Note:</span> The free version uses default lengths (e.g. 20). 
                  You can manually change the length (e.g. 150) and color (e.g. Red) directly on the chart, and it will be remembered.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "MAExp@tv-basicstudies", label: "Moving Average Exponential (EMA)" },
                    { id: "MASimple@tv-basicstudies", label: "Moving Average Simple (SMA)" },
                    { id: "RSI@tv-basicstudies", label: "Relative Strength Index (RSI)" },
                    { id: "MACD@tv-basicstudies", label: "MACD" },
                    { id: "StochasticRSI@tv-basicstudies", label: "Stochastic RSI" },
                    { id: "BollingerBands@tv-basicstudies", label: "Bollinger Bands" },
                    { id: "Volume@tv-basicstudies", label: "Volume" },
                  ].map(study => {
                    const currentStudies = (() => {
                      try { return JSON.parse(settings.tv_studies || "[]"); } catch { return []; }
                    })();
                    const isSelected = currentStudies.includes(study.id);
                    
                    return (
                      <button
                        key={study.id}
                        onClick={() => {
                          const next = isSelected 
                            ? currentStudies.filter((id: string) => id !== study.id)
                            : [...currentStudies, study.id];
                          setSettings(s => ({ ...s, tv_studies: JSON.stringify(next) }));
                        }}
                        className={clsx(
                          "flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                            : "dark:bg-slate-800/50 bg-slate-50 dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:border-slate-400"
                        )}
                      >
                        {study.label}
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pro Tips / Manual Customization */}
              <div className="pt-6 border-t dark:border-slate-800 border-slate-100">
                <h3 className="text-sm font-semibold dark:text-emerald-400 text-emerald-600 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Pro Tips: Manual Tuning
                </h3>
                <div className="space-y-4 rounded-xl dark:bg-slate-800/30 bg-slate-50 p-4 border dark:border-slate-800 border-slate-100">
                  <div className="space-y-1">
                    <p className="text-xs font-bold dark:text-slate-200 text-slate-700">Set MA to 150 (or any length)</p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                      TradingView's free embed always loads indicators with defaults (e.g. 9 or 20). 
                      To change it: Hover over the "MA" label on the chart → Click the gear icon (Settings) → Change Length to 150. 
                      Your browser will remember this setting for all symbols!
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold dark:text-slate-200 text-slate-700">Move Volume to a New Pane</p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                      If Volume is overlapping your price bars: Right-click the Volume bars on the chart → Select "Move to..." → "New Pane Below". 
                      This layout is persisted automatically in your browser.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold dark:text-slate-200 text-slate-700">Sidebar Behavior</p>
                    <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                      Enabling Details, Hotlist, or Calendar will force the right sidebar to open by default. 
                      Disable them here for a "borderless" look, and manually click the icons on the right of the chart to reveal them when needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Strategies ── */}
        {activeCategory === "strategies" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-emerald-400" /> Trade Strategies & Checklists
                </h2>
                <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">
                  Define custom checklists for different trading strategies.
                </p>
              </div>
              <button
                onClick={addStrategy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/10"
              >
                <Plus className="w-3.5 h-3.5" /> Add Strategy
              </button>
            </div>

            <div className="space-y-4">
              {strategies.map((strat: any) => {
                const isCollapsed = !expandedStrategies.has(strat.id);
                const toggleCollapse = () => setExpandedStrategies(prev => {
                  const next = new Set(prev);
                  if (next.has(strat.id)) next.delete(strat.id); else next.add(strat.id);
                  return next;
                });
                return (
                <div key={strat.id} className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white overflow-hidden">
                  <div className="p-4 dark:bg-slate-800/30 bg-slate-50/50 flex items-center gap-3">
                    <GripVertical className="w-4 h-4 dark:text-slate-600 text-slate-400 cursor-grab" />
                    <button type="button" onClick={toggleCollapse} className="p-0.5 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors shrink-0">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 dark:text-slate-400 text-slate-500" /> : <ChevronDown className="w-4 h-4 dark:text-slate-400 text-slate-500" />}
                    </button>
                    <input
                      type="text"
                      value={strat.name}
                      onChange={e => updateStrategyName(strat.id, e.target.value)}
                      className="flex-1 bg-transparent border-none p-0 font-bold dark:text-white text-slate-900 focus:ring-0 text-sm"
                      placeholder="Strategy Name"
                    />
                    <span className="text-[10px] font-medium dark:text-slate-500 text-slate-400 tabular-nums shrink-0">{strat.checklist.length} items</span>
                    <button
                      onClick={() => removeStrategy(strat.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {!isCollapsed && (
                  <div className="p-4 space-y-3 border-t dark:border-slate-800 border-slate-100">
                    <div className="space-y-2">
                      {strat.checklist.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md border dark:border-slate-700 border-slate-300 flex items-center justify-center text-[10px] dark:text-slate-500 text-slate-400 font-bold">
                            {idx + 1}
                          </div>
                          <input
                            type="text"
                            value={item}
                            onChange={e => updateChecklistItem(strat.id, idx, e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white dark:text-slate-300 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Checklist item..."
                          />
                          <button
                            onClick={() => removeChecklistItem(strat.id, idx)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addChecklistItem(strat.id)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors mt-2"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Integrations ── */}
        {activeCategory === "integrations" && (
          <>
            {/* FMP */}
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
                <label className={LABEL}>Chart Webhook URL</label>
                <input type="password" value={settings.discord_webhook}
                  onChange={e => setSettings(s => ({ ...s, discord_webhook: e.target.value }))}
                  placeholder="https://discord.com/api/webhooks/..." className={INPUT} />
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => testWebhook("chart")} disabled={testingChart}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" />
                    {testingChart ? "Sending..." : "Test Connection"}
                  </button>
                  {chartTestMsg && (
                    <span className={`text-xs ${chartTestMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                      {chartTestMsg.text}
                    </span>
                  )}
                </div>
                <p className={HINT}>Chart snapshots will be posted here.</p>
              </div>
              <div>
                <label className={LABEL}>Alerts Webhook URL</label>
                <input type="password" value={settings.alert_discord_webhook}
                  onChange={e => setSettings(s => ({ ...s, alert_discord_webhook: e.target.value }))}
                  placeholder="https://discord.com/api/webhooks/..." className={INPUT} />
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => testWebhook("alert")} disabled={testingAlert}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" />
                    {testingAlert ? "Sending..." : "Test Connection"}
                  </button>
                  {alertTestMsg && (
                    <span className={`text-xs ${alertTestMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                      {alertTestMsg.text}
                    </span>
                  )}
                </div>
                <p className={HINT}>Separate webhook for price alerts. Leave empty to use chart webhook.</p>
              </div>
            </section>
          </>
        )}

        {/* ── Security ── */}
        {activeCategory === "security" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Two-Factor Authentication
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm dark:text-white text-slate-900 font-medium">2FA Status</p>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {backupCodes.map(c => (
                    <code key={c} className="text-xs font-mono dark:bg-slate-800 bg-slate-100 px-2 py-1 rounded text-center dark:text-slate-300 text-slate-700">
                      {c}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {!twoFactorEnabled && !tfaSetup && (
              <button onClick={startTfaSetup}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
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
                        <ShieldCheck className="w-4 h-4" /> {tfaLoading ? "Enabling..." : "Enable 2FA"}
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
                  <ShieldOff className="w-4 h-4" /> {tfaLoading ? "Disabling..." : "Disable 2FA"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Data ── */}
        {activeCategory === "data" && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Data Management
            </h2>
            <p className="text-sm dark:text-slate-400 text-slate-500">
              Export your complete trading history for backup or import trades from a CSV or JSON file.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => exportTrades("csv")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> Export as CSV
              </button>
              <button onClick={() => exportTrades("json")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> Export as JSON
              </button>
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {importing ? "Importing..." : "Import Trades"}
                <input type="file" accept=".csv,.json" onChange={handleImportFile} disabled={importing} className="hidden" />
              </label>
            </div>
            {importResult && (
              <div className={`rounded-lg px-4 py-3 text-sm ${importResult.imported > 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                <div className="flex items-center justify-between">
                  <span className={importResult.imported > 0 ? "text-emerald-400" : "text-red-400"}>
                    {importResult.imported > 0
                      ? `Imported ${importResult.imported} trade${importResult.imported !== 1 ? "s" : ""} successfully.`
                      : "No trades imported."}
                    {importResult.skipped > 0 && ` ${importResult.skipped} skipped.`}
                  </span>
                  <button onClick={() => setImportResult(null)} className="dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 text-xs">
                    Dismiss
                  </button>
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs dark:text-slate-400 text-slate-500">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...and {importResult.errors.length - 10} more errors</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Admin: Users ── */}
        {activeCategory === "admin-users" && isAdmin && (
          <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
            <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> User Management
            </h2>

            {adminUsersLoading && <p className="text-sm dark:text-slate-400 text-slate-500">Loading...</p>}
            {adminUsersError && <p className="text-sm text-red-400">{adminUsersError}</p>}

            {!adminUsersLoading && !adminUsersError && adminUsers.length > 0 && (
              <div className="border dark:border-slate-700 border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-700 border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide hidden sm:table-cell">Joined</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map(user => (
                      <tr key={user.id} className="border-b dark:border-slate-700/50 border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold shrink-0">
                              {user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium dark:text-white text-slate-900 text-sm">{user.name}</span>
                                {!!user.is_admin && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Admin</span>
                                )}
                              </div>
                              <div className="dark:text-slate-400 text-slate-500 text-xs">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-xs hidden sm:table-cell">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            {user.email_verified ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <UserCheck className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs dark:text-slate-500 text-slate-400">
                                <UserX className="w-3.5 h-3.5" /> Unverified
                              </span>
                            )}
                            {!!user.two_factor_enabled && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 dark:text-slate-400 text-slate-500">2FA</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => toggleAdminRole(user)}
                              title={user.is_admin ? "Remove admin" : "Make admin"}
                              className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors dark:text-slate-400 text-slate-500">
                              {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                            </button>
                            <button onClick={() => deleteAdminUser(user)}
                              title="Delete user"
                              className="p-1.5 rounded-lg hover:dark:bg-red-500/10 hover:bg-red-50 transition-colors text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Admin: System Settings ── */}
        {activeCategory === "admin-settings" && isAdmin && (
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
                    <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-3">New User Defaults</h3>
                    <p className={HINT + " mb-3"}>These values are seeded for every new account at registration.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL}>Account Size ($)</label>
                        <input type="number" value={sysSettings.account_size}
                          onChange={e => setSysSettings(s => ({ ...s, account_size: e.target.value }))} className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Risk Per Trade (%)</label>
                        <input type="number" value={sysSettings.risk_per_trade} step="0.1"
                          onChange={e => setSysSettings(s => ({ ...s, risk_per_trade: e.target.value }))} className={INPUT} />
                      </div>
                    </div>
                  </div>

                  {/* App URL */}
                  <div className="pt-4 border-t dark:border-slate-800 border-slate-100">
                    <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-1">App URL</h3>
                    <p className={HINT + " mb-3"}>Used in email links. Leave blank to use the NEXT_PUBLIC_APP_URL env var.</p>
                    <input type="url" value={sysSettings.app_url}
                      onChange={e => setSysSettings(s => ({ ...s, app_url: e.target.value }))}
                      placeholder="https://yourdomain.com" className={INPUT} />
                  </div>

                  {/* SMTP */}
                  <div className="pt-4 border-t dark:border-slate-800 border-slate-100 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium dark:text-white text-slate-900 mb-1">SMTP Email</h3>
                      <p className={HINT + " mb-3"}>Leave all blank to fall back to .env.local vars.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className={LABEL}>SMTP Host</label>
                        <input type="text" value={sysSettings.smtp_host}
                          onChange={e => setSysSettings(s => ({ ...s, smtp_host: e.target.value }))}
                          placeholder="smtp.gmail.com" className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Port</label>
                        <input type="number" value={sysSettings.smtp_port}
                          onChange={e => setSysSettings(s => ({ ...s, smtp_port: e.target.value }))}
                          placeholder="587" className={INPUT} />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Security</label>
                      <select value={sysSettings.smtp_secure}
                        onChange={e => setSysSettings(s => ({ ...s, smtp_secure: e.target.value }))} className={INPUT}>
                        <option value="false">STARTTLS (port 587)</option>
                        <option value="true">SSL/TLS (port 465)</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Username</label>
                      <input type="text" value={sysSettings.smtp_user}
                        onChange={e => setSysSettings(s => ({ ...s, smtp_user: e.target.value }))}
                        placeholder="you@gmail.com" autoComplete="off" className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Password / App Password</label>
                      <div className="relative">
                        <input type={showSmtpPass ? "text" : "password"} value={sysSettings.smtp_pass}
                          onChange={e => setSysSettings(s => ({ ...s, smtp_pass: e.target.value }))}
                          placeholder="••••••••" autoComplete="new-password" className={`${INPUT} pr-10`} />
                        <button type="button" onClick={() => setShowSmtpPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-slate-400 text-slate-500">
                          {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>From Address</label>
                      <input type="text" value={sysSettings.smtp_from}
                        onChange={e => setSysSettings(s => ({ ...s, smtp_from: e.target.value }))}
                        placeholder='Ledger Of Alpha <noreply@yourdomain.com>' className={INPUT} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={saveSysSettings} disabled={sysSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50">
                      {sysSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {sysSaved ? "Saved!" : sysSaving ? "Saving..." : "Save System Settings"}
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* Save button — always visible */}
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
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
