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
  Power, Clock, Pencil, ChevronsLeft, ChevronsRight,
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
  try {
    const ctx = new AudioContext();
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
  } catch { /* AudioContext not available */ }
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
      <a
        href="https://www.tradingview.com"
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          "flex items-center py-3 text-sm font-medium dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100 transition-colors whitespace-nowrap",
          showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
        )}
        title={!showLabels ? "TradingView" : undefined}
      >
        <ExternalLink className="w-5 h-5 shrink-0" />
        {showLabels && <span>TradingView</span>}
      </a>
      {me?.isAdmin && (
        <Link href="/settings?tab=admin-users" onClick={() => setMobileOpen(false)}
          className={clsx(
            "flex items-center py-3 text-sm font-medium text-emerald-400 hover:dark:bg-slate-800/50 hover:bg-slate-100 transition-colors whitespace-nowrap",
            showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
          )}
          title={!showLabels ? "Admin" : undefined}
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          {showLabels && <span>Admin Panel</span>}
        </Link>
      )}
    </nav>
  );

  const nav = (
    <>
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-950/95 bg-white/95 backdrop-blur-sm">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Mobile: toggle overlay. Desktop: toggle expanded.
                if (window.innerWidth < 640) {
                  setMobileOpen(v => !v);
                } else {
                  setExpanded(v => !v);
                }
              }}
              className="p-2 rounded-lg dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-1.5 font-bold text-sm sm:text-lg tracking-tight">
              <Logo className="w-6 h-6 sm:w-7 sm:h-7" />
              <span className="text-emerald-400">Ledger</span>
              <span className="hidden sm:inline dark:text-white text-slate-900">Of Alpha</span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Bell icon + dropdown */}
            {me && !me.guest && (
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setBellOpen(v => !v)}
                  className="relative p-2 rounded-lg dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
                  title="Price Alerts"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-full mt-1 w-80 max-h-[70vh] overflow-y-auto dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 rounded-xl shadow-xl z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-800 border-slate-100">
                      <h3 className="text-sm font-semibold dark:text-white text-slate-900">Price Alerts</h3>
                      <button
                        onClick={() => { setEditAlert(null); setBellOpen(false); setShowAlertModal(true); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium transition-colors"
                      >
                        + New Alert
                      </button>
                    </div>

                    {recentTriggered.length > 0 && (
                      <div className="border-b dark:border-slate-800 border-slate-100">
                        <p className="px-4 py-2 text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-400 font-medium">Triggered</p>
                        {recentTriggered.map(a => (
                          <div key={`t-${a.id}`} className="px-4 py-2 flex items-center gap-2 hover:dark:bg-slate-800/50 hover:bg-slate-50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-emerald-400">{a.symbol}</span>
                                <span className="text-xs dark:text-slate-400 text-slate-500">
                                  {a.condition} ${a.target_price}
                                </span>
                              </div>
                              {a.note && <p className="text-xs dark:text-slate-500 text-slate-400 truncate">{a.note}</p>}
                            </div>
                            <span className="text-[10px] dark:text-slate-500 text-slate-400 whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {a.triggered_at ? timeAgo(a.triggered_at) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeAlerts.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-400 font-medium">Active</p>
                        {activeAlerts.map(a => (
                          <div key={`a-${a.id}`} className="px-4 py-2 flex items-center gap-2 hover:dark:bg-slate-800/50 hover:bg-slate-50 group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-emerald-400">{a.symbol}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  a.condition === "above" ? "bg-emerald-500/10 text-emerald-400"
                                  : a.condition === "below" ? "bg-red-500/10 text-red-400"
                                  : "bg-blue-500/10 text-blue-400"
                                }`}>
                                  {a.condition} ${a.target_price}
                                </span>
                                {a.repeating === 1 && (
                                  <span className="text-[10px] dark:text-slate-500 text-slate-400">repeat</span>
                                )}
                              </div>
                              {a.note && <p className="text-xs dark:text-slate-500 text-slate-400 truncate">{a.note}</p>}
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditAlert(a); setBellOpen(false); setShowAlertModal(true); }}
                                className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleToggleAlert(a.id, false)}
                                className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                                title="Deactivate"
                              >
                                <Power className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteAlert(a.id)}
                                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {alerts.filter(a => !a.active).length > 0 && (
                      <div className="border-t dark:border-slate-800 border-slate-100">
                        <p className="px-4 py-2 text-[10px] uppercase tracking-wider dark:text-slate-500 text-slate-400 font-medium">Inactive</p>
                        {alerts.filter(a => !a.active).slice(0, 5).map(a => (
                          <div key={`i-${a.id}`} className="px-4 py-2 flex items-center gap-2 hover:dark:bg-slate-800/50 hover:bg-slate-50 group opacity-50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium dark:text-slate-400 text-slate-500">{a.symbol}</span>
                                <span className="text-xs dark:text-slate-500 text-slate-400">
                                  {a.condition} ${a.target_price}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleToggleAlert(a.id, true)}
                                className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                                title="Reactivate"
                              >
                                <Power className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteAlert(a.id)}
                                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {alerts.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-8 h-8 mx-auto dark:text-slate-700 text-slate-300 mb-2" />
                        <p className="text-sm dark:text-slate-500 text-slate-400">No alerts yet</p>
                        <p className="text-xs dark:text-slate-600 text-slate-400 mt-1">Create one to get notified when prices hit your targets</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {me?.guest ? (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 dark:text-slate-400 text-slate-500 border dark:border-slate-700 border-slate-300">
                  Guest
                </span>
                <Link href="/register"
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                  Sign Up
                </Link>
              </div>
            ) : me?.name ? (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                  <span className="hidden sm:block text-sm dark:text-slate-300 text-slate-700 max-w-[120px] truncate">
                    {me.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 rounded-xl shadow-xl py-1 z-50">
                    <div className="px-3 py-2 border-b dark:border-slate-800 border-slate-100">
                      <p className="text-xs font-medium dark:text-white text-slate-900 truncate">{me.name}</p>
                      <p className="text-xs dark:text-slate-400 text-slate-500 truncate">{me.email}</p>
                    </div>
                    <Link href="/settings" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                      <User className="w-4 h-4" /> Account Settings
                    </Link>
                    <button onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Sidebar ── */}
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 top-14 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={clsx(
        "fixed top-14 left-0 bottom-0 z-40 flex flex-col border-r dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white transition-all duration-200 overflow-hidden",
        // Mobile: hidden unless open
        mobileOpen ? "max-sm:w-56" : "max-sm:w-0 max-sm:border-r-0",
        // Desktop: collapsed or expanded
        expanded ? "sm:w-56" : "sm:w-16",
      )}>
        {/* Nav links */}
        {sidebarLinks}

        {/* Spacer */}
        <div className="flex-1" />

        {/* User info in sidebar (mobile) */}
        {me?.name && mobileOpen && (
          <div className="sm:hidden border-t dark:border-slate-800 border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">{me.name}</p>
            <p className="text-xs dark:text-slate-400 text-slate-500 truncate mt-0.5">{me.email}</p>
            <button onClick={() => { handleSignOut(); setMobileOpen(false); }}
              className="flex items-center gap-2 mt-2 text-sm text-red-400">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={clsx(
            "hidden sm:flex items-center py-3 text-sm dark:text-slate-500 text-slate-400 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100 transition-colors whitespace-nowrap border-t dark:border-slate-800 border-slate-200",
            expanded ? "gap-3 pl-5 pr-4" : "justify-center px-0",
          )}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded
            ? <><ChevronsLeft className="w-5 h-5 shrink-0" /><span>Collapse</span></>
            : <ChevronsRight className="w-5 h-5 shrink-0" />}
        </button>
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
