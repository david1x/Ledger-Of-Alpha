"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Trade } from "@/lib/types";

interface Props {
  dailyPnl: Map<string, number>;
  dailyCounts: Map<string, number>;
  trades: Trade[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt$(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

export default function WeeklyCalendar({ dailyPnl, dailyCounts, trades }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Click Outside Logic ──
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPopupDate(null);
      }
    }
    if (popupDate) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupDate]);

  const dayCount = isMobile ? 3 : 7;

  const weekDays = useMemo(() => {
    if (isMobile) {
      // 3-day sliding window centered on today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(today.getDate() + weekOffset * 3 - 1); // yesterday-centered by default
      return Array.from({ length: 3 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dow = d.getDay();
        const dayIndex = dow === 0 ? 6 : dow - 1; // Mon=0 .. Sun=6
        return { date: fmtDate(d), dayName: DAYS[dayIndex], dayNum: d.getDate(), isToday: fmtDate(d) === fmtDate(new Date()) };
      });
    }
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: fmtDate(d), dayName: DAYS[i], dayNum: d.getDate(), isToday: fmtDate(d) === fmtDate(new Date()) };
    });
  }, [weekOffset, isMobile]);

  const weekTotal = useMemo(() => {
    return weekDays.reduce((sum, d) => sum + (dailyPnl.get(d.date) ?? 0), 0);
  }, [weekDays, dailyPnl]);

  const weekLabel = useMemo(() => {
    const toDM = (d: string) => { const [, m, day] = d.split("-"); return `${day}-${m}`; };
    return `${toDM(weekDays[0].date)} - ${toDM(weekDays[weekDays.length - 1].date)}`;
  }, [weekDays]);

  const canGoForward = weekOffset < 0;

  const popupTrades = useMemo(() => {
    if (!popupDate) return [];
    return trades.filter(t => {
      if (t.status !== "closed") return false;
      const d = t.exit_date ?? t.created_at.slice(0, 10);
      return d === popupDate;
    });
  }, [popupDate, trades]);

  // Find index of popup day for positioning
  const popupDayIndex = popupDate ? weekDays.findIndex(d => d.date === popupDate) : -1;

  return (
    <div ref={containerRef} className="rounded-xl dark:bg-slate-900/80 bg-white px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setWeekOffset(v => v - 1); setPopupDate(null); }}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors">
            <ChevronLeft className="w-4 h-4 dark:text-slate-300 text-slate-600" />
          </button>
          <span className="text-sm font-semibold dark:text-slate-200 text-slate-800 min-w-[110px] text-center">{weekLabel}</span>
          <button onClick={() => { canGoForward && setWeekOffset(v => v + 1); setPopupDate(null); }}
            disabled={!canGoForward}
            className="p-1 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4 dark:text-slate-300 text-slate-600" />
          </button>
        </div>
        <span className={`text-sm font-bold ${weekTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {weekTotal !== 0 ? `${weekTotal >= 0 ? "+" : ""}$${weekTotal.toFixed(2)}` : "$0.00"}
        </span>
      </div>

      <div className={`relative grid gap-1.5 ${isMobile ? "grid-cols-3" : "grid-cols-7"}`}>
        {weekDays.map((d) => {
          const pnl = dailyPnl.get(d.date) ?? 0;
          const count = dailyCounts.get(d.date) ?? 0;
          const hasTrades = count > 0;
          return (
            <button key={d.date}
              onClick={() => hasTrades ? setPopupDate(popupDate === d.date ? null : d.date) : undefined}
              className={`rounded-xl px-2 py-2.5 text-center transition-all flex flex-col items-center justify-between min-h-[90px] relative ${
                popupDate === d.date
                  ? "ring-2 ring-emerald-500/50 dark:bg-slate-800 bg-slate-100 shadow-lg scale-[1.02] z-10"
                  : d.isToday
                    ? "ring-1 ring-emerald-500/30 dark:bg-slate-800/50 bg-slate-50 shadow-sm"
                    : "dark:bg-slate-800/30 bg-slate-50/50 border dark:border-slate-800/50 border-slate-100"
              } ${hasTrades ? "cursor-pointer hover:dark:bg-slate-800 hover:bg-slate-100 active:scale-95" : "cursor-default opacity-60"}`}
            >
              {hasTrades && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                </div>
              )}
              
              <div className="flex flex-col items-center leading-none mb-2">
                <span className={`text-lg font-black tracking-tighter ${d.isToday ? "text-emerald-400" : "dark:text-white text-slate-900"}`}>
                  {d.dayNum}
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 mt-1">{d.dayName}</span>
              </div>

              <div className="flex flex-col items-center leading-tight">
                <p className={`text-[11px] font-black tabular-nums ${hasTrades ? (pnl >= 0 ? "text-emerald-400" : "text-red-400") : "dark:text-slate-600 text-slate-400"}`}>
                  {hasTrades ? (pnl >= 0 ? "+" : "-") + fmt$(pnl).replace("$", "") : "$0"}
                </p>
                <p className="text-[7px] font-black uppercase tracking-widest dark:text-slate-600 text-slate-500 mt-0.5">
                  {count} {count === 1 ? "Trade" : "Trades"}
                </p>
              </div>
            </button>
          );
        })}

        {/* Floating popup */}
        {popupDate && popupTrades.length > 0 && (
          <div
            ref={popupRef}
            onMouseLeave={() => setPopupDate(null)}
            className="absolute z-50 top-full mt-2 w-72 rounded-xl border dark:border-slate-600 border-slate-200 dark:bg-slate-800 bg-white shadow-xl p-3"
            style={{
              left: popupDayIndex <= Math.floor(dayCount / 2)
                ? `${(popupDayIndex / dayCount) * 100}%`
                : undefined,
              right: popupDayIndex > Math.floor(dayCount / 2)
                ? `${((dayCount - 1 - popupDayIndex) / dayCount) * 100}%`
                : undefined,
            }}
          >
            <p className="text-xs font-semibold dark:text-slate-300 text-slate-700 mb-2">
              {popupDate ? popupDate.split("-").reverse().join("-") : ""}
              <span className="ml-2 font-normal dark:text-slate-500 text-slate-400">
                {popupTrades.length} trade{popupTrades.length !== 1 ? "s" : ""}
              </span>
            </p>
            <div className="space-y-1">
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
    </div>
  );
}
