"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const LINKS = [
  { href: "/admin/users",    label: "Users",    icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pt-14">
      <div className="max-w-screen-xl mx-auto px-4 py-6 sm:py-8 flex flex-col sm:flex-row gap-4 sm:gap-8">
        {/* Sidebar — horizontal tabs on mobile, vertical on desktop */}
        <aside className="sm:w-48 shrink-0">
          <div className="hidden sm:flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold dark:text-white text-slate-900">Admin</span>
          </div>
          <nav className="flex sm:flex-col gap-1 border-b sm:border-b-0 dark:border-slate-800 border-slate-200 pb-3 sm:pb-0">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 hover:dark:text-white hover:text-slate-900"
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
