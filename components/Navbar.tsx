"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { BarChart2, BookOpen, LineChart, Settings, TrendingUp, Layout } from "lucide-react";
import clsx from "clsx";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: Layout },
  { href: "/trades", label: "Trades", icon: TrendingUp },
  { href: "/planner", label: "Planner", icon: BarChart2 },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/chart", label: "Chart", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-800 dark:border-slate-800 border-slate-200 bg-slate-950/95 dark:bg-slate-950/95 bg-white/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Logo className="w-7 h-7" />
          <span className="text-emerald-400">Ledger</span>
          <span className="dark:text-white text-slate-900">Of Alpha</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:bg-slate-800/40 dark:hover:bg-slate-800/40 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        <ThemeToggle />
      </div>
    </nav>
  );
}
