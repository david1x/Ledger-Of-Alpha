"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import { CATEGORIES } from "@/components/settings/types";
import type { Category } from "@/components/settings/types";

import AccountTab from "@/components/settings/tabs/AccountTab";
import AccountsTab from "@/components/settings/tabs/AccountsTab";
import TagsTab from "@/components/settings/tabs/TagsTab";
import TemplatesTab from "@/components/settings/tabs/TemplatesTab";
import AppearanceTab from "@/components/settings/tabs/AppearanceTab";
import ChartTab from "@/components/settings/tabs/ChartTab";
import StrategiesTab from "@/components/settings/tabs/StrategiesTab";
import IntegrationsTab from "@/components/settings/tabs/IntegrationsTab";
import BrokerTab from "@/components/settings/tabs/BrokerTab";
import SecurityTab from "@/components/settings/tabs/SecurityTab";
import DataTab from "@/components/settings/tabs/DataTab";
import AdminUsersTab from "@/components/settings/tabs/AdminUsersTab";
import AdminSettingsTab from "@/components/settings/tabs/AdminSettingsTab";

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = (searchParams.get("tab") ?? "account") as Category;
  const [activeCategory, setActiveCategory] = useState<Category>(
    CATEGORIES.some((c) => c.id === initialCategory) ? initialCategory : "account"
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [dirtyTabs, setDirtyTabs] = useState<Set<Category>>(new Set());

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(!!data.isAdmin);
        setHasAdmin(!!data.hasAdmin);
      })
      .catch(() => {});
  }, []);

  // Listen for dirty/clean events from tab components
  useEffect(() => {
    const onDirty = (e: Event) => {
      const tab = (e as CustomEvent).detail as Category;
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    };
    const onClean = (e: Event) => {
      const tab = (e as CustomEvent).detail as Category;
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete(tab);
        return next;
      });
    };
    window.addEventListener("settings-dirty", onDirty);
    window.addEventListener("settings-clean", onClean);
    return () => {
      window.removeEventListener("settings-dirty", onDirty);
      window.removeEventListener("settings-clean", onClean);
    };
  }, []);

  const active = activeCategory;

  return (
    <div className="flex gap-6">
      {/* Category sidebar */}
      <nav className="hidden sm:flex flex-col w-48 shrink-0 sticky top-20 self-start space-y-1">
        {CATEGORIES.filter((c) => !c.adminOnly).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
              activeCategory === id
                ? "bg-emerald-500/15 text-emerald-400"
                : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {dirtyTabs.has(id) && (
              <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
            )}
          </button>
        ))}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400">
                Admin
              </p>
            </div>
            {CATEGORIES.filter((c) => c.adminOnly).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                  activeCategory === id
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {dirtyTabs.has(id) && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                )}
              </button>
            ))}
          </>
        )}
        {!isAdmin && !hasAdmin && (
          <button
            onClick={() => setActiveCategory("account")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Claim Admin
          </button>
        )}
      </nav>

      {/* Mobile category tabs */}
      <div className="sm:hidden fixed top-14 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-sm border-b dark:border-slate-800 border-slate-200 px-4 py-2 flex gap-1 overflow-x-auto sidebar-push">
        {CATEGORIES.filter((c) => !c.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              activeCategory === id
                ? "bg-emerald-500/15 text-emerald-400"
                : "dark:text-slate-400 text-slate-600"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {dirtyTabs.has(id) && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-6 min-h-[80vh] max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Settings</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">
            Configure your account preferences and integrations
          </p>
        </div>

        {active === "account" && <AccountTab />}
        {active === "tags" && <TagsTab />}
        {active === "templates" && <TemplatesTab />}
        {active === "display" && <AppearanceTab />}
        {active === "chart" && <ChartTab />}
        {active === "strategies" && <StrategiesTab />}
        {active === "integrations" && <IntegrationsTab />}
        {active === "broker" && <BrokerTab />}
        {active === "security" && <SecurityTab />}
        {active === "data" && <DataTab />}
        {active === "accounts" && <AccountsTab />}
        {active === "admin-users" && isAdmin && <AdminUsersTab isAdmin={isAdmin} />}
        {active === "admin-settings" && isAdmin && <AdminSettingsTab isAdmin={isAdmin} />}
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
