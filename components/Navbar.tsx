"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import AlertModal from "./AlertModal";
import {
  BookOpen, LineChart, Settings, TrendingUp, Layout, ChevronDown,
  LogOut, User, ShieldCheck, Menu, X, ExternalLink, Bell, Trash2,
  Power, Clock, Pencil, ChevronsLeft, ChevronsRight, Eye, EyeOff,
} from "lucide-react";
import clsx from "clsx";
import type { Alert } from "@/lib/types";

interface AlertToast {
  id: number;
  symbol: string;
  condition: string;
  target_price: number;
  note: string | null;
  ts: number;
}

function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.15);
    play(1100, 0.18, 0.2);
  } catch { /* silent */ }
}

const NAV_LINKS = [
  { href: "/",        label: "Dashboard", icon: Layout },
  { href: "/trades",  label: "Trades",    icon: TrendingUp },
  { href: "/journal", label: "Journal",   icon: BookOpen },
  { href: "/chart",   label: "Chart",     icon: LineChart },
  { href: "/settings",label: "Settings",  icon: Settings },
];

const AUTH_PATHS = ["/login", "/register", "/verify-2fa"];

interface MeResponse {
  guest?: boolean;
  name?: string;
  email?: string | null;
  id?: string;
  isAdmin?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthPage = AUTH_PATHS.includes(pathname);

  // ── Sidebar state ──
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Alert state ──
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editAlert, setEditAlert] = useState<Alert | null>(null);
  const prevQuotes = useRef<Record<string, number>>({});
  const cooldowns = useRef<Map<number, number>>(new Map());
  const checkerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [mounted, setMounted] = useState(false);

  // ── Sidebar persistence ──
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_expanded");
    if (saved === "true") setExpanded(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar_expanded", String(expanded));
    document.documentElement.setAttribute("data-sidebar", expanded ? "expanded" : "collapsed");
  }, [expanded]);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) setAlerts(await res.json());
    } catch { /* silent */ }
  }, []);

  // ── Alert checker (60s polling) ──
  const checkAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) return;
      const allAlerts: Alert[] = await res.json();
      setAlerts(allAlerts);

      const active = allAlerts.filter(a => a.active);
      if (active.length === 0) return;

      const symbols = [...new Set(active.map(a => a.symbol))];
      const qRes = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      if (!qRes.ok) return;
      const quotes: Record<string, number> = await qRes.json();

      const now = Date.now();
      const triggeredIds: number[] = [];

      for (const alert of active) {
        const price = quotes[alert.symbol];
        if (price === undefined) continue;

        const cd = cooldowns.current.get(alert.id);
        if (cd && now - cd < 5 * 60 * 1000) continue;

        let triggered = false;
        if (alert.condition === "above") {
          triggered = price >= alert.target_price;
        } else if (alert.condition === "below") {
          triggered = price <= alert.target_price;
        } else if (alert.condition === "crosses") {
          const prev = prevQuotes.current[alert.symbol];
          if (prev !== undefined) {
            const crossedUp = prev < alert.target_price && price >= alert.target_price;
            const crossedDown = prev > alert.target_price && price <= alert.target_price;
            triggered = crossedUp || crossedDown;
          }
        }

        if (triggered) {
          triggeredIds.push(alert.id);
          cooldowns.current.set(alert.id, now);
        }
      }

      prevQuotes.current = quotes;

      if (triggeredIds.length > 0) {
        const triggeredDetails = active.filter(a => triggeredIds.includes(a.id));

        const tRes = await fetch("/api/alerts/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triggered: triggeredIds }),
        });
        if (tRes.ok) {
          const updated: Alert[] = await tRes.json();
          setAlerts(prev => {
            const map = new Map(prev.map(a => [a.id, a]));
            for (const u of updated) map.set(u.id, u);
            return [...map.values()].sort((a, b) => {
              if (a.active !== b.active) return b.active - a.active;
              return b.created_at.localeCompare(a.created_at);
            });
          });

          playAlertSound();
          const newToasts: AlertToast[] = triggeredDetails.map(a => ({
            id: a.id,
            symbol: a.symbol,
            condition: a.condition,
            target_price: a.target_price,
            note: a.note,
            ts: Date.now(),
          }));
          setToasts(prev => [...prev, ...newToasts]);
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isAuthPage) return;
    fetch("/api/auth/me").then(r => r.json()).then(setMe).catch(() => null);
  }, [pathname, isAuthPage]);

  useEffect(() => {
    if (isAuthPage) return;
    loadAlerts();
    const initial = setTimeout(() => {
      checkAlerts();
      checkerRef.current = setInterval(checkAlerts, 60_000);
    }, 5000);
    return () => {
      clearTimeout(initial);
      if (checkerRef.current) clearInterval(checkerRef.current);
    };
  }, [isAuthPage, loadAlerts, checkAlerts]);

  useEffect(() => { setMounted(true); }, []);

  // Auto-dismiss toasts after 8s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.ts < 8000));
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  useEffect(() => {
    if (isAuthPage) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isAuthPage]);

  if (isAuthPage) return null;

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleToggleAlert(id: number, active: boolean) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    loadAlerts();
  }

  async function handleDeleteAlert(id: number) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    loadAlerts();
  }

  const [hidden, setHidden] = useState(false);

  // ── Privacy persistence ──
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        const isHidden = data.privacy_mode === "hidden";
        setHidden(isHidden);
        localStorage.setItem("privacy_hidden", String(isHidden));
      })
      .catch(() => {});
      
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "privacy_hidden") setHidden(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleHidden = async () => {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem("privacy_hidden", String(next));
    window.dispatchEvent(new StorageEvent("storage", { key: "privacy_hidden", newValue: String(next) }));
    
    // Persist to DB (skip for guests)
    if (me && !me.guest) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy_mode: next ? "hidden" : "revealed" }),
      });
    }
  };

  const initials = me?.name
    ? me.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const activeAlerts = alerts.filter(a => a.active);
  const triggeredAlerts = alerts.filter(a => a.triggered_at);
  const recentTriggered = triggeredAlerts.slice(0, 10);
  const unreadCount = triggeredAlerts.filter(a => {
    if (!a.triggered_at) return false;
    const diff = Date.now() - new Date(a.triggered_at).getTime();
    return diff < 3600_000;
  }).length;

  // Show labels only when expanded (desktop) or mobile overlay open
  const showLabels = expanded || mobileOpen;

  // ── Sidebar nav items rendering ──
  const sidebarLinks = (
    <nav className="flex flex-col py-2">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)}
            className={clsx(
              "flex items-center py-3 text-sm font-medium transition-colors whitespace-nowrap",
              showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
              active
                ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-400"
                : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
            )}
            title={!showLabels ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {showLabels && <span>{label}</span>}
          </Link>
        );
      })}
      
      {/* Alerts in main menu */}
      {me && !me.guest && (
        <Link
          href="/alerts"
          onClick={() => setMobileOpen(false)}
          className={clsx(
            "flex items-center py-3 text-sm font-medium transition-colors whitespace-nowrap w-full relative",
            showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
            pathname === "/alerts"
              ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-400"
              : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
          )}
          title={!showLabels ? "Alerts" : undefined}
        >
          <Bell className="w-5 h-5 shrink-0" />
          {showLabels && <span>Alerts</span>}
          {unreadCount > 0 && (
            <span className={clsx(
              "absolute rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center",
              showLabels ? "right-4 w-4 h-4" : "top-2 right-2 w-3.5 h-3.5"
            )}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      )}

      <a
        href="https://www.tradingview.com/chart/"
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          "flex items-center py-3 text-sm font-medium dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100 transition-colors whitespace-nowrap",
          showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
        )}
        title={!showLabels ? "TradingView Chart" : undefined}
      >
        <ExternalLink className="w-5 h-5 shrink-0" />
        {showLabels && <span>TradingView</span>}
      </a>
    </nav>
  );

  const nav = (
    <>
      {/* ── Mobile Hamburger ── */}
      <div className="sm:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="p-2 rounded-lg bg-white dark:bg-slate-950 border dark:border-slate-800 border-slate-200 shadow-lg dark:text-slate-400 text-slate-600"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Sidebar ── */}
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={clsx(
        "fixed top-0 left-0 bottom-0 z-40 flex flex-col border-r dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white transition-all duration-200",
        // Mobile: hidden unless open
        mobileOpen ? "max-sm:w-64" : "max-sm:w-0 max-sm:border-r-0",
        // Desktop: collapsed or expanded
        expanded ? "sm:w-64" : "sm:w-16",
      )}>
        {/* Desktop Collapse Toggle on the border line */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="hidden sm:flex absolute top-6 -right-3 z-50 w-6 h-6 items-center justify-center rounded-full border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 shadow-md transition-colors"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
        </button>

        <div className="flex flex-col h-full w-full">
          {/* Sidebar Logo */}
          <div className={clsx(
            "h-16 flex items-center shrink-0 border-b dark:border-slate-800/50 border-slate-100/50 overflow-hidden",
            showLabels ? "px-5" : "justify-center px-0"
          )}>
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <Logo className="w-7 h-7 shrink-0" />
              {showLabels && (
                <div className="flex items-center gap-1">
                  <span className="text-emerald-400">Ledger</span>
                  <span className="dark:text-white text-slate-900">Of Alpha</span>
                </div>
              )}
            </Link>
          </div>

          {/* Nav links */}
          <div className="flex-1 overflow-y-auto">
            {sidebarLinks}
          </div>

          {/* Bottom Links (above user) */}
          <div className="border-t dark:border-slate-800/50 border-slate-100/50 py-1">
            <a
              href="https://www.tradingview.com/chart/"
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex items-center py-3 text-sm font-medium dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100 transition-colors whitespace-nowrap",
                showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
              )}
              title={!showLabels ? "TradingView Chart" : undefined}
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              {showLabels && <span>TradingView</span>}
            </a>
          </div>

          {/* User / Settings at bottom */}
          <div className="mt-auto border-t dark:border-slate-800 border-slate-200">
            {me?.name ? (
              <div className="relative px-2 py-3" ref={menuRef}>
                <button onClick={() => setMenuOpen(v => !v)}
                  className={clsx(
                    "flex items-center w-full p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors",
                    showLabels ? "gap-3" : "justify-center"
                  )}
                >
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
                    me.guest ? "bg-slate-500" : "bg-emerald-600"
                  )}>
                    {initials}
                  </div>
                  {showLabels && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold dark:text-white text-slate-900 truncate">{me.name}</p>
                      <p className="text-[10px] dark:text-slate-500 text-slate-400 truncate uppercase tracking-wider">
                        {me.guest ? "Guest Mode" : me.isAdmin ? "Administrator" : "Trader"}
                      </p>
                    </div>
                  )}
                </button>

                {menuOpen && (
                  <div className={clsx(
                    "absolute bottom-full left-2 right-2 mb-2 dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50",
                    !showLabels && "w-48 left-14 bottom-2"
                  )}>
                    <div className="px-4 py-3 border-b dark:border-slate-800 border-slate-100">
                      <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">{me.name}</p>
                      <p className="text-[10px] dark:text-slate-500 text-slate-400 truncate mt-0.5">{me.email || "No account"}</p>
                    </div>
                    
                    {me.guest && (
                      <div className="p-2 border-b dark:border-slate-800 border-slate-100">
                        <Link href="/register" onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-center w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                          Create Account
                        </Link>
                      </div>
                    )}

                    {/* Theme Toggle inside user menu */}
                    <div className="px-2 py-1.5 border-b dark:border-slate-800 border-slate-100">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-xs dark:text-slate-400 text-slate-500 font-medium">Privacy Mode</span>
                        <button
                          onClick={toggleHidden}
                          className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
                          title={hidden ? "Show numbers" : "Hide numbers"}
                        >
                          {hidden
                            ? <EyeOff className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                            : <Eye className="w-4 h-4 dark:text-slate-400 text-slate-500" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-xs dark:text-slate-400 text-slate-500 font-medium">Appearance</span>
                        <ThemeToggle />
                      </div>
                    </div>

                    <div className="p-1">
                      {me?.isAdmin && (
                        <Link href="/admin" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald-400 hover:dark:bg-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
                          <ShieldCheck className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      {!me.guest && (
                        <Link href="/settings" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
                          <Settings className="w-4 h-4" /> Account Settings
                        </Link>
                      )}
                      <button onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:dark:bg-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
                        <LogOut className="w-4 h-4" /> {me.guest ? "Exit Guest Mode" : "Sign Out"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Alert modal */}
      <AlertModal
        open={showAlertModal}
        onClose={() => { setShowAlertModal(false); setEditAlert(null); }}
        onSaved={loadAlerts}
        editAlert={editAlert}
      />
    </>
  );

  // Portal toasts outside the nav
  const toastPortal = mounted && toasts.length > 0 ? createPortal(
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={`${t.id}-${t.ts}`}
          className="pointer-events-auto rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl p-4"
          style={{ animation: "slideInRight 0.3s ease-out" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-400">{t.symbol}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  t.condition === "above" ? "bg-emerald-500/10 text-emerald-400"
                  : t.condition === "below" ? "bg-red-500/10 text-red-400"
                  : "bg-blue-500/10 text-blue-400"
                }`}>
                  {t.condition} ${t.target_price}
                </span>
              </div>
              {t.note && (
                <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 truncate">{t.note}</p>
              )}
              <p className="text-[10px] dark:text-slate-500 text-slate-400 mt-1">Price alert triggered</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.ts !== t.ts))}
              className="p-0.5 rounded hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return <>{nav}{toastPortal}</>;
}
