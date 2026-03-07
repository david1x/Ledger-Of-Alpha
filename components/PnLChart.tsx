"use client";
import { Trade } from "@/lib/types";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Cell,
} from "recharts";
import { useMemo, useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface HeatmapRanges {
  high: number;
  mid: number;
  low: number;
}

const DEFAULT_RANGES: HeatmapRanges = { high: 500, mid: 200, low: 1 };

interface Props {
  trades: Trade[];
  heatmapRanges?: HeatmapRanges;
  chartsCollapsed?: boolean;
  onChartsCollapsedChange?: (collapsed: boolean) => void;
  chartOrder?: string[];
  onChartOrderChange?: (order: string[]) => void;
}

const CARD = "rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-white p-3";
const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};
const GRID_STROKE = "#1e293b";
const TICK = { fontSize: 11, fill: "#64748b" };

const DEFAULT_ORDER = ["pnl-stack", "heatmap", "symbol-pnl"];

// ── Heatmap helpers ───────────────────────────────────────────────────────
function getHeatColor(pnl: number, ranges: HeatmapRanges): string {
  const abs = Math.abs(pnl);
  if (pnl === 0) return "#475569";
  if (pnl > 0) {
    if (abs >= ranges.high) return "#16a34a";
    if (abs >= ranges.mid)  return "#22c55e";
    return "#86efac";
  }
  if (abs >= ranges.high) return "#dc2626";
  if (abs >= ranges.mid)  return "#ef4444";
  return "#fca5a5";
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function MonthlyHeatmap({ trades, ranges }: {
  trades: Trade[];
  ranges: HeatmapRanges;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{ day: number; pnl: number | null } | null>(null);

  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (t.status !== "closed" || t.pnl == null) continue;
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + t.pnl);
    }
    return map;
  }, [trades]);

  const { year, month, days, daysInMonth } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = d.getDay();
    const firstDowMon = (firstDow + 6) % 7;

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDowMon; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length % 7 !== 0) days.push(null);

    return { year, month, days, daysInMonth };
  }, [monthOffset]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const getDateStr = useCallback((day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, [year, month]);

  const tradingDays = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (dailyPnl.has(getDateStr(d))) count++;
    }
    return count;
  }, [daysInMonth, dailyPnl, getDateStr]);

  const monthTotal = useMemo(() => {
    let sum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const pnl = dailyPnl.get(getDateStr(d));
      if (pnl !== undefined) sum += pnl;
    }
    return sum;
  }, [daysInMonth, dailyPnl, getDateStr]);

  const canGoForward = monthOffset < 0;

  return (
    <div>
      {/* Title + Month navigation on one line */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold dark:text-white text-slate-900">Trading Activity</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthOffset(v => v - 1)}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
          <span className="text-xs font-medium dark:text-slate-300 text-slate-700 min-w-[110px] text-center">{monthLabel}</span>
          <button onClick={() => canGoForward && setMonthOffset(v => v + 1)}
            disabled={!canGoForward}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-30">
            <ChevronRight className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] dark:text-slate-500 text-slate-400">{d.slice(0, 2)}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const dateStr = getDateStr(day);
          const pnl = dailyPnl.get(dateStr) ?? null;
          const bg = pnl !== null ? getHeatColor(pnl, ranges) : undefined;
          return (
            <div
              key={day}
              className="aspect-square rounded-sm flex items-center justify-center text-[10px] cursor-default transition-opacity hover:opacity-80"
              style={{
                background: bg ?? "rgb(30 41 59 / 0.3)",
                color: pnl !== null ? "#fff" : "rgb(100 116 139 / 0.6)",
              }}
              onMouseEnter={() => setHoverInfo({ day, pnl })}
              onMouseLeave={() => setHoverInfo(null)}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Hover info / summary */}
      <div className="mt-2 flex items-center justify-between text-[10px] dark:text-slate-500 text-slate-400 min-h-[16px]">
        {hoverInfo ? (
          <span>
            {getDateStr(hoverInfo.day)}:{" "}
            <span className={
              hoverInfo.pnl === null ? "" :
              hoverInfo.pnl >= 0 ? "text-emerald-400" : "text-red-400"
            }>
              {hoverInfo.pnl !== null ? `$${hoverInfo.pnl.toFixed(2)}` : "No trades"}
            </span>
          </span>
        ) : (
          <span>{tradingDays} trading day{tradingDays !== 1 ? "s" : ""}</span>
        )}
        <span className={monthTotal >= 0 ? "text-emerald-400" : "text-red-400"}>
          {monthTotal !== 0 ? `${monthTotal >= 0 ? "+" : ""}$${monthTotal.toFixed(2)}` : ""}
        </span>
      </div>

    </div>
  );
}

// ── Sortable card wrapper ─────────────────────────────────────────────────
function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group min-w-0 h-full">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-1 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-slate-700 hover:bg-slate-200"
      >
        <GripVertical className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />
      </div>
      {children}
    </div>
  );
}

export default function PnLChart({ trades, heatmapRanges, chartsCollapsed: collapsedProp, onChartsCollapsedChange, chartOrder: orderProp, onChartOrderChange }: Props) {
  const [collapsed, setCollapsed] = useState(collapsedProp ?? false);
  useEffect(() => { if (collapsedProp !== undefined) setCollapsed(collapsedProp); }, [collapsedProp]);

  const [order, setOrder] = useState<string[]>(orderProp ?? DEFAULT_ORDER);
  useEffect(() => { if (orderProp) setOrder(orderProp); }, [orderProp]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      const newOrder = arrayMove(order, oldIndex, newIndex);
      setOrder(newOrder);
      onChartOrderChange?.(newOrder);
    }
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onChartsCollapsedChange?.(next);
  };

  const ranges = heatmapRanges ?? DEFAULT_RANGES;

  const closed = useMemo(() =>
    trades
      .filter((t) => t.status === "closed" && t.pnl !== null)
      .sort((a, b) => (a.exit_date ?? a.created_at).localeCompare(b.exit_date ?? b.created_at)),
    [trades]
  );

  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return closed.map((t, i) => {
      cumulative += t.pnl ?? 0;
      return {
        index: i + 1,
        label: t.symbol,
        pnl: t.pnl ?? 0,
        cumulative: parseFloat(cumulative.toFixed(2)),
        date: t.exit_date ?? t.created_at.slice(0, 10),
      };
    });
  }, [closed]);

  const drawdownData = useMemo(() => {
    let cumulative = 0;
    let peak = 0;
    return closed.map((t, i) => {
      cumulative += t.pnl ?? 0;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? ((cumulative - peak) / peak) * 100 : cumulative < 0 ? -100 : 0;
      return {
        index: i + 1,
        label: t.symbol,
        drawdown: parseFloat(dd.toFixed(2)),
        date: t.exit_date ?? t.created_at.slice(0, 10),
      };
    });
  }, [closed]);

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

  if (closed.length === 0) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-8 text-center">
        <p className="dark:text-slate-500 text-slate-400 text-sm">No closed trades yet. Close a trade to see your P&L charts.</p>
      </div>
    );
  }

  const isProfit = cumulativeData[cumulativeData.length - 1]?.cumulative >= 0;
  const cumColor = isProfit ? "#22c55e" : "#ef4444";
  const maxDd = Math.min(...drawdownData.map(d => d.drawdown), 0);

  const cardMap: Record<string, React.ReactNode> = {
    "pnl-stack": (
      <div className="flex flex-col gap-3 h-full">
        {/* Cumulative P&L */}
        <div className={CARD + " min-w-0 flex-1 flex flex-col"}>
          <h3 className="text-sm font-semibold dark:text-white text-slate-900 mb-1 shrink-0">Cumulative P&L</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cumColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={cumColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="index" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [
                    `$${value.toFixed(2)}`,
                    name === "cumulative" ? "Cumulative P&L" : "Trade P&L",
                  ]}
                  labelFormatter={(label, payload) =>
                    payload?.[0] ? `Trade #${label} — ${payload[0].payload.label} (${payload[0].payload.date})` : `Trade #${label}`
                  }
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="cumulative" stroke={cumColor} strokeWidth={2}
                  fill="url(#pnlGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Drawdown */}
        <div className={CARD + " min-w-0 flex-1 flex flex-col"}>
          <h3 className="text-sm font-semibold dark:text-white text-slate-900 mb-1 shrink-0">
            Drawdown
            <span className="ml-2 text-xs font-normal dark:text-slate-500 text-slate-400">
              {maxDd < 0 ? `Max: ${maxDd.toFixed(1)}%` : "No drawdown"}
            </span>
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="index" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`}
                  domain={[Math.floor(maxDd - 5), 0]} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "Drawdown"]}
                  labelFormatter={(label, payload) =>
                    payload?.[0] ? `Trade #${label} — ${payload[0].payload.label} (${payload[0].payload.date})` : `Trade #${label}`
                  }
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2}
                  fill="url(#ddGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    ),
    "heatmap": (
      <div className={CARD}>
        <MonthlyHeatmap trades={trades} ranges={ranges} />
      </div>
    ),
    "symbol-pnl": (
      <div className={CARD + " h-full flex flex-col"}>
        <h3 className="text-sm font-semibold dark:text-white text-slate-900 mb-2 shrink-0">P&L by Symbol</h3>
        {symbolPnlData.length < 2 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs dark:text-slate-500 text-slate-400">Trade at least 2 symbols to see breakdown</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={symbolPnlData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="symbol" tick={TICK} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                />
                <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {symbolPnlData.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    ),
  };

  return (
    <div className="space-y-2">
      {/* Shared collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="flex items-center gap-2 text-sm dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 transition-colors"
      >
        {collapsed
          ? <ChevronDown className="w-4 h-4" />
          : <ChevronUp className="w-4 h-4" />}
        <span className="font-medium">Charts</span>
      </button>

      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={horizontalListSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {order.map(id => (
                <SortableCard key={id} id={id}>
                  {cardMap[id]}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
