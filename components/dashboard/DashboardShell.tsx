"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Trade, QuoteMap, TradeStrategy } from "@/lib/types";
import { calcRRAchieved } from "@/lib/trade-utils";
import TradeTable from "@/components/TradeTable";
import TradeModal from "@/components/TradeModal";
import AlertModal from "@/components/AlertModal";
import WeeklyCalendar from "./WeeklyCalendar";
import { AreaChartWidget, BarChartWidget } from "./ChartWidgets";
import ComparisonWidget from "./ComparisonWidget";
import PerfTableWidget, { PerfRow } from "./PerfTableWidget";
import StatWidget from "./StatWidget";
import HeatmapWidget, { HeatmapRanges } from "./HeatmapWidget";
import SymbolPnlWidget from "./SymbolPnlWidget";
import FearGreedWidget from "./FearGreedWidget";
import VixWidget from "./VixWidget";
import MarketOverviewWidget from "./MarketOverviewWidget";
import DistributionChart from "./DistributionChart";
import RiskSimulator from "./RiskSimulator";
import AIInsightsWidget from "./AIInsightsWidget";
import IBKRPositionsWidget from "./IBKRPositionsWidget";
import TemplatePanel from "./TemplatePanel";
import {
  Plus, RefreshCw, Pencil, Check, GripVertical, EyeOff, Eye, Plus as PlusIcon, Minimize2, Maximize2,
  RotateCcw, Download, ChevronDown as ChevronDownIcon
} from "lucide-react";
import { useGridResize, WidgetDims } from "./useGridResize";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAccounts } from "@/lib/account-context";
import { usePrivacy } from "@/lib/privacy-context";
import clsx from "clsx";

// ── Widget definitions ──────────────────────────────────────────────────
const ALL_WIDGETS = [
  { id: "cumulative-pnl", title: "Cumulative P&L" },
  { id: "cumulative-dd", title: "Cumulative Drawdown" },
  { id: "win-pct", title: "Win %" },
  { id: "daily-volume", title: "Daily Volume" },
  { id: "avg-trade-pnl", title: "Average Trade P&L" },
  { id: "win-vs-loss", title: "Winning vs Losing Trades" },
  { id: "avg-win-vs-loss", title: "Avg Win vs Avg Loss" },
  { id: "largest-gain-loss", title: "Largest Gain vs Loss" },
  { id: "hold-time", title: "Hold Time: Win vs Loss" },
  { id: "perf-day-of-week", title: "By Day of Week" },
  { id: "perf-hour", title: "By Hour of Day" },
  { id: "perf-duration", title: "By Duration" },
  { id: "perf-price", title: "By Price Range" },
  { id: "perf-month", title: "By Month of Year" },
  { id: "perf-symbol", title: "By Symbol" },
  { id: "tag-breakdown", title: "Tag Breakdown" },
  { id: "total-fees", title: "Total Fees" },
  { id: "profit-factor", title: "Profit Factor" },
  { id: "max-consec-wins", title: "Max Consecutive Wins" },
  { id: "max-consec-losses", title: "Max Consecutive Losses" },
  { id: "total-trades", title: "Total Trades" },
  { id: "avg-daily-volume", title: "Avg Daily Volume" },
  { id: "heatmap", title: "Trading Activity" },
  { id: "symbol-pnl", title: "P&L by Symbol" },
  { id: "total-return", title: "Total Return %" },
  { id: "avg-rr", title: "Avg R:R Achieved" },
  { id: "avg-rating", title: "Avg Trade Rating" },
  { id: "top-mistakes", title: "Common Mistakes" },
  { id: "daily-loss-status", title: "Today vs Limit" },
  { id: "fear-greed", title: "Fear & Greed Index" },
  { id: "vix", title: "VIX Index" },
  { id: "market-overview", title: "Market Overview" },
  { id: "dist-weekday", title: "P&L by Day of Week" },
  { id: "dist-hour", title: "P&L by Hour of Day" },
  { id: "dist-month", title: "P&L by Month" },
  { id: "strategy-perf", title: "Strategy Performance" },
  { id: "risk-simulator", title: "Monte Carlo Risk Simulator" },
  { id: "ai-insights", title: "AI Edge Discovery Engine" },
  { id: "ibkr-positions", title: "IBKR Live Positions" },
] as const;

const WIDGET_MAP = new Map<string, { id: string; title: string }>(ALL_WIDGETS.map(w => [w.id, w]));

const DEFAULT_ORDER = [
  // Row 1 (3+1+1+1=6): Hero chart + market gauges
  "cumulative-pnl", "fear-greed", "vix", "market-overview",
  // Row 2 (1+1+1+1+1+1=6): Heatmap + key stats
  "heatmap", "total-return", "profit-factor", "total-trades", "win-vs-loss", "avg-win-vs-loss",
  // Row 3 (3+3=6): Drawdown + symbol breakdown
  "cumulative-dd", "symbol-pnl",
  // Row 4 (2+2+2=6): Secondary charts
  "win-pct", "avg-trade-pnl", "daily-volume",
  // Row 5 (1+1+1+1+1+1=6): Comparisons + streaks
  "largest-gain-loss", "hold-time", "max-consec-wins", "max-consec-losses", "avg-rr", "avg-rating",
  // Row 6 (1+1+1+3=6): Quick stats + mistakes
  "daily-loss-status", "total-fees", "avg-daily-volume", "top-mistakes",
  // Row 7 (2+2+2=6): Performance tables
  "perf-day-of-week", "perf-month", "perf-symbol",
  // Row 8 (2+2+2=6): Performance tables continued
  "perf-duration", "perf-price", "tag-breakdown",
  // Hidden by default
  "dist-weekday", "dist-hour", "dist-month", "strategy-perf", "risk-simulator", "ai-insights", "perf-hour", "ibkr-positions",
];
const DEFAULT_HIDDEN = ["dist-weekday", "dist-hour", "dist-month", "strategy-perf", "risk-simulator", "ai-insights", "perf-hour", "ibkr-positions"] as string[];

// 12-column grid with 100px rows — w/h in grid units (half-step granularity)
const GRID_COLS = 12;
const GRID_ROW_PX = 100;
const GRID_GAP = 12;
const MAX_H = 8;

const DEFAULT_DIMS: Record<string, WidgetDims> = {
  // Large widgets (6 of 12 cols)
  "cumulative-pnl": { w: 6, h: 2 },
  "cumulative-dd": { w: 6, h: 2 },
  "symbol-pnl": { w: 6, h: 2 },
  "top-mistakes": { w: 6, h: 2 },
  "risk-simulator": { w: 6, h: 4 },
  "ai-insights": { w: 6, h: 2 },
  "ibkr-positions": { w: 6, h: 2 },
  // Heatmap — needs vertical space
  "heatmap": { w: 2, h: 4 },
  // Medium widgets (4 of 12 cols)
  "win-pct": { w: 4, h: 2 },
  "avg-trade-pnl": { w: 4, h: 2 },
  "daily-volume": { w: 4, h: 2 },
  "perf-day-of-week": { w: 4, h: 2 },
  "perf-month": { w: 4, h: 2 },
  "perf-symbol": { w: 4, h: 2 },
  "perf-duration": { w: 4, h: 2 },
  "perf-price": { w: 4, h: 2 },
  "tag-breakdown": { w: 4, h: 2 },
  // Compact widgets (2 of 12 cols) — omit since fallback is { w: 2, h: 2 }
};

type TimeFilter = 30 | 60 | 90 | "all";

interface DashboardLayout {
  order: string[];
  hidden: string[];
  dims: Record<string, WidgetDims>;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  layout: DashboardLayout;
  createdAt: string;
}

export interface BuiltInTemplate {
  id: string;
  name: string;
  layout: DashboardLayout;
  readonly: true;
}

const DEFAULT_BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: '__preset_performance_review',
    name: 'Performance Review',
    readonly: true,
    layout: {
      order: [...DEFAULT_ORDER],
      hidden: [],
      dims: { ...DEFAULT_DIMS },
    },
  },
  {
    id: '__preset_daily_monitor',
    name: 'Daily Monitor',
    readonly: true,
    layout: {
      order: [
        'daily-loss-status', 'fear-greed', 'vix', 'market-overview',
        'heatmap', 'total-return', 'total-trades', 'profit-factor',
        ...DEFAULT_ORDER.filter(w => ![
          'daily-loss-status', 'fear-greed', 'vix', 'market-overview',
          'heatmap', 'total-return', 'total-trades', 'profit-factor',
        ].includes(w)),
      ],
      hidden: DEFAULT_ORDER.filter(w => ![
        'daily-loss-status', 'fear-greed', 'vix', 'market-overview',
        'heatmap', 'total-return', 'total-trades', 'profit-factor',
      ].includes(w)),
      dims: {
        'daily-loss-status': { w: 3, h: 2 },
        'fear-greed': { w: 3, h: 2 },
        'vix': { w: 3, h: 2 },
        'market-overview': { w: 3, h: 2 },
        'heatmap': { w: 3, h: 2 },
        'total-return': { w: 3, h: 2 },
        'total-trades': { w: 3, h: 2 },
        'profit-factor': { w: 3, h: 2 },
      },
    },
  },
];

function getLayoutKey(accountId: string | null): string {
  return accountId ? `dashboard_layout_${accountId}` : 'dashboard_layout_all_accounts';
}

// ── Sortable widget card wrapper ────────────────────────────────────────
function WidgetCard({ id, title, editMode, dims, isBeingResized, onHide, onToggleSize, onResizeStart, children }: {
  id: string;
  title: string;
  editMode: boolean;
  dims: WidgetDims;
  isBeingResized: boolean;
  onHide: () => void;
  onToggleSize: () => void;
  onResizeStart: (e: React.PointerEvent, id: string, currentW: number, currentH: number) => void;
  children: React.ReactNode;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const gridStyle: React.CSSProperties = {
    gridColumn: `span ${Math.min(dims.w, GRID_COLS)}`,
    gridRow: `span ${dims.h}`,
    ...(editMode ? {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    } : {}),
  };

  // Size label for display: 5+ = L, 3-4 = M, 1-2 = C
  const sizeLabel = dims.w >= 5 ? "L" : dims.w >= 3 ? "M" : "C";
  const showExpand = dims.w <= 2;

  return (
    <div ref={setNodeRef} style={gridStyle} data-widget-id={id}
      className="relative rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-800/50 bg-white p-3 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-semibold dark:text-white text-slate-900 truncate">{title}</h3>
        {editMode && (
          <div className="flex items-center gap-1">
            <button onClick={onToggleSize}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors dark:text-slate-400 text-slate-500"
              title={`Width: ${dims.w} col(s) (click to cycle)`}
              aria-label={`Change size of ${title}, current width: ${dims.w}`}
            >
              {showExpand ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              <span className="uppercase">{sizeLabel}</span>
            </button>
            <button onClick={onHide}
              className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
              title="Hide widget"
              aria-label={`Hide ${title} widget`}
            >
              <EyeOff className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
            </button>
            <div {...attributes} {...listeners}
              className="p-1 rounded cursor-grab active:cursor-grabbing hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
              aria-label={`Drag to reorder ${title}`}
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {isBeingResized ? (
          <div className="flex-1 h-full flex items-center justify-center dark:text-slate-500 text-slate-400 text-sm font-mono">
            {dims.w} x {dims.h}
          </div>
        ) : children}
      </div>
      {editMode && (
        <div
          onPointerDown={(e) => onResizeStart(e, id, dims.w, dims.h)}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 flex items-center justify-center"
          title="Drag to resize"
        >
          <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 dark:text-slate-500 text-slate-400">
            <circle cx="5" cy="1" r="0.7" fill="currentColor" />
            <circle cx="5" cy="5" r="0.7" fill="currentColor" />
            <circle cx="1" cy="5" r="0.7" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

function priceBucket(price: number): string {
  if (price < 2) return "<$2";
  if (price < 5) return "$2-5";
  if (price < 10) return "$5-10";
  if (price < 25) return "$10-25";
  if (price < 50) return "$25-50";
  if (price < 100) return "$50-100";
  return "$100+";
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt$(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

function buildPerfRows(groups: Map<string, Trade[]>, sortKeys?: string[]): PerfRow[] {
  const rows: PerfRow[] = [];
  const keys = sortKeys ?? Array.from(groups.keys());
  for (const key of keys) {
    const trades = groups.get(key);
    if (!trades || !trades.length) continue;
    const pnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = trades.filter(t => (t.pnl ?? 0) > 0).length;
    rows.push({ category: key, pnl, count: trades.length, winPct: (wins / trades.length) * 100 });
  }
  return rows;
}

// ── Main component ──────────────────────────────────────────────────────
export default function DashboardShell() {
  const [me, setMe] = useState<any>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<TradeStrategy[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const { accounts, activeAccountId, activeAccount } = useAccounts();
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDefaults, setAlertDefaults] = useState<{ symbol?: string; price?: number }>({});
  const [heatmapRanges, setHeatmapRanges] = useState<HeatmapRanges>({ high: 500, mid: 200, low: 1 });
  const [dailyLossLimit, setDailyLossLimit] = useState<number | null>(null);
  const [dailyLossLimitType, setDailyLossLimitType] = useState<"dollar" | "percent">("dollar");
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>({ order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN, dims: { ...DEFAULT_DIMS } });
  const gridRef = useRef<HTMLDivElement | null>(null);
  const { hidden, toggleHidden } = usePrivacy();
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [builtInTemplates, setBuiltInTemplates] = useState<BuiltInTemplate[]>(DEFAULT_BUILT_IN_TEMPLATES);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Data loading ────────────────────────────────────────────────────
  const loadQuotes = async (currentTrades: Trade[]) => {
    const symbols = [...new Set(currentTrades.filter(t => t.status === "open").map(t => t.symbol))];
    if (!symbols.length) { setQuotes({}); return; }
    try {
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      if (res.ok) setQuotes(await res.json());
    } catch { /* silent */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const tradesUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
      const [tradesRes, settingsRes, meRes] = await Promise.all([
        fetch(tradesUrl),
        fetch("/api/settings"),
        fetch("/api/auth/me"),
      ]);
      const tradesData = await tradesRes.json();
      const settingsData = await settingsRes.json();
      const meData = await meRes.json();
      setMe(meData);

      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
        await loadQuotes(tradesData);
      }

      // Account-aware sizing
      if (activeAccount) {
        setAccountSize(activeAccount.starting_balance);
        setRiskPercent(activeAccount.risk_per_trade);
      } else if (accounts.length > 0) {
        // "All Accounts" — sum starting balances
        setAccountSize(accounts.reduce((sum, a) => sum + a.starting_balance, 0));
        if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
      } else {
        if (settingsData.account_size) setAccountSize(parseFloat(settingsData.account_size));
        if (settingsData.risk_per_trade) setRiskPercent(parseFloat(settingsData.risk_per_trade));
      }

      if (settingsData.heatmap_ranges) {
        try { setHeatmapRanges(JSON.parse(settingsData.heatmap_ranges)); } catch { /* keep defaults */ }
      }
      if (settingsData.daily_loss_limit) {
        const v = parseFloat(settingsData.daily_loss_limit);
        if (!isNaN(v) && v > 0) setDailyLossLimit(v);
      }
      if (settingsData.daily_loss_limit_type === "percent") setDailyLossLimitType("percent");
      
      if (settingsData.strategies) {
        try { setStrategies(JSON.parse(settingsData.strategies)); } catch { /* keep defaults */ }
      }

      const layoutRaw = settingsData[getLayoutKey(activeAccountId)] ?? settingsData.dashboard_layout;
      if (layoutRaw) {
        try {
          const parsed = JSON.parse(layoutRaw);
          if (parsed.order && Array.isArray(parsed.order)) {
            // Ensure all widget IDs are present (new widgets added after save)
            const existingOrder = new Set(parsed.order);
            const hiddenSet = new Set(parsed.hidden ?? []);
            const merged = [...parsed.order];
            for (const w of DEFAULT_ORDER) {
              if (!existingOrder.has(w) && !hiddenSet.has(w)) {
                merged.push(w);
              }
            }
            // Migrate old "sizes" field (string format) to "dims" ({ w, h } format)
            let dims: Record<string, WidgetDims> = {};
            if (parsed.sizes && !parsed.dims) {
              // Old format: sizes is Record<string, string> — map to 12-col scale
              for (const [k, v] of Object.entries(parsed.sizes as Record<string, string>)) {
                const w = v === "large" || v === "normal" ? 6 : v === "medium" ? 4 : 2;
                dims[k] = { w, h: 2 };
              }
            } else if (parsed.dims) {
              // Detect old 6-col scale (max w ≤ 6 and values are small) and upscale to 12-col
              const entries = Object.entries(parsed.dims as Record<string, Partial<WidgetDims>>);
              const maxW = Math.max(0, ...entries.map(([, v]) => v.w ?? 1));
              const isOldScale = maxW <= 6;
              for (const [k, v] of entries) {
                const rawW = v.w ?? 1;
                const rawH = v.h ?? 1;
                dims[k] = isOldScale ? { w: rawW * 2, h: rawH * 2 } : { w: rawW, h: rawH };
              }
            }
            setLayout({ order: merged, hidden: parsed.hidden ?? [], dims: { ...DEFAULT_DIMS, ...dims } });
          }
        } catch { /* keep defaults */ }
      }
      if (settingsData.dashboard_layout_templates) {
        try {
          const parsed = JSON.parse(settingsData.dashboard_layout_templates);
          if (Array.isArray(parsed)) setTemplates(parsed);
        } catch { /* keep empty array default */ }
      }
      if (settingsData.admin_default_templates) {
        try {
          const parsed = JSON.parse(settingsData.admin_default_templates) as Record<string, { order: string[]; hidden: string[]; dims?: Record<string, WidgetDims>; sizes?: Record<string, string> }>;
          const merged = DEFAULT_BUILT_IN_TEMPLATES.map(t => {
            const override = parsed[t.id];
            if (!override) return t;
            // Support both dims (new) and sizes (old) in overrides — upscale to 12-col
            let dims: Record<string, WidgetDims> = {};
            if (override.dims) {
              const entries = Object.entries(override.dims);
              const maxW = Math.max(0, ...entries.map(([, v]) => v.w ?? 1));
              const isOldScale = maxW <= 6;
              for (const [k, v] of entries) {
                dims[k] = isOldScale ? { w: (v.w ?? 1) * 2, h: (v.h ?? 1) * 2 } : { w: v.w ?? 2, h: v.h ?? 2 };
              }
            } else if (override.sizes) {
              for (const [k, v] of Object.entries(override.sizes)) {
                const w = v === "large" || v === "normal" ? 6 : v === "medium" ? 4 : 2;
                dims[k] = { w, h: 2 };
              }
            }
            return { ...t, layout: { order: override.order, hidden: override.hidden, dims } };
          });
          setBuiltInTemplates(merged);
        } catch { /* keep defaults */ }
      }
      if (settingsData.dashboard_time_filter) {
        const v = settingsData.dashboard_time_filter;
        if (v === "30" || v === "60" || v === "90") setTimeFilter(parseInt(v) as TimeFilter);
        else setTimeFilter("all");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    const url = `/api/trades/export?format=${format}${activeAccountId ? `&account_id=${activeAccountId}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `trades-export-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    }
    setShowExportMenu(false);
  };

  useEffect(() => { load(); }, [activeAccountId, accounts.length]);

  useEffect(() => {
    if (!trades.length) return;
    const id = setInterval(() => loadQuotes(trades), 60_000);
    return () => clearInterval(id);
  }, [trades]);

  // ── Layout persistence ──────────────────────────────────────────────
  const saveLayout = useCallback((newLayout: DashboardLayout, immediate = false) => {
    setLayout(newLayout);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = () => {
      if (me && !me.guest) {
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [getLayoutKey(activeAccountId)]: JSON.stringify(newLayout) }),
        });
      }
    };
    if (immediate) doSave();
    else saveTimer.current = setTimeout(doSave, 1000);
  }, [me, activeAccountId]);

  const saveTimeFilter = (tf: TimeFilter) => {
    setTimeFilter(tf);
    if (me && !me.guest) {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_time_filter: String(tf) }),
      });
    }
  };

  // ── Template handlers ────────────────────────────────────────────────
  const handleSaveTemplate = useCallback((name: string) => {
    const newTemplate: LayoutTemplate = {
      id: String(Date.now()),
      name: name.trim(),
      layout: { order: [...layout.order], hidden: [...layout.hidden], dims: { ...layout.dims } },
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    if (me && !me.guest) {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
      });
    }
  }, [layout, templates, me]);

  const handleLoadTemplate = useCallback((template: LayoutTemplate | BuiltInTemplate) => {
    const newLayout: DashboardLayout = {
      order: [...template.layout.order],
      hidden: [...template.layout.hidden],
      dims: { ...template.layout.dims },
    };
    saveLayout(newLayout, true);
  }, [saveLayout]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    if (me && !me.guest) {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
      });
    }
  }, [templates, me]);

  const handleSaveAsCopy = useCallback((preset: BuiltInTemplate, newName: string) => {
    const copy: LayoutTemplate = {
      id: String(Date.now()),
      name: newName.trim() || `${preset.name} (copy)`,
      layout: { order: [...preset.layout.order], hidden: [...preset.layout.hidden], dims: { ...preset.layout.dims } },
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, copy];
    setTemplates(updated);
    if (me && !me.guest) {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_layout_templates: JSON.stringify(updated) }),
      });
    }
  }, [templates, me]);

  const handleEditBuiltIn = useCallback((preset: BuiltInTemplate) => {
    const updatedLayout = { order: [...layout.order], hidden: [...layout.hidden], dims: { ...layout.dims } };
    const updatedPreset = { ...preset, layout: updatedLayout };
    const updated = builtInTemplates.map(t => t.id === preset.id ? updatedPreset : t);
    setBuiltInTemplates(updated);
    // Persist admin overrides to _system settings
    const overrides: Record<string, DashboardLayout> = {};
    for (const t of updated) {
      const def = DEFAULT_BUILT_IN_TEMPLATES.find(d => d.id === t.id);
      if (def && JSON.stringify(def.layout) !== JSON.stringify(t.layout)) {
        overrides[t.id] = t.layout;
      }
    }
    fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_default_templates: JSON.stringify(overrides) }),
    });
  }, [layout, builtInTemplates]);

  const allTemplates = useMemo(() => [
    ...builtInTemplates,
    ...templates,
  ], [builtInTemplates, templates]);

  // ── Filtered closed trades ──────────────────────────────────────────
  const closed = useMemo(() => {
    let filtered = trades
      .filter(t => t.status === "closed" && t.pnl != null)
      .sort((a, b) => (a.exit_date ?? a.created_at).localeCompare(b.exit_date ?? b.created_at));

    if (timeFilter !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - timeFilter);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      filtered = filtered.filter(t => {
        const d = t.exit_date ?? t.entry_date ?? t.created_at.slice(0, 10);
        return d >= cutoffStr;
      });
    }
    return filtered;
  }, [trades, timeFilter]);

  const totalPnl = useMemo(() => closed.reduce((s, t) => s + (t.pnl ?? 0), 0), [closed]);
  const currentBalance = accountSize + trades.filter(t => t.status === "closed").reduce((s, t) => s + (t.pnl ?? 0), 0);

  // ── Today's P&L for daily loss limit ────────────────────────────
  const todayPnl = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return trades
      .filter(t => t.status === "closed" && (t.exit_date ?? t.created_at.slice(0, 10)) === today)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);
  }, [trades]);

  const dailyLossExceeded = useMemo(() => {
    if (dailyLossLimit == null || dailyLossLimit <= 0) return false;
    const limitDollar = dailyLossLimitType === "percent"
      ? (dailyLossLimit / 100) * currentBalance
      : dailyLossLimit;
    return todayPnl < 0 && Math.abs(todayPnl) >= limitDollar;
  }, [todayPnl, dailyLossLimit, dailyLossLimitType, currentBalance]);

  // ── Chart series data ─────────────────────────────────────────────
  const { cumulativeData, drawdownData, winPctData, avgPnlData } = useMemo(() => {
    let cumulative = 0, peak = 0, wins = 0;
    const cumulativeData: { index: number; value: number; label: string; date: string }[] = [];
    const drawdownData: { index: number; value: number; label: string; date: string }[] = [];
    const winPctData: { index: number; value: number; label: string; date: string }[] = [];
    const avgPnlData: { index: number; value: number; label: string; date: string }[] = [];

    for (let i = 0; i < closed.length; i++) {
      const t = closed[i];
      const pnl = t.pnl ?? 0;
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      if (pnl > 0) wins++;
      const dd = peak > 0 ? ((cumulative - peak) / peak) * 100 : cumulative < 0 ? -100 : 0;
      const date = t.exit_date ?? t.created_at.slice(0, 10);
      const idx = i + 1;

      cumulativeData.push({ index: idx, value: parseFloat(cumulative.toFixed(2)), label: t.symbol, date });
      drawdownData.push({ index: idx, value: parseFloat(dd.toFixed(2)), label: t.symbol, date });
      winPctData.push({ index: idx, value: parseFloat(((wins / idx) * 100).toFixed(1)), label: t.symbol, date });
      avgPnlData.push({ index: idx, value: parseFloat((cumulative / idx).toFixed(2)), label: t.symbol, date });
    }
    return { cumulativeData, drawdownData, winPctData, avgPnlData };
  }, [closed]);

  // ── Comparison stats ──────────────────────────────────────────────
  const compStats = useMemo(() => {
    let winCount = 0, lossCount = 0, winSum = 0, lossSum = 0;
    let bestPnl = 0, worstPnl = 0;
    let winHoldDays = 0, lossHoldDays = 0;

    for (const t of closed) {
      const pnl = t.pnl ?? 0;
      if (pnl > 0) {
        winCount++;
        winSum += pnl;
        if (pnl > bestPnl) bestPnl = pnl;
        if (t.entry_date && t.exit_date) winHoldDays += daysBetween(t.entry_date, t.exit_date);
      } else if (pnl < 0) {
        lossCount++;
        lossSum += pnl;
        if (pnl < worstPnl) worstPnl = pnl;
        if (t.entry_date && t.exit_date) lossHoldDays += daysBetween(t.entry_date, t.exit_date);
      }
    }

    return {
      winCount, lossCount,
      avgWin: winCount > 0 ? winSum / winCount : 0,
      avgLoss: lossCount > 0 ? lossSum / lossCount : 0,
      bestPnl, worstPnl,
      avgWinHold: winCount > 0 ? winHoldDays / winCount : 0,
      avgLossHold: lossCount > 0 ? lossHoldDays / lossCount : 0,
    };
  }, [closed]);

  // ── Single stats ──────────────────────────────────────────────────
  const singleStats = useMemo(() => {
    let totalFees = 0, grossWins = 0, grossLosses = 0;
    let consecWins = 0, maxConsecWins = 0, consecLosses = 0, maxConsecLosses = 0;
    const daySet = new Set<string>();

    for (const t of closed) {
      const pnl = t.pnl ?? 0;
      totalFees += (t.commission ?? 0) * 2;
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      daySet.add(d);

      if (pnl > 0) {
        grossWins += pnl;
        consecWins++;
        consecLosses = 0;
        if (consecWins > maxConsecWins) maxConsecWins = consecWins;
      } else if (pnl < 0) {
        grossLosses += Math.abs(pnl);
        consecLosses++;
        consecWins = 0;
        if (consecLosses > maxConsecLosses) maxConsecLosses = consecLosses;
      }
    }

    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
    const avgDailyVolume = daySet.size > 0 ? closed.length / daySet.size : 0;

    return { totalFees, profitFactor, maxConsecWins, maxConsecLosses, totalTrades: closed.length, avgDailyVolume };
  }, [closed]);

  // ── Daily P&L map (for calendar + daily volume) ───────────────────
  const { dailyPnl, dailyCounts, dailyVolumeData } = useMemo(() => {
    const pnlMap = new Map<string, number>();
    const countMap = new Map<string, number>();
    for (const t of closed) {
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      pnlMap.set(d, (pnlMap.get(d) ?? 0) + (t.pnl ?? 0));
      countMap.set(d, (countMap.get(d) ?? 0) + 1);
    }
    const sorted = Array.from(countMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const dailyVolumeData = sorted.map(([date, count]) => ({ date: date.slice(5), value: count }));
    return { dailyPnl: pnlMap, dailyCounts: countMap, dailyVolumeData };
  }, [closed]);

  // ── Performance tables ────────────────────────────────────────────
  const perfDayOfWeek = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      const d = t.entry_date ?? t.created_at.slice(0, 10);
      const dow = DOW_NAMES[new Date(d + "T00:00:00").getDay()];
      if (!groups.has(dow)) groups.set(dow, []);
      groups.get(dow)!.push(t);
    }
    return buildPerfRows(groups, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  }, [closed]);

  const perfHour = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      const d = t.entry_date ?? t.created_at.slice(0, 10);
      // Use created_at for time since entry_date is date-only
      const hour = new Date(t.created_at).getHours();
      const label = `${hour}:00`;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(t);
    }
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => parseInt(a) - parseInt(b));
    return buildPerfRows(groups, sortedKeys);
  }, [closed]);

  const perfDuration = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      const isIntraday = t.entry_date && t.exit_date && t.entry_date === t.exit_date;
      const key = isIntraday ? "Intraday" : "Multiday";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return buildPerfRows(groups, ["Intraday", "Multiday"]);
  }, [closed]);

  const perfPrice = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    const bucketOrder = ["<$2", "$2-5", "$5-10", "$10-25", "$25-50", "$50-100", "$100+"];
    for (const t of closed) {
      if (t.entry_price == null) continue;
      const bucket = priceBucket(t.entry_price);
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)!.push(t);
    }
    return buildPerfRows(groups, bucketOrder);
  }, [closed]);

  const perfMonth = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      const m = MONTH_NAMES_SHORT[new Date(d + "T00:00:00").getMonth()];
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m)!.push(t);
    }
    return buildPerfRows(groups, MONTH_NAMES_SHORT);
  }, [closed]);

  const perfSymbol = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      if (!groups.has(t.symbol)) groups.set(t.symbol, []);
      groups.get(t.symbol)!.push(t);
    }
    const rows = buildPerfRows(groups);
    rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    return rows;
  }, [closed]);

  const perfTags = useMemo(() => {
    const groups = new Map<string, Trade[]>();
    for (const t of closed) {
      const tags = t.tags ? t.tags.split(",").map(s => s.trim()).filter(Boolean) : ["Untagged"];
      for (const tag of tags) {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag)!.push(t);
      }
    }
    const rows = buildPerfRows(groups);
    rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    return rows;
  }, [closed]);

  // ── Symbol P&L data ───────────────────────────────────────────────
  const symbolPnlData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of closed) {
      map.set(t.symbol, (map.get(t.symbol) ?? 0) + (t.pnl ?? 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5)
      .map(([symbol, pnl]) => ({ symbol, pnl: parseFloat(pnl.toFixed(2)) }));
  }, [closed]);

  // ── Resize ────────────────────────────────────────────────────────
  const handleResizePersist = useCallback((id: string, newDims: WidgetDims) => {
    setLayout(prev => {
      const updated = { ...prev, dims: { ...prev.dims, [id]: newDims } };
      // Immediately save on resize
      if (me && !me.guest) {
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [getLayoutKey(activeAccountId)]: JSON.stringify(updated) }),
        });
      }
      return updated;
    });
  }, [me, activeAccountId]);

  const { resizingId, onResizeStart } = useGridResize({
    gridRef,
    cols: GRID_COLS,
    gap: GRID_GAP,
    onResize: handleResizePersist,
  });

  // ── DnD ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.order.indexOf(active.id as string);
      const newIndex = layout.order.indexOf(over.id as string);
      const newOrder = arrayMove(layout.order, oldIndex, newIndex);
      saveLayout({ ...layout, order: newOrder });
    }
  };

  const hideWidget = (id: string) => {
    saveLayout({ ...layout, hidden: [...layout.hidden, id] });
  };

  const showWidget = (id: string) => {
    saveLayout({ ...layout, hidden: layout.hidden.filter(h => h !== id) });
  };

  const toggleSize = (id: string) => {
    const current = layout.dims[id] ?? { w: 2, h: 2 };
    // Cycle w: 6 -> 4 -> 2 -> 6 (large -> medium -> compact -> large)
    const nextW = current.w >= 6 ? 4 : current.w >= 4 ? 2 : 6;
    const newDims = { ...layout.dims, [id]: { ...current, w: nextW } };
    saveLayout({ ...layout, dims: newDims });
  };

  const finishEdit = () => {
    setEditMode(false);
    saveLayout(layout, true);
  };

  const resetLayout = () => {
    const defaultLayout: DashboardLayout = {
      order: [...DEFAULT_ORDER],
      hidden: [...DEFAULT_HIDDEN],
      dims: { ...DEFAULT_DIMS },
    };
    saveLayout(defaultLayout, true);
  };

  // ── Visible widgets ───────────────────────────────────────────────
  const visibleWidgets = useMemo(() => {
    const hiddenSet = new Set(layout.hidden);
    return layout.order.filter(id => !hiddenSet.has(id) && WIDGET_MAP.has(id));
  }, [layout]);

  const hiddenWidgets = useMemo(() => {
    const hiddenSet = new Set(layout.hidden);
    return layout.order.filter(id => hiddenSet.has(id) && WIDGET_MAP.has(id));
  }, [layout]);

  // ── Trade actions ─────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    load();
  };

  const handleEdit = (t: Trade) => {
    setEditTrade(t);
    setShowModal(true);
  };

  // ── Open trades (not filtered by time) ────────────────────────────
  const openTrades = useMemo(() =>
    trades.filter(t => t.status === "open" || t.status === "planned"),
    [trades]
  );

  const mask = "------";

  // ── Helper to map dims.w to legacy size hint for widget components ──
  function dimsToSize(w: number): "large" | "medium" | "compact" {
    return w >= 5 ? "large" : w >= 3 ? "medium" : "compact";
  }

  // ── Render widget by ID ───────────────────────────────────────────
  function renderWidget(id: string, dims: WidgetDims = { w: 6, h: 2 }) {
    const size = dimsToSize(dims.w);
    const isProfit = cumulativeData.length > 0 && cumulativeData[cumulativeData.length - 1].value >= 0;
    const maxDd = drawdownData.length > 0 ? Math.min(...drawdownData.map(d => d.value), 0) : 0;

    switch (id) {
      case "cumulative-pnl":
        return <AreaChartWidget data={cumulativeData} color={isProfit ? "#22c55e" : "#ef4444"}
          gradientId="cumPnlGrad" valuePrefix="$" />;
      case "cumulative-dd":
        return <AreaChartWidget data={drawdownData} color="#ef4444" gradientId="ddGrad"
          valuePrefix="" valueSuffix="%" yDomain={[Math.floor(maxDd - 5), 0]} />;
      case "win-pct":
        return <AreaChartWidget data={winPctData} color="#3b82f6" gradientId="winPctGrad"
          valuePrefix="" valueSuffix="%" referenceLine={50} />;
      case "daily-volume":
        return <BarChartWidget data={dailyVolumeData} />;
      case "avg-trade-pnl":
        return <AreaChartWidget data={avgPnlData}
          color={avgPnlData.length > 0 && avgPnlData[avgPnlData.length - 1].value >= 0 ? "#22c55e" : "#ef4444"}
          gradientId="avgPnlGrad" valuePrefix="$" />;
      case "win-vs-loss":
        return <ComparisonWidget
          leftLabel="Winners" leftValue={hidden ? mask : String(compStats.winCount)} leftColor="text-emerald-400"
          rightLabel="Losers" rightValue={hidden ? mask : String(compStats.lossCount)} rightColor="text-red-400"
        />;
      case "avg-win-vs-loss":
        return <ComparisonWidget
          leftLabel="Avg Win" leftValue={hidden ? mask : fmt$(compStats.avgWin)} leftColor="text-emerald-400"
          rightLabel="Avg Loss" rightValue={hidden ? mask : fmt$(Math.abs(compStats.avgLoss))} rightColor="text-red-400"
        />;
      case "largest-gain-loss":
        return <ComparisonWidget
          leftLabel="Best Trade" leftValue={hidden ? mask : fmt$(compStats.bestPnl)} leftColor="text-emerald-400"
          rightLabel="Worst Trade" rightValue={hidden ? mask : fmt$(Math.abs(compStats.worstPnl))} rightColor="text-red-400"
        />;
      case "hold-time":
        return <ComparisonWidget
          leftLabel="Win Hold" leftValue={`${compStats.avgWinHold.toFixed(1)}d`} leftColor="text-emerald-400"
          rightLabel="Loss Hold" rightValue={`${compStats.avgLossHold.toFixed(1)}d`} rightColor="text-red-400"
        />;
      case "perf-day-of-week":
        return <PerfTableWidget rows={perfDayOfWeek} />;
      case "perf-hour":
        return <PerfTableWidget rows={perfHour} />;
      case "perf-duration":
        return <PerfTableWidget rows={perfDuration} pageSize={2} />;
      case "perf-price":
        return <PerfTableWidget rows={perfPrice} />;
      case "perf-month":
        return <PerfTableWidget rows={perfMonth} />;
      case "perf-symbol":
        return <PerfTableWidget rows={perfSymbol} />;
      case "tag-breakdown":
        return <PerfTableWidget rows={perfTags} />;
      case "total-fees":
        return <StatWidget value={hidden ? mask : fmt$(singleStats.totalFees)} subtitle="Total commissions paid" />;
      case "profit-factor":
        return <StatWidget
          value={singleStats.profitFactor === Infinity ? "---" : singleStats.profitFactor.toFixed(2)}
          subtitle="Gross wins / gross losses"
        />;
      case "max-consec-wins":
        return <StatWidget value={String(singleStats.maxConsecWins)} subtitle="Winning streak" />;
      case "max-consec-losses":
        return <StatWidget value={String(singleStats.maxConsecLosses)} subtitle="Losing streak" />;
      case "total-trades":
        return <StatWidget value={String(singleStats.totalTrades)} subtitle="Closed trades" />;
      case "avg-daily-volume":
        return <StatWidget value={singleStats.avgDailyVolume.toFixed(1)} subtitle="Trades per trading day" />;
      case "heatmap":
        return <HeatmapWidget trades={timeFilter === "all" ? trades : closed} ranges={heatmapRanges} />;
      case "symbol-pnl":
        return <SymbolPnlWidget data={symbolPnlData} />;
      case "total-return": {
        const pctReturn = accountSize > 0 ? (totalPnl / accountSize) * 100 : 0;
        return <StatWidget
          value={hidden ? mask : `${pctReturn >= 0 ? "+" : ""}${pctReturn.toFixed(2)}%`}
          subtitle={hidden ? "" : `${totalPnl >= 0 ? "+" : "-"}${fmt$(totalPnl)} on $${accountSize.toFixed(0)}`}
        />;
      }
      case "avg-rr": {
        const rrValues = closed.map(t => calcRRAchieved(t)).filter((v): v is number => v !== null);
        const avgRR = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : 0;
        return <StatWidget value={rrValues.length > 0 ? `${avgRR.toFixed(2)}R` : "—"} subtitle={`From ${rrValues.length} trades with stop loss`} />;
      }
      case "avg-rating": {
        const rated = closed.filter(t => t.rating != null && t.rating > 0);
        const avgRating = rated.length > 0 ? rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length : 0;
        return <StatWidget value={rated.length > 0 ? avgRating.toFixed(1) : "—"} subtitle={`From ${rated.length} rated trades`} />;
      }
      case "top-mistakes": {
        const mistakeCount = new Map<string, number>();
        for (const t of closed) {
          if (!t.mistakes) continue;
          for (const m of t.mistakes.split(",").map(s => s.trim()).filter(Boolean)) {
            mistakeCount.set(m, (mistakeCount.get(m) ?? 0) + 1);
          }
        }
        const sorted = Array.from(mistakeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (sorted.length === 0) return <StatWidget value="None" subtitle="No mistakes recorded" />;
        return (
          <div className="space-y-2">
            {sorted.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="flex-1 text-xs dark:text-slate-300 text-slate-700 truncate">{name}</div>
                <div className="w-16 h-2 rounded-full dark:bg-slate-700 bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${(count / sorted[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs dark:text-slate-500 text-slate-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        );
      }
      case "daily-loss-status": {
        if (dailyLossLimit == null || dailyLossLimit <= 0) {
          return <StatWidget value="—" subtitle="No daily loss limit set" />;
        }
        const limitDollar = dailyLossLimitType === "percent"
          ? (dailyLossLimit / 100) * currentBalance
          : dailyLossLimit;
        return <ComparisonWidget
          leftLabel="Today's P&L" leftValue={hidden ? mask : `${todayPnl >= 0 ? "+" : "-"}${fmt$(todayPnl)}`}
          leftColor={todayPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          rightLabel="Daily Limit" rightValue={hidden ? mask : fmt$(limitDollar)}
          rightColor={dailyLossExceeded ? "text-red-400" : "dark:text-slate-400 text-slate-500"}
        />;
      }
      case "fear-greed":
        return <FearGreedWidget />;
      case "vix":
        return <VixWidget />;
      case "market-overview":
        return <MarketOverviewWidget />;
      case "dist-weekday":
        return <DistributionChart trades={closed} type="weekday" title="P&L by Weekday" />;
      case "dist-hour":
        return <DistributionChart trades={closed} type="hour" title="P&L by Hour" />;
      case "dist-month":
        return <DistributionChart trades={closed} type="month" title="P&L by Month" />;
      case "strategy-perf":
        return <ComparisonWidget trades={closed} strategies={strategies} />;
      case "risk-simulator":
        return <RiskSimulator trades={trades} startingBalance={accountSize} />;
      case "ai-insights":
        return <AIInsightsWidget trades={trades} />;
      case "ibkr-positions":
        return <IBKRPositionsWidget size={size} />;
      default:
        return null;
    }
  }

  // ── UI ────────────────────────────────────────────────────────────
  const timeFilters: { label: string; value: TimeFilter }[] = [
    { label: "30d", value: 30 },
    { label: "60d", value: 60 },
    { label: "90d", value: 90 },
    { label: "All", value: "all" },
  ];

  return (
    <div className="flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden" style={{ height: "100vh" }}>
      {/* Top Bar */}
      <div className="px-6 flex items-center h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100">
        {/* LEFT: Account stats */}
        <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
          {/* Balance */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Balance</span>
            <span className={clsx("text-sm font-bold", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {hidden ? mask : `$${currentBalance.toFixed(2)}`}
            </span>
          </div>
          <div className="hidden sm:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
          {/* P&L */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">P&L</span>
            <span className={clsx("text-sm font-bold", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {hidden ? mask : `${totalPnl >= 0 ? "+" : "-"}${fmt$(totalPnl)}`}
            </span>
            <span className={clsx("hidden xl:inline text-xs font-semibold", totalPnl >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
              {hidden ? "" : `(${totalPnl >= 0 ? "+" : ""}${(totalPnl / accountSize * 100).toFixed(2)}%)`}
            </span>
          </div>
          <div className="hidden lg:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
          {/* Today */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Today</span>
            <span className={clsx("text-sm font-bold", todayPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {hidden ? mask : `${todayPnl >= 0 ? "+" : "-"}${fmt$(todayPnl)}`}
            </span>
          </div>
          <div className="hidden xl:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
          {/* Trades count */}
          <div className="hidden xl:flex items-center gap-2">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Trades</span>
            <span className="text-sm font-bold dark:text-slate-300 text-slate-700">{closed.length}</span>
          </div>
          <div className="hidden sm:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
          {/* Win Rate */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Win Rate</span>
            {(() => {
              const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
              const wr = closed.length > 0 ? (wins / closed.length) * 100 : 0;
              return (
                <span className={clsx("text-sm font-bold", wr >= 50 ? "text-emerald-400" : "text-yellow-400")}>
                  {hidden ? mask : `${wr.toFixed(1)}%`}
                </span>
              );
            })()}
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {/* Time filter */}
          <div className="flex p-1 rounded-2xl dark:bg-slate-800 bg-slate-200/50 border dark:border-slate-700 border-slate-200 shadow-inner">
            {timeFilters.map(tf => (
              <button key={tf.label}
                onClick={() => saveTimeFilter(tf.value)}
                className={clsx(
                  "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                  timeFilter === tf.value
                    ? "bg-white dark:bg-slate-700 dark:text-emerald-400 text-emerald-600 shadow-sm"
                    : "dark:text-slate-500 text-slate-500 hover:dark:text-slate-300 hover:text-slate-700"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Utility group */}
          <div className="flex items-center gap-1 p-1 rounded-2xl dark:bg-slate-800 bg-slate-200/50 border dark:border-slate-700 border-slate-200 shadow-sm">
            <button onClick={() => setEditMode(!editMode)}
              className={clsx(
                "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-xl transition-colors",
                editMode ? "bg-emerald-500 text-white" : "hover:dark:bg-slate-700 hover:bg-white text-slate-500"
              )}
              title="Edit layout">
              {editMode ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {editMode && (
              <>
                <button onClick={resetLayout}
                  className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Reset layout">
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <TemplatePanel
                  templates={allTemplates}
                  onSave={handleSaveTemplate}
                  onLoad={handleLoadTemplate}
                  onDelete={handleDeleteTemplate}
                  onSaveAs={handleSaveAsCopy}
                  onEditBuiltIn={handleEditBuiltIn}
                  isGuest={!!me?.guest}
                  isAdmin={!!me?.isAdmin}
                />
              </>
            )}

            <button onClick={load}
              className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl hover:dark:bg-slate-700 hover:bg-white text-slate-500 transition-colors"
              title="Refresh">
              <RefreshCw className={clsx("w-3.5 h-3.5 sm:w-4 sm:h-4", loading && "animate-spin")} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl hover:dark:bg-slate-700 hover:bg-white text-slate-500 transition-colors"
                title="Export data"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-3 w-40 rounded-md border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <button onClick={() => handleExport("csv")} className="w-full px-4 py-3 text-left text-xs font-bold dark:text-slate-300 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors border-b dark:border-slate-800 border-slate-100">Download CSV</button>
                  <button onClick={() => handleExport("json")} className="w-full px-4 py-3 text-left text-xs font-bold dark:text-slate-300 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">Download JSON</button>
                </div>
              )}
            </div>

            <button
              onClick={toggleHidden}
              className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl hover:dark:bg-slate-700 hover:bg-white text-slate-500 transition-colors"
              title={hidden ? "Show numbers" : "Hide numbers"}
            >
              {hidden ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>

          <button onClick={() => { setEditTrade(null); setShowModal(true); }}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-[0.1em] transition-all shadow-lg shadow-emerald-600/20 active:scale-95 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            <span>New Trade</span>
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {/* Daily Loss Limit Warning */}
        {dailyLossExceeded && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <span className="text-lg">&#9888;</span>
            </div>
            <div>
              <p className="text-sm font-bold text-red-400">Daily Loss Limit Exceeded</p>
              <p className="text-xs text-red-400/70">
                Today&apos;s P&L: {hidden ? "***" : `${todayPnl >= 0 ? "+" : "-"}$${Math.abs(todayPnl).toFixed(2)}`}
                {" "}| Limit: {hidden ? "***" : dailyLossLimitType === "percent"
                  ? `${dailyLossLimit}% ($${((dailyLossLimit! / 100) * currentBalance).toFixed(2)})`
                  : `$${dailyLossLimit!.toFixed(2)}`}
              </p>
            </div>
          </div>
        )}

        {/* Weekly Calendar */}
        <WeeklyCalendar dailyPnl={dailyPnl} dailyCounts={dailyCounts} trades={trades} />

        {/* Widget Grid */}
        {closed.length === 0 ? (
          <div className="rounded-md border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-8 text-center">
            <p className="dark:text-slate-500 text-slate-400 text-sm">
              No closed trades{timeFilter !== "all" ? ` in the last ${timeFilter} days` : ""}. Close a trade to see analytics.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleWidgets} strategy={undefined}>
              <div ref={gridRef}
                className={clsx("grid grid-cols-1 md:grid-cols-12 gap-3 relative", resizingId && "select-none")}
                style={{ gridAutoRows: `${GRID_ROW_PX}px` }}
              >
                {visibleWidgets.map(id => {
                  const d = layout.dims[id] ?? DEFAULT_DIMS[id] ?? { w: 2, h: 2 };
                  const dims = { w: d.w ?? 2, h: d.h ?? 2 };
                  return (
                    <WidgetCard key={id} id={id}
                      title={WIDGET_MAP.get(id)?.title ?? id}
                      editMode={editMode}
                      dims={dims}
                      isBeingResized={resizingId === id}
                      onHide={() => hideWidget(id)}
                      onToggleSize={() => toggleSize(id)}
                      onResizeStart={onResizeStart}
                    >
                      {renderWidget(id, dims)}
                    </WidgetCard>
                  );
                })}
                {/* Pointer event overlay during resize to prevent iframe event stealing */}
                {resizingId && (
                  <div className="fixed inset-0 z-50" style={{ pointerEvents: "all", cursor: "se-resize" }} />
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Hidden widgets panel (edit mode) */}
        {editMode && hiddenWidgets.length > 0 && (
          <div className="rounded-md border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-3">
            <p className="text-xs font-medium dark:text-slate-400 text-slate-500 mb-2">Hidden Widgets</p>
            <div className="flex flex-wrap gap-2">
              {hiddenWidgets.map(id => (
                <button key={id} onClick={() => showWidget(id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border dark:border-slate-600 border-slate-300 dark:bg-slate-700/50 bg-white text-xs dark:text-slate-300 text-slate-600 hover:dark:bg-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <PlusIcon className="w-3 h-3" />
                  {WIDGET_MAP.get(id)?.title ?? id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Open Trades */}
        {openTrades.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold dark:text-white text-slate-900">Open Trades</h2>
              <a href="/trades" className="text-sm text-emerald-400 hover:underline">View all trades</a>
            </div>
            <div className="rounded-md dark:bg-slate-800/50 bg-white p-4 border dark:border-slate-800 border-slate-200">
              <TradeTable
                trades={trades}
                onEdit={handleEdit}
                onDelete={handleDelete}
                limit={10}
                quotes={quotes}
                onSetAlert={(symbol, price) => { setAlertDefaults({ symbol, price }); setShowAlertModal(true); }}
              />
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <TradeModal
          trade={editTrade}
          onClose={() => { setShowModal(false); setEditTrade(null); }}
          onSaved={load}
          accountSize={currentBalance}
          riskPercent={riskPercent}
        />
      )}

      <AlertModal
        open={showAlertModal}
        onClose={() => { setShowAlertModal(false); setAlertDefaults({}); }}
        onSaved={() => {}}
        defaultSymbol={alertDefaults.symbol}
        defaultPrice={alertDefaults.price}
      />
    </div>
  );
}
