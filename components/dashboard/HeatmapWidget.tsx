"use client";
import { Trade } from "@/lib/types";
import { useMemo, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface HeatmapRanges {
  high: number;
  mid: number;
  low: number;
}

const DEFAULT_RANGES: HeatmapRanges = { high: 500, mid: 200, low: 1 };

function getHeatColor(pnl: number, ranges: HeatmapRanges): string {
  const abs = Math.abs(pnl);
  if (pnl === 0) return "#475569";
  if (pnl > 0) {
    if (abs >= ranges.high) return "#16a34a";
    if (abs >= ranges.mid) return "#22c55e";
    return "#86efac";
  }
  if (abs >= ranges.high) return "#dc2626";
  if (abs >= ranges.mid) return "#ef4444";
  return "#fca5a5";
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

interface Props {
  trades: Trade[];
  ranges?: HeatmapRanges;
}

export default function HeatmapWidget({ trades, ranges = DEFAULT_RANGES }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{ day: number; pnl: number | null } | null>(null);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const popupTrades = useMemo(() => {
    if (!popupDate) return [];
    return trades.filter(t => {
      if (t.status !== "closed") return false;
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      return d === popupDate;
    });
  }, [popupDate, trades]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const canGoForward = monthOffset < 0;

  function handleDayClick(dateStr: string, e: React.MouseEvent) {
    if (popupDate === dateStr) { setPopupDate(null); setPopupPos(null); return; }
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = cellRect.left - gridRect.left + cellRect.width / 2;
    const y = cellRect.bottom - gridRect.top + 4;
    setPopupDate(dateStr);
    setPopupPos({ x, y });
  }

  return (
    <div className="max-w-[280px]">
      <div className="flex items-center justify-between mb-1.5">
        <div /> {/* title is in the card wrapper */}
        <div className="flex items-center gap-1">
          <button onClick={() => { setMonthOffset(v => v - 1); setPopupDate(null); setPopupPos(null); }}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
          <span className="text-xs font-medium dark:text-slate-300 text-slate-700 min-w-[110px] text-center">{monthLabel}</span>
          <button onClick={() => { canGoForward && setMonthOffset(v => v + 1); setPopupDate(null); setPopupPos(null); }}
            disabled={!canGoForward}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-30">
            <ChevronRight className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[9px] dark:text-slate-500 text-slate-400">{d.slice(0, 2)}</div>
        ))}
      </div>

      <div ref={gridRef} className="relative grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} className="h-[26px]" />;
          const dateStr = getDateStr(day);
          const pnl = dailyPnl.get(dateStr) ?? null;
          const hasTrades = pnl !== null;
          const bg = hasTrades ? getHeatColor(pnl, ranges) : undefined;
          return (
            <div
              key={day}
              className={`h-[26px] rounded-sm flex items-center justify-center text-[9px] transition-opacity hover:opacity-80 ${
                hasTrades ? "cursor-pointer" : "cursor-default"
              } ${popupDate === dateStr ? "ring-1 ring-white/60" : ""}`}
              style={{
                background: bg ?? "rgb(30 41 59 / 0.3)",
                color: pnl !== null ? "#fff" : "rgb(100 116 139 / 0.6)",
              }}
              onMouseEnter={() => setHoverInfo({ day, pnl })}
              onMouseLeave={() => setHoverInfo(null)}
              onClick={(e) => hasTrades && handleDayClick(dateStr, e)}
            >
              {day}
            </div>
          );
        })}

        {/* Floating popup */}
        {popupDate && popupPos && popupTrades.length > 0 && (
          <div
            onMouseLeave={() => { setPopupDate(null); setPopupPos(null); }}
            className="absolute z-50 w-64 rounded-xl dark:bg-slate-800 bg-white shadow-xl p-3"
            style={{
              top: popupPos.y,
              left: Math.min(Math.max(popupPos.x - 128, 0), (gridRef.current?.offsetWidth ?? 280) - 256),
            }}
          >
            <p className="text-xs font-semibold dark:text-slate-300 text-slate-700 mb-2">
              {popupDate}
              <span className="ml-2 font-normal dark:text-slate-500 text-slate-400">
                {popupTrades.length} trade{popupTrades.length !== 1 ? "s" : ""}
              </span>
            </p>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {popupTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg dark:bg-slate-700/50 bg-slate-50 text-xs">
                  <div className="flex items-center gap-2">
                    {t.direction === "long"
                      ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                    <span className="font-bold text-emerald-400">{t.symbol}</span>
                    {t.shares != null && (
                      <span className="dark:text-slate-400 text-slate-500">{t.shares} sh</span>
                    )}
                  </div>
                  <span className={`font-bold ${(t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[9px] dark:text-slate-500 text-slate-400 min-h-[16px]">
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
