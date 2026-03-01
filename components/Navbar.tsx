"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { BookOpen, LineChart, Settings, TrendingUp, Layout, ChevronDown, LogOut, User, ShieldCheck, Menu, X } from "lucide-react";
import clsx from "clsx";

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

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthPage = AUTH_PATHS.includes(pathname);

  useEffect(() => {
    if (isAuthPage) return;
    fetch("/api/auth/me").then(r => r.json()).then(setMe).catch(() => null);
  }, [pathname, isAuthPage]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isAuthPage) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isAuthPage]);

  // Hide on auth pages (after all hooks are called)
  if (isAuthPage) return null;

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = me?.name
    ? me.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b dark:border-slate-800 border-slate-200 bg-slate-950/95 dark:bg-slate-950/95 bg-white/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 font-bold text-sm sm:text-lg tracking-tight">
          <Logo className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-emerald-400">Ledger</span>
          <span className="hidden sm:inline dark:text-white text-slate-900">Of Alpha</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/40 hover:bg-slate-100"
                )}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {me?.guest ? (
            /* Guest badge — hidden on mobile (hamburger menu handles it) */
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 dark:text-slate-400 text-slate-500 border dark:border-slate-700 border-slate-300">
                Guest
              </span>
              <Link href="/register"
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                Sign Up
              </Link>
            </div>
          ) : me?.name ? (
            /* User menu */
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
                  {me?.isAdmin && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald-400 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                      <ShieldCheck className="w-4 h-4" /> Admin Panel
                    </Link>
                  )}
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

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed top-14 left-0 right-0 z-40 dark:bg-slate-900 bg-white border-b dark:border-slate-800 border-slate-200 shadow-xl">
          {/* Nav links */}
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors border-b dark:border-slate-800/60 border-slate-100",
                  active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50"
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}

          {/* User section */}
          {me?.name && (
            <>
              <div className="px-5 py-3 dark:bg-slate-800/40 bg-slate-50 border-b dark:border-slate-800 border-slate-200">
                <p className="text-xs font-semibold dark:text-white text-slate-900 truncate">{me.name}</p>
                <p className="text-xs dark:text-slate-400 text-slate-500 truncate mt-0.5">{me.email}</p>
              </div>
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-sm dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors border-b dark:border-slate-800/60 border-slate-100">
                <User className="w-4 h-4" /> Account Settings
              </Link>
              {me?.isAdmin && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm text-emerald-400 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors border-b dark:border-slate-800/60 border-slate-100">
                  <ShieldCheck className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-5 py-3.5 text-sm text-red-400 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          )}

          {me?.guest && (
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="text-sm dark:text-slate-400 text-slate-500">Browsing as guest</span>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}
                className="ml-auto text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
