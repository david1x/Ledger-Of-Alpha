"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trade, QuoteMap, MistakeType } from "@/lib/types";
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, LineChart, ExternalLink, Bell, Star, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { calcRRAchieved, calcPercentReturn, formatHoldDuration } from "@/lib/trade-utils";
import clsx from "clsx";
import ChecklistRing from "@/components/ChecklistRing";
import { usePrivacy } from "@/lib/privacy-context";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function buildChartUrl(t: Trade): string {
  const params = new URLSearchParams({ symbol: t.symbol });
  if (t.entry_price != null) params.set("entry", String(t.entry_price));
  if (t.stop_loss != null) params.set("stop", String(t.stop_loss));
  if (t.take_profit != null) params.set("target", String(t.take_profit));
  if (t.direction) params.set("direction", t.direction);
  if (t.status) params.set("status", t.status);
  return `/chart?${params}`;
}

function buildTradingViewUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

export const ALL_COLUMNS = [
  { key: "symbol",     label: "Symbol",     default: true },
  { key: "direction",  label: "Dir",        default: true },
  { key: "status",     label: "Status",     default: true },
  { key: "entry",      label: "Entry",      default: true },
  { key: "stop",       label: "Stop",       default: true },
  { key: "target",     label: "Target",     default: true },
  { key: "exit",       label: "Exit",       default: true },
  { key: "shares",     label: "Shares",     default: true },
  { key: "pnl",        label: "P&L",        default: true },
  { key: "rr_achieved", label: "R:R",       default: false },
  { key: "pct_return", label: "% Return",   default: true },
  { key: "cost_basis", label: "Cost Basis", default: false },
  { key: "hold_duration", label: "Hold",    default: false },
  { key: "rating",     label: "Rating",     default: false },
  { key: "market_ctx", label: "Context",    default: false },
  { key: "potential",  label: "Potential",   default: true },
  { key: "unrealized", label: "Unrealized",  default: true },
  { key: "commission", label: "Commission",  default: false },
  { key: "risk",       label: "Risk %",      default: false },
  { key: "date",       label: "Date",       default: true },
  { key: "notes",      label: "Notes",      default: false },
  { key: "mistakes",   label: "Mistakes",   default: false },
] as const;

export type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

export const DEFAULT_COLUMNS: ColumnKey[] = ALL_COLUMNS.filter(c => c.default).map(c => c.key);

interface Props {
  trades: Trade[];
  onEdit: (t: Trade) => void;
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void;
  limit?: number;
  quotes?: QuoteMap;
  visibleColumns?: ColumnKey[];
  defaultRiskPercent?: number;
  accountSize?: number;
  onSetAlert?: (symbol: string, defaultPrice?: number) => void;
  // External selection control
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onSelectAll?: (ids: number[]) => void;
  allSelected?: boolean;
  selectable?: boolean;
  // Footer / Plan 02 scaffold
  totalCount?: number;
  mistakeTypes?: MistakeType[];
  // Column reorder callback
  onReorderColumns?: (cols: ColumnKey[]) => void;
}

function getStatusBadge(t: Trade): { label: string; className: string } {
  if (t.status === "open") return { label: "Open", className: "bg-yellow-500/15 dark:text-white text-slate-900 ring-yellow-500/30" };
  if (t.status === "planned") return { label: "Planned", className: "bg-blue-500/15 dark:text-white text-slate-900 ring-blue-500/30" };
  if (t.status === "closed") {
    const pnl = t.pnl ?? 0;
    if (pnl > 0) return { label: "Win", className: "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" };
    if (pnl < 0) return { label: "Loss", className: "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30" };
    return { label: "BE", className: "bg-slate-500/15 dark:text-slate-300 text-slate-600 ring-slate-500/30" };
  }
  return { label: t.status, className: "bg-slate-500/15 dark:text-slate-300 text-slate-600 ring-slate-500/30" };
}

function calcPotentialPnl(t: Trade) {
  if (t.status === "closed") return null;
  if (t.entry_price == null || t.shares == null) return null;
  const comm = (t.commission ?? 0) * 2;
  const cost = t.entry_price * t.shares;
  const profit =
    t.take_profit != null
      ? Math.abs(t.take_profit - t.entry_price) * t.shares - comm
      : null;
  const loss =
    t.stop_loss != null
      ? -(Math.abs(t.stop_loss - t.entry_price) * t.shares + comm)
      : null;
  if (profit == null && loss == null) return null;
  const profitPct = profit != null && cost > 0 ? (profit / cost) * 100 : null;
  const lossPct = loss != null && cost > 0 ? (loss / cost) * 100 : null;
  return { profit, loss, profitPct, lossPct };
}

function getSortValue(t: Trade, key: ColumnKey, quotes: QuoteMap, defaultRiskPercent?: number, accountSize?: number): string | number {
  switch (key) {
    case "symbol": return t.symbol;
    case "direction": return t.direction;
    case "status": return t.status;
    case "entry": return t.entry_price ?? -Infinity;
    case "stop": return t.stop_loss ?? -Infinity;
    case "target": return t.take_profit ?? -Infinity;
    case "exit": return t.exit_price ?? -Infinity;
    case "shares": return t.shares ?? -Infinity;
    case "pnl": return t.pnl ?? -Infinity;
    case "rr_achieved": return calcRRAchieved(t) ?? -Infinity;
    case "pct_return": return calcPercentReturn(t, accountSize ?? 10000) ?? -Infinity;
    case "cost_basis": return (t.entry_price ?? 0) * (t.shares ?? 0);
    case "hold_duration": {
      if (!t.entry_date) return -Infinity;
      const end = t.exit_date ? new Date(t.exit_date) : new Date();
      return end.getTime() - new Date(t.entry_date).getTime();
    }
    case "rating": return t.rating ?? -Infinity;
    case "market_ctx": return t.market_context ?? "";
    case "potential": {
      const pot = calcPotentialPnl(t);
      return pot?.profit ?? -Infinity;
    }
    case "unrealized": {
      if (t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined) {
        return (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1);
      }
      return -Infinity;
    }
    case "commission": return t.commission ?? 0;
    case "risk": return t.risk_per_trade ?? defaultRiskPercent ?? 0;
    case "date": return t.entry_date ?? t.created_at.slice(0, 10);
    case "mistakes": return t.mistake_tag_ids ? t.mistake_tag_ids.split(",").filter(Boolean).length : 0;
    default: return 0;
  }
}

function SortableHeader({
  colKey,
  label,
  sortKey,
  sortDir,
  onSort,
  showGrip,
  sticky,
}: {
  colKey: ColumnKey;
  label: string;
  sortKey: ColumnKey | null;
  sortDir: "asc" | "desc";
  onSort: (k: ColumnKey) => void;
  showGrip?: boolean;
  sticky?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 text-left text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider whitespace-nowrap${sticky ? " sticky left-0 z-10 dark:bg-slate-900 bg-white" : ""}`}
    >
      <div className="flex items-center gap-1">
        {showGrip && (
          <span
            {...attributes}
            {...listeners}
            className="p-0.5 rounded cursor-grab active:cursor-grabbing hover:dark:bg-slate-700 hover:bg-slate-200"
          >
            <GripVertical className="w-3 h-3 dark:text-slate-500 text-slate-400" />
          </span>
        )}
        <button
          onClick={() => onSort(colKey)}
          className="flex items-center gap-1 hover:dark:text-slate-200 hover:text-slate-700 transition-colors cursor-pointer select-none"
        >
          {label}
          {sortKey === colKey && (
            sortDir === "asc"
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </th>
  );
}

export default function TradeTable({
  trades,
  onEdit,
  onDelete,
  onBulkDelete,
  limit,
  quotes = {},
  visibleColumns,
  defaultRiskPercent,
  accountSize,
  onSetAlert,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  selectable: selectableProp,
  totalCount,
  mistakeTypes,
  onReorderColumns,
}: Props) {
  const router = useRouter();
  const { hidden } = usePrivacy();
  const baseRows = limit ? trades.slice(0, limit) : trades;

  // Use external selected state if provided, otherwise use internal
  const [internalSelected, setInternalSelected] = useState<Set<number>>(new Set());
  const selected = selectedIds ?? internalSelected;

  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const rows = sortKey
    ? [...baseRows].sort((a, b) => {
        const av = getSortValue(a, sortKey, quotes, defaultRiskPercent, accountSize);
        const bv = getSortValue(b, sortKey, quotes, defaultRiskPercent, accountSize);
        let cmp = 0;
        if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
        else cmp = (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : baseRows;

  const visible = new Set<ColumnKey>(visibleColumns ?? DEFAULT_COLUMNS);
  const show = (k: ColumnKey) => visible.has(k);

  const selectable = selectableProp ?? !!onBulkDelete;

  const toggleOne = (id: number) => {
    if (onToggleSelect) {
      onToggleSelect(id);
    } else {
      setInternalSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
  };

  const toggleAll = () => {
    const allIds = rows.map(t => t.id);
    const currentlyAllSelected = allIds.every(id => selected.has(id));

    if (onSelectAll) {
      onSelectAll(currentlyAllSelected ? [] : allIds);
    } else {
      if (currentlyAllSelected) setInternalSelected(new Set());
      else setInternalSelected(new Set(allIds));
    }
  };

  const handleBulkDelete = () => {
    if (!selected.size || !onBulkDelete) return;
    if (!confirm(`Delete ${selected.size} trade${selected.size > 1 ? "s" : ""}?`)) return;
    onBulkDelete([...selected]);
    setInternalSelected(new Set());
  };

  // Notes hover state
  const [hoverNote, setHoverNote] = useState<string | null>(null);
  const [notePos, setNotePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const noteTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleNoteEnter = useCallback((e: React.MouseEvent<HTMLTableCellElement>, note: string) => {
    if (!note || note.length < 20) return;
    clearTimeout(noteTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    noteTimeout.current = setTimeout(() => {
      setNotePos({ top: rect.bottom + 4, left: rect.left });
      setHoverNote(note);
    }, 400);
  }, []);

  const handleNoteLeave = useCallback(() => {
    clearTimeout(noteTimeout.current);
    setHoverNote(null);
  }, []);

  // DnD sensors for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && visibleColumns) {
      const cols = visibleColumns ?? DEFAULT_COLUMNS;
      const oldIdx = cols.indexOf(active.id as ColumnKey);
      const newIdx = cols.indexOf(over.id as ColumnKey);
      onReorderColumns?.(arrayMove(cols, oldIdx, newIdx));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl dark:bg-slate-800/50 bg-slate-50 p-8 text-center shadow-sm border dark:border-slate-800/50 border-slate-100/50">
        <p className="dark:text-slate-500 text-slate-400 text-sm">No trades found. Add your first trade!</p>
      </div>
    );
  }

  // Build visible header list for desktop (respecting visibleColumns order)
  const headers: { key: ColumnKey; label: string }[] = (visibleColumns ?? DEFAULT_COLUMNS)
    .filter(k => visible.has(k))
    .map(k => {
      const col = ALL_COLUMNS.find(c => c.key === k)!;
      return { key: col.key, label: col.label };
    });

  // Footer totals
  const totalPnl = rows.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const footerColSpan = headers.length + 1 + (selectable ? 1 : 0);

  return (
    <div>
      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 shadow-sm border dark:border-slate-700/50 border-slate-200/50 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-sm dark:text-slate-300 text-slate-700 font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
          <button
            onClick={() => {
              if (onSelectAll) onSelectAll([]);
              else setInternalSelected(new Set());
            }}
            className="text-xs dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 transition-colors ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden">

        {/* ── Mobile card view (< sm) ── */}
        <div className="sm:hidden divide-y dark:divide-slate-800 divide-slate-100">
          {rows.map((t) => {
            const livePnl =
              t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined
                ? (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1)
                : null;
            const closedPnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
            const liveColor = livePnl !== null ? (livePnl > 0 ? "text-emerald-400" : livePnl < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500") : "dark:text-slate-400 text-slate-500";
            const isSelected = selected.has(t.id);
            const pot = calcPotentialPnl(t);
            const statusBadge = getStatusBadge(t);
            return (
              <div key={t.id} className={clsx("p-3 dark:bg-slate-900 bg-white space-y-2", isSelected && "dark:bg-emerald-500/5 bg-emerald-50")}>
                {/* Row 1: checkbox + symbol + direction + status + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(t.id)}
                        className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        aria-label={`Select trade ${t.symbol}`}
                      />
                    )}
                    {show("symbol") && (
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 font-bold text-violet-400 cursor-pointer hover:underline" onClick={() => onEdit(t)}>
                          {t.symbol}
                          {t.source === "ibkr" && (
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/15 text-blue-400">IBKR</span>
                          )}
                          <ChecklistRing checklistState={t.checklist_state} size={22} />
                        </span>
                      </span>
                    )}
                    {show("direction") && (
                      t.direction === "long"
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Long</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Short</span>
                    )}
                    {show("status") && (
                      <span className={clsx("px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset", statusBadge.className)}>
                        {statusBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => router.push(buildChartUrl(t))} className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Open in Chart" aria-label="Open in Chart">
                      <LineChart className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </button>
                    <a href={buildTradingViewUrl(t.symbol)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Open in TradingView" aria-label="Open in TradingView">
                      <ExternalLink className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </a>
                    {onSetAlert && (
                      <button onClick={() => onSetAlert(t.symbol, t.entry_price ?? undefined)} className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Set Price Alert" aria-label="Set Price Alert">
                        <Bell className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                      </button>
                    )}
                    <button onClick={() => onEdit(t)} className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Edit" aria-label="Edit trade">
                      <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id); }} className="p-1.5 rounded-xl hover:bg-red-500/20 transition-colors" title="Delete" aria-label="Delete trade">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Row 2: entry · stop · target */}
                {(show("entry") || show("stop") || show("target")) && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {show("entry") && (
                      <div>
                        <div className="dark:text-slate-500 text-slate-400 mb-0.5">Entry</div>
                        <div className="dark:text-slate-300 text-slate-700 font-medium">{t.entry_price ? `$${t.entry_price}` : "—"}</div>
                      </div>
                    )}
                    {show("stop") && (
                      <div>
                        <div className="dark:text-slate-500 text-slate-400 mb-0.5">Stop</div>
                        <div className="text-red-400 font-medium">{t.stop_loss ? `$${t.stop_loss}` : "—"}</div>
                      </div>
                    )}
                    {show("target") && (
                      <div>
                        <div className="dark:text-slate-500 text-slate-400 mb-0.5">Target</div>
                        <div className="text-emerald-400 font-medium">{t.take_profit ? `$${t.take_profit}` : "—"}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 3: P&L + potential + unrealized + date */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {show("pnl") && (
                      <span className={clsx("font-medium", closedPnlColor)}>
                        P&L: {hidden ? "••••" : (t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—")}
                      </span>
                    )}
                    {show("potential") && pot && (
                      <span className="font-medium">
                        {pot.profit != null && <span className="text-emerald-400">+${pot.profit.toFixed(2)} <span className="opacity-60">({pot.profitPct!.toFixed(1)}%)</span></span>}
                        {pot.profit != null && pot.loss != null && <span className="dark:text-slate-500 text-slate-400"> / </span>}
                        {pot.loss != null && <span className="text-red-400">-${Math.abs(pot.loss).toFixed(2)} <span className="opacity-60">({Math.abs(pot.lossPct!).toFixed(1)}%)</span></span>}
                      </span>
                    )}
                    {show("unrealized") && livePnl !== null && (
                      <span className={clsx("flex items-center gap-1 font-medium", liveColor)}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {hidden ? "••••" : `${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  {show("date") && (
                    <span className="dark:text-slate-500 text-slate-400">
                      {t.entry_date ?? t.created_at.slice(0, 10)}
                    </span>
                  )}
                </div>

                {/* Extra row: commission + risk if visible */}
                {(show("commission") || show("risk")) && (
                  <div className="flex items-center gap-3 text-xs dark:text-slate-400 text-slate-500">
                    {show("commission") && (
                      <span>Comm: {t.commission != null ? `$${t.commission.toFixed(2)}` : "—"}</span>
                    )}
                    {show("risk") && (
                      <span>Risk: {t.risk_per_trade != null
                        ? `${t.risk_per_trade}%`
                        : defaultRiskPercent != null
                          ? <span className="italic dark:text-slate-500 text-slate-400">{defaultRiskPercent}%</span>
                          : "—"}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Desktop table (sm+) ── */}
        <div className="hidden sm:block overflow-x-auto p-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
          <table className="w-full text-sm border-collapse">
            <thead>
                <SortableContext items={headers.map(h => h.key)} strategy={horizontalListSortingStrategy}>
                  <tr className="border-b dark:border-slate-700/50 border-slate-100">
                    {selectable && (
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && selected.size === rows.length}
                          onChange={toggleAll}
                          className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>
                    )}
                    {headers.map((h) => (
                      <SortableHeader
                        key={h.key}
                        colKey={h.key}
                        label={h.label}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        showGrip={!!onReorderColumns}
                        sticky={h.key === "symbol"}
                      />
                    ))}
                    {/* Actions column (always visible) */}
                    <th className="px-4 py-3 text-left text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                  </tr>
                </SortableContext>
            </thead>
            <tbody className="divide-y dark:divide-slate-700/50 divide-slate-100">
              {rows.map((t) => {
                const livePnl =
                  t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined
                    ? (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1)
                    : null;
                const closedPnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
                const liveColor = livePnl !== null ? (livePnl > 0 ? "text-emerald-400" : livePnl < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500") : "dark:text-slate-400 text-slate-500";
                const isSelected = selected.has(t.id);
                const pot = calcPotentialPnl(t);
                const statusBadge = getStatusBadge(t);
                const costBasis = t.entry_price != null && t.shares != null
                  ? `$${(t.entry_price * t.shares).toFixed(2)}`
                  : null;
                return (
                  <tr key={t.id} className={clsx("hover:dark:bg-slate-800/30 hover:bg-slate-50/50 transition-colors group", isSelected && "dark:bg-emerald-500/5 bg-emerald-50/50")}>
                    {selectable && (
                      <td className="px-4 py-3 w-8">
                        <div className={clsx(
                          "transition-opacity duration-200",
                          !isSelected && selected.size === 0 ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                        )}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(t.id)}
                            className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                        </div>
                      </td>
                    )}
                    {show("symbol") && (
                      <td
                        className="px-4 py-3 font-bold text-violet-400 cursor-pointer hover:underline sticky left-0 z-10 dark:bg-slate-900 bg-white group-hover:dark:bg-slate-800/30 group-hover:bg-slate-50/50"
                        onClick={() => onEdit(t)}
                      >
                        <span className="flex items-center gap-1.5">
                          {t.symbol}
                          {t.source === "ibkr" && (
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/15 text-blue-400">IBKR</span>
                          )}
                          <ChecklistRing checklistState={t.checklist_state} size={24} />
                        </span>
                      </td>
                    )}
                    {show("direction") && (
                      <td className="px-4 py-3">
                        <span className={clsx("px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset", t.direction === "long" ? "bg-emerald-500/15 dark:text-white text-slate-900 ring-emerald-500/30" : "bg-red-500/15 dark:text-white text-slate-900 ring-red-500/30")}>
                          {t.direction === "long" ? "Long" : "Short"}
                        </span>
                      </td>
                    )}
                    {show("status") && (
                      <td className="px-4 py-3">
                        <span className={clsx("px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset", statusBadge.className)}>
                          {statusBadge.label}
                        </span>
                      </td>
                    )}
                    {show("entry") && <td className="px-4 py-3 dark:text-slate-300 text-slate-700 font-medium text-sm">{t.entry_price ? `$${t.entry_price}` : "—"}</td>}
                    {show("stop") && <td className="px-4 py-3 text-red-400 font-medium text-sm">{t.stop_loss ? `$${t.stop_loss}` : "—"}</td>}
                    {show("target") && <td className="px-4 py-3 text-emerald-400 font-medium text-sm">{t.take_profit ? `$${t.take_profit}` : "—"}</td>}
                    {show("exit") && <td className="px-4 py-3 dark:text-slate-300 text-slate-700 font-medium text-sm">{t.exit_price ? `$${t.exit_price}` : "—"}</td>}
                    {show("shares") && <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm font-medium">{t.shares ?? "—"}</td>}
                    {show("pnl") && (
                      <td className={clsx("px-4 py-3 font-semibold text-sm", closedPnlColor)}>
                        {hidden ? "••••" : (t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—")}
                      </td>
                    )}
                    {show("rr_achieved") && (() => {
                      const rr = calcRRAchieved(t);
                      const color = rr === null ? "" : rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-blue-400" : rr >= 0 ? "text-amber-400" : "text-red-400";
                      return <td className={clsx("px-4 py-3 text-sm font-semibold", color)}>{rr !== null ? `${rr.toFixed(2)}R` : "—"}</td>;
                    })()}
                    {show("pct_return") && (() => {
                      const pct = calcPercentReturn(t, accountSize ?? 10000);
                      const color = pct === null ? "" : pct >= 0 ? "text-emerald-400" : "text-red-400";
                      return <td className={clsx("px-4 py-3 text-sm font-semibold", color)}>{pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}</td>;
                    })()}
                    {show("cost_basis") && (
                      <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm font-medium">
                        {hidden ? "••••" : (costBasis ?? "—")}
                      </td>
                    )}
                    {show("hold_duration") && (
                      <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm">
                        {formatHoldDuration(t.entry_date, t.exit_date) ?? "—"}
                      </td>
                    )}
                    {show("rating") && (
                      <td className="px-4 py-3">
                        {t.rating ? (
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className={clsx("w-3 h-3", n <= t.rating! ? "text-amber-400 fill-amber-400" : "dark:text-slate-700 text-slate-300")} />
                            ))}
                          </div>
                        ) : "—"}
                      </td>
                    )}
                    {show("market_ctx") && (
                      <td className="px-4 py-3 text-sm dark:text-slate-400 text-slate-500 capitalize">
                        {t.market_context ? t.market_context.replace("_", " ") : "—"}
                      </td>
                    )}
                    {show("potential") && (
                      <td className="px-4 py-3">
                        {pot ? (
                          <div className="flex items-center gap-1.5">
                            {pot.profit != null && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-bold">+${pot.profit.toFixed(0)}</span>}
                            {pot.loss != null && <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-bold">-${Math.abs(pot.loss).toFixed(0)}</span>}
                          </div>
                        ) : "—"}
                      </td>
                    )}
                    {show("unrealized") && (
                      <td className={clsx("px-4 py-3 font-semibold text-sm", liveColor)}>
                        <span className="flex items-center gap-1.5">
                          {livePnl !== null && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {hidden ? "••••" : (livePnl !== null ? `${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}` : "—")}
                        </span>
                      </td>
                    )}
                    {show("commission") && (
                      <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm">
                        {t.commission != null ? `$${t.commission.toFixed(2)}` : "—"}
                      </td>
                    )}
                    {show("risk") && (
                      <td className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm">
                        {t.risk_per_trade != null
                          ? `${t.risk_per_trade}%`
                          : defaultRiskPercent != null
                            ? <span className="italic dark:text-slate-500 text-slate-400">{defaultRiskPercent}%</span>
                            : "—"}
                      </td>
                    )}
                    {show("date") && (
                      <td className="px-4 py-3 dark:text-slate-500 text-slate-400 text-xs whitespace-nowrap">
                        {t.entry_date ?? t.created_at.slice(0, 10)}
                      </td>
                    )}
                    {show("notes") && (
                      <td
                        className="px-4 py-3 dark:text-slate-400 text-slate-500 text-sm max-w-[150px] truncate cursor-help"
                        onMouseEnter={(e) => handleNoteEnter(e, t.notes || "")}
                        onMouseLeave={handleNoteLeave}
                      >
                        {t.notes || "—"}
                      </td>
                    )}
                    {show("mistakes") && (
                      <td className="px-4 py-3">
                        {mistakeTypes && mistakeTypes.length > 0 && t.mistake_tag_ids ? (() => {
                          const mistakeIds = t.mistake_tag_ids?.split(",").filter(Boolean) ?? [];
                          if (!mistakeIds.length) return <span className="dark:text-slate-600 text-slate-400 text-sm">—</span>;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {mistakeIds.map(id => {
                                const mt = mistakeTypes?.find(m => m.id === id);
                                if (!mt) return null;
                                return (
                                  <span
                                    key={id}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                                    style={{ backgroundColor: mt.color + "33", color: mt.color }}
                                  >
                                    {mt.name}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })() : <span className="dark:text-slate-600 text-slate-400 text-xs">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(buildChartUrl(t))}
                          className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                          title="Open in Chart"
                          aria-label="Open in Chart"
                        >
                          <LineChart className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                        </button>
                        <a
                          href={buildTradingViewUrl(t.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                          title="Open in TradingView"
                          aria-label="Open in TradingView"
                        >
                          <ExternalLink className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                        </a>
                        {onSetAlert && (
                          <button
                            onClick={() => onSetAlert(t.symbol, t.entry_price ?? undefined)}
                            className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                            title="Set Price Alert"
                            aria-label="Set Price Alert"
                          >
                            <Bell className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(t)}
                          className="p-1.5 rounded-xl hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                          title="Edit"
                          aria-label="Edit trade"
                        >
                          <PencilIcon className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id);
                          }}
                          className="p-1.5 rounded-xl hover:bg-red-500/20 transition-colors"
                          title="Delete"
                          aria-label="Delete trade"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t dark:border-slate-700/50 border-slate-100">
                <td colSpan={footerColSpan} className="px-4 py-2 text-xs dark:text-slate-500 text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>
                      {rows.length} trade{rows.length !== 1 ? "s" : ""}
                      {totalCount !== undefined && totalCount !== rows.length && (
                        <span className="ml-1">(filtered from {totalCount})</span>
                      )}
                    </span>
                    <span className={clsx("font-semibold", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      Total: {hidden ? "••••" : `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
          </DndContext>
        </div>
      </div>

      {/* Notes hover popover */}
      {mounted && hoverNote && createPortal(
        <div
          className="fixed z-[60] rounded-xl dark:bg-slate-900 bg-white shadow-2xl border dark:border-slate-700 border-slate-200 p-4 overflow-hidden"
          style={{
            top: notePos.top,
            left: Math.min(notePos.left, typeof window !== "undefined" ? window.innerWidth - 340 : notePos.left),
            width: 320
          }}
          onMouseEnter={() => clearTimeout(noteTimeout.current)}
          onMouseLeave={handleNoteLeave}
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b dark:border-slate-800 border-slate-100">
            <Pencil className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400">Trade Note</span>
          </div>
          <div className="text-xs dark:text-slate-300 text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto scrollbar-thin">
            {hoverNote}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );
}
