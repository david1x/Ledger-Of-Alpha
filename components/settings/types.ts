import type { DollarSign } from "lucide-react";

export interface Settings {
  discord_webhook: string;
  alert_discord_webhook: string;
  fmp_api_key: string;
  openai_api_key: string;
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
  montecarlo_ruin_threshold: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrDataUrl: string;
}

export type Category =
  | "account"
  | "accounts"
  | "tags"
  | "templates"
  | "display"
  | "chart"
  | "strategies"
  | "integrations"
  | "broker"
  | "security"
  | "data"
  | "admin-users"
  | "admin-settings";

export interface CategoryDef {
  id: Category;
  label: string;
  icon: typeof DollarSign;
  adminOnly?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  email_verified: number;
  two_factor_enabled: number;
  is_admin: number;
  created_at: string;
}

export interface SystemSettings {
  account_size: string;
  risk_per_trade: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  app_url: string;
  fmp_api_key: string;
  openai_api_key: string;
}

export const SYS_DEFAULTS: SystemSettings = {
  account_size: "10000",
  risk_per_trade: "1",
  smtp_host: "",
  smtp_port: "587",
  smtp_secure: "false",
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  app_url: "",
  fmp_api_key: "",
  openai_api_key: "",
};

export const INITIAL_SETTINGS: Settings = {
  discord_webhook: "",
  alert_discord_webhook: "",
  fmp_api_key: "",
  openai_api_key: "",
  account_size: "10000",
  risk_per_trade: "1",
  commission_per_trade: "0",
  commission_model: "flat",
  commission_value: "0",
  heatmap_ranges: JSON.stringify({ high: 500, mid: 200, low: 1 }),
  charts_collapsed: "false",
  privacy_mode: "revealed",
  tv_hide_side_toolbar: "false",
  tv_withdateranges: "true",
  tv_details: "false",
  tv_hotlist: "false",
  tv_calendar: "false",
  tv_studies: JSON.stringify(["Moving Average Simple@tv-basicstudies"]),
  daily_loss_limit: "",
  daily_loss_limit_type: "dollar",
  default_tags: "[]",
  default_mistakes: JSON.stringify([
    "Entered too early",
    "Exited too early",
    "Exited too late",
    "Moved stop loss",
    "Oversized position",
    "No stop loss",
    "Chased the trade",
    "Revenge trade",
    "Ignored plan",
    "FOMO entry",
  ]),
  trade_templates: "[]",
  montecarlo_ruin_threshold: "5",
  strategies: JSON.stringify([
    {
      id: "wyckoff_buy",
      name: "Wyckoff Buying Tests",
      checklist: [
        "Downside objective accomplished",
        "Activity bullish (Vol increase on rallies)",
        "Preliminary support / Selling climax",
        "Relative strength (Bullish vs Market)",
        "Downward trendline broken",
        "Higher lows",
        "Higher highs",
        "Base forming (Cause)",
        "RR Potential 3:1 or better",
      ],
    },
    {
      id: "wyckoff_sell",
      name: "Wyckoff Selling Tests",
      checklist: [
        "Upside objective accomplished",
        "Activity bearish (Vol increase on drops)",
        "Preliminary supply / Buying climax",
        "Relative weakness (Bearish vs Market)",
        "Upward trendline broken",
        "Lower highs",
        "Lower lows",
        "Top forming (Cause)",
        "RR Potential 3:1 or better",
      ],
    },
    {
      id: "momentum_breakout",
      name: "Momentum Breakout",
      checklist: [
        "Price above key resistance level",
        "Volume 1.5x+ average on breakout",
        "Relative strength vs index",
        "No major overhead supply within 1R",
        "Trend aligned on higher timeframe",
      ],
    },
    {
      id: "mean_reversion",
      name: "Mean Reversion",
      checklist: [
        "Extended from 20 EMA (2+ ATR)",
        "RSI divergence present",
        "Volume climax / exhaustion",
        "Key support/resistance nearby",
        "Catalyst or event risk clear",
      ],
    },
    {
      id: "ema_pullback",
      name: "EMA Pullback",
      checklist: [
        "Established uptrend (higher highs/lows)",
        "Pullback to 21 EMA on daily",
        "Hold above prior swing low",
        "Volume declining on pullback",
        "Bullish candle pattern at EMA",
      ],
    },
  ]),
};

// Dirty-state signaling between tabs and shell
export function markTabDirty(tab: Category) {
  window.dispatchEvent(new CustomEvent("settings-dirty", { detail: tab }));
}
export function markTabClean(tab: Category) {
  window.dispatchEvent(new CustomEvent("settings-clean", { detail: tab }));
}

// Hook for tab-level dirty tracking
import { useEffect, useRef } from "react";

export function useTabDirty<T extends object>(tab: Category, current: T) {
  const baselineRef = useRef<T | null>(null);
  const dirtyRef = useRef(false);

  // Set baseline on first render (after fetch updates state)
  useEffect(() => {
    // Skip the initial empty/default state — wait for fetch
    const timer = setTimeout(() => {
      if (!baselineRef.current) baselineRef.current = { ...current };
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compare current vs baseline
  useEffect(() => {
    if (!baselineRef.current) return;
    const cur = current as Record<string, unknown>;
    const base = baselineRef.current as Record<string, unknown>;
    const isDirty = Object.keys(base).some((k) => cur[k] !== base[k]);
    if (isDirty && !dirtyRef.current) {
      dirtyRef.current = true;
      markTabDirty(tab);
    } else if (!isDirty && dirtyRef.current) {
      dirtyRef.current = false;
      markTabClean(tab);
    }
  }, [current, tab]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) markTabClean(tab);
    };
  }, [tab]);

  // Call after successful save to reset baseline
  const resetBaseline = () => {
    baselineRef.current = { ...current };
    dirtyRef.current = false;
    markTabClean(tab);
  };

  return { resetBaseline };
}

// CSS class constants (shared across tabs)
export const INPUT =
  "w-full px-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
export const LABEL = "block text-sm font-medium dark:text-white text-slate-900 mb-1";
export const HINT = "text-xs dark:text-slate-500 text-slate-400 mt-1";
export const CARD = "rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4";

// CATEGORIES uses a Lucide icon type — imported here for the type definition
import {
  DollarSign as DollarSignIcon,
  Wallet,
  ListChecks,
  Copy,
  Grid3X3,
  LineChart,
  Key,
  Cable,
  ShieldCheck,
  Database,
  Users,
  Settings,
} from "lucide-react";

export const CATEGORIES: CategoryDef[] = [
  { id: "account",        label: "Account",          icon: DollarSignIcon },
  { id: "accounts",       label: "Accounts",         icon: Wallet },
  { id: "tags",           label: "Tags & Mistakes",  icon: ListChecks },
  { id: "templates",      label: "Templates",        icon: Copy },
  { id: "display",        label: "Appearance",       icon: Grid3X3 },
  { id: "chart",          label: "Chart",            icon: LineChart },
  { id: "strategies",     label: "Strategies",       icon: ListChecks },
  { id: "integrations",   label: "Integrations",     icon: Key },
  { id: "broker",         label: "Broker",           icon: Cable },
  { id: "security",       label: "Security",         icon: ShieldCheck },
  { id: "data",           label: "Data",             icon: Database },
  { id: "admin-users",    label: "Users",            icon: Users,     adminOnly: true },
  { id: "admin-settings", label: "System",           icon: Settings,  adminOnly: true },
];
