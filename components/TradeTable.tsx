"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trade, QuoteMap } from "@/lib/types";
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown } from "lucide-react";
import MiniChart from "@/components/MiniChart";
import clsx from "clsx";

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
  { key: "potential",  label: "Potential",   default: true },
  { key: "unrealized", label: "Unrealized",  default: true },
  { key: "commission", label: "Commission",  default: false },
  { key: "risk",       label: "Risk %",      default: false },
  { key: "date",       label: "Date",       default: true },
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
}

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-400",
  open: "bg-yellow-500/20 text-yellow-400",
  closed: "bg-slate-500/20 dark:text-slate-400 text-slate-500",
};

function calcPotentialPnl(t: Trade) {
  if (t.status === "closed") return null;
  if (t.entry_price == null || t.shares == null) return null;
  const comm = (t.commission ?? 0) * 2;
  const profit =
    t.take_profit != null
      ? Math.abs(t.take_profit - t.entry_price) * t.shares - comm
      : null;
  const loss =
    t.stop_loss != null
      ? -(Math.abs(t.stop_loss - t.entry_price) * t.shares + comm)
      : null;
  if (profit == null && loss == null) return null;
  return { profit, loss };
}

function getSortValue(t: Trade, key: ColumnKey, quotes: QuoteMap, defaultRiskPercent?: number): string | number {
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
    default: return 0;
  }
}

export default function TradeTable({ trades, onEdit, onDelete, onBulkDelete, limit, quotes = {}, visibleColumns, defaultRiskPercent }: Props) {
  const baseRows = limit ? trades.slice(0, limit) : trades;
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
        const av = getSortValue(a, sortKey, quotes, defaultRiskPercent);
        const bv = getSortValue(b, sortKey, quotes, defaultRiskPercent);
        let cmp = 0;
        if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
        else cmp = (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      })
    : baseRows;

  const visible = new Set<ColumnKey>(visibleColumns ?? DEFAULT_COLUMNS);
  const show = (k: ColumnKey) => visible.has(k);

  const selectable = !!onBulkDelete;

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(t => t.id)));
  };

  const handleBulkDelete = () => {
    if (!selected.size || !onBulkDelete) return;
    if (!confirm(`Delete ${selected.size} trade${selected.size > 1 ? "s" : ""}?`)) return;
    onBulkDelete([...selected]);
    setSelected(new Set());
  };

  // Symbol hover popover state
  const [hoverTrade, setHoverTrade] = useState<Trade | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSymbolEnter = useCallback((e: React.MouseEvent<HTMLTableCellElement>, t: Trade) => {
    clearTimeout(hoverTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeout.current = setTimeout(() => {
      setHoverPos({ top: rect.bottom + 4, left: rect.left });
      setHoverTrade(t);
    }, 300);
  }, []);

  const handleSymbolLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setHoverTrade(null);
  }, []);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-8 text-center">
        <p className="dark:text-slate-500 text-slate-400 text-sm">No trades found. Add your first trade!</p>
      </div>
    );
  }

  // Build visible header list for desktop
  const headers: { key: ColumnKey; label: string }[] = ALL_COLUMNS
    .filter(c => show(c.key))
    .map(c => ({ key: c.key, label: c.label }));

  return (
    <div>
      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200">
          <span className="text-sm dark:text-slate-300 text-slate-700 font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 transition-colors ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      <div className="rounded-xl border dark:border-slate-700 border-slate-200 overflow-hidden">

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
                      />
                    )}
                    {show("symbol") && <span className="font-bold text-emerald-400">{t.symbol}</span>}
                    {show("direction") && (
                      t.direction === "long"
                        ? <span className="flex items-center gap-0.5 text-xs text-emerald-400"><ArrowUpRight className="w-3 h-3" />Long</span>
                        : <span className="flex items-center gap-0.5 text-xs text-red-400"><ArrowDownRight className="w-3 h-3" />Short</span>
                    )}
                    {show("status") && (
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[t.status])}>
                        {t.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id); }} className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors" title="Delete">
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
                        P&L: {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—"}
                      </span>
                    )}
                    {show("potential") && pot && (
                      <span className="font-medium">
                        {pot.profit != null && <span className="text-emerald-400">+${pot.profit.toFixed(2)}</span>}
                        {pot.profit != null && pot.loss != null && <span className="dark:text-slate-500 text-slate-400"> / </span>}
                        {pot.loss != null && <span className="text-red-400">-${Math.abs(pot.loss).toFixed(2)}</span>}
                      </span>
                    )}
                    {show("unrealized") && livePnl !== null && (
                      <span className={clsx("flex items-center gap-1 font-medium", liveColor)}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {`${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}`}
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
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="dark:bg-slate-800/60 bg-slate-100 border-b dark:border-slate-700 border-slate-200">
                {selectable && (
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                )}
                {headers.map((h) => (
                  <th key={h.key} className="px-3 py-2.5 text-left text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort(h.key)}
                      className="flex items-center gap-1 hover:dark:text-slate-200 hover:text-slate-700 transition-colors cursor-pointer select-none"
                    >
                      {h.label}
                      {sortKey === h.key && (
                        sortDir === "asc"
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                ))}
                {/* Actions column (always visible) */}
                <th className="px-3 py-2.5 text-left text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider whitespace-nowrap" />
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800 divide-slate-100">
              {rows.map((t) => {
                const livePnl =
                  t.status === "open" && t.entry_price != null && t.shares != null && quotes[t.symbol] !== undefined
                    ? (quotes[t.symbol] - t.entry_price) * t.shares * (t.direction === "long" ? 1 : -1)
                    : null;
                const closedPnlColor = (t.pnl ?? 0) > 0 ? "text-emerald-400" : (t.pnl ?? 0) < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500";
                const liveColor = livePnl !== null ? (livePnl > 0 ? "text-emerald-400" : livePnl < 0 ? "text-red-400" : "dark:text-slate-400 text-slate-500") : "dark:text-slate-400 text-slate-500";
                const isSelected = selected.has(t.id);
                const pot = calcPotentialPnl(t);
                return (
                  <tr key={t.id} className={clsx("hover:dark:bg-slate-800/30 hover:bg-slate-50 transition-colors", isSelected && "dark:bg-emerald-500/5 bg-emerald-50")}>
                    {selectable && (
                      <td className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(t.id)}
                          className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {show("symbol") && (
                      <td
                        className="px-3 py-2.5 font-bold text-emerald-400 cursor-default"
                        onMouseEnter={(e) => handleSymbolEnter(e, t)}
                        onMouseLeave={handleSymbolLeave}
                      >
                        {t.symbol}
                      </td>
                    )}
                    {show("direction") && (
                      <td className="px-3 py-2.5">
                        {t.direction === "long"
                          ? <span className="flex items-center gap-1 text-emerald-400"><ArrowUpRight className="w-3 h-3" />Long</span>
                          : <span className="flex items-center gap-1 text-red-400"><ArrowDownRight className="w-3 h-3" />Short</span>
                        }
                      </td>
                    )}
                    {show("status") && (
                      <td className="px-3 py-2.5">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLE[t.status])}>
                          {t.status}
                        </span>
                      </td>
                    )}
                    {show("entry") && <td className="px-3 py-2.5 dark:text-slate-300 text-slate-700">{t.entry_price ? `$${t.entry_price}` : "—"}</td>}
                    {show("stop") && <td className="px-3 py-2.5 text-red-400">{t.stop_loss ? `$${t.stop_loss}` : "—"}</td>}
                    {show("target") && <td className="px-3 py-2.5 text-emerald-400">{t.take_profit ? `$${t.take_profit}` : "—"}</td>}
                    {show("exit") && <td className="px-3 py-2.5 dark:text-slate-300 text-slate-700">{t.exit_price ? `$${t.exit_price}` : "—"}</td>}
                    {show("shares") && <td className="px-3 py-2.5 dark:text-slate-400 text-slate-500">{t.shares ?? "—"}</td>}
                    {show("pnl") && (
                      <td className={clsx("px-3 py-2.5 font-medium", closedPnlColor)}>
                        {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—"}
                      </td>
                    )}
                    {show("potential") && (
                      <td className="px-3 py-2.5">
                        {pot ? (
                          <div className="flex flex-col text-xs font-medium leading-tight">
                            {pot.profit != null && <span className="text-emerald-400">+${pot.profit.toFixed(2)}</span>}
                            {pot.loss != null && <span className="text-red-400">-${Math.abs(pot.loss).toFixed(2)}</span>}
                          </div>
                        ) : "—"}
                      </td>
                    )}
                    {show("unrealized") && (
                      <td className={clsx("px-3 py-2.5 font-medium", liveColor)}>
                        <span className="flex items-center gap-1.5">
                          {livePnl !== null && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {livePnl !== null ? `${livePnl >= 0 ? "+" : ""}$${livePnl.toFixed(2)}` : "—"}
                        </span>
                      </td>
                    )}
                    {show("commission") && (
                      <td className="px-3 py-2.5 dark:text-slate-400 text-slate-500">
                        {t.commission != null ? `$${t.commission.toFixed(2)}` : "—"}
                      </td>
                    )}
                    {show("risk") && (
                      <td className="px-3 py-2.5 dark:text-slate-400 text-slate-500">
                        {t.risk_per_trade != null
                          ? `${t.risk_per_trade}%`
                          : defaultRiskPercent != null
                            ? <span className="italic dark:text-slate-500 text-slate-400">{defaultRiskPercent}%</span>
                            : "—"}
                      </td>
                    )}
                    {show("date") && (
                      <td className="px-3 py-2.5 dark:text-slate-500 text-slate-400 text-xs whitespace-nowrap">
                        {t.entry_date ?? t.created_at.slice(0, 10)}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(t)}
                          className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete trade for ${t.symbol}?`)) onDelete(t.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Symbol hover popover */}
      {mounted && hoverTrade && createPortal(
        <div
          className="fixed z-50 rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-xl overflow-hidden"
          style={{ top: hoverPos.top, left: hoverPos.left, width: 320 }}
          onMouseEnter={() => clearTimeout(hoverTimeout.current)}
          onMouseLeave={handleSymbolLeave}
        >
          <div className="px-3 py-1.5 text-xs font-bold text-emerald-400 border-b dark:border-slate-700 border-slate-200">
            {hoverTrade.symbol}
          </div>
          <MiniChart
            symbol={hoverTrade.symbol}
            entry={hoverTrade.entry_price}
            stopLoss={hoverTrade.stop_loss}
            takeProfit={hoverTrade.take_profit}
            height={180}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
