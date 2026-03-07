"use client";
import { useMemo, useState, useRef } from "react";
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

export default function WeeklyCalendar({ dailyPnl, dailyCounts, trades }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: fmtDate(d), dayName: DAYS[i], dayNum: d.getDate(), isToday: fmtDate(d) === fmtDate(new Date()) };
    });
  }, [weekOffset]);

  const weekTotal = useMemo(() => {
    return weekDays.reduce((sum, d) => sum + (dailyPnl.get(d.date) ?? 0), 0);
  }, [weekDays, dailyPnl]);

  const weekLabel = useMemo(() => {
    const first = weekDays[0].date;
    const last = weekDays[6].date;
    return `${first.slice(5)} - ${last.slice(5)}`;
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
    <div className="rounded-xl dark:bg-slate-900/80 bg-white px-4 py-3">
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

      <div className="relative grid grid-cols-7 gap-1.5">
        {weekDays.map((d) => {
          const pnl = dailyPnl.get(d.date) ?? 0;
          const count = dailyCounts.get(d.date) ?? 0;
          const hasTrades = count > 0;
          return (
            <button key={d.date}
              onClick={() => hasTrades ? setPopupDate(popupDate === d.date ? null : d.date) : undefined}
              className={`rounded-lg px-2.5 py-2 text-left transition-colors ${
                popupDate === d.date
                  ? "ring-1 ring-emerald-500 dark:bg-slate-700 bg-slate-200"
                  : d.isToday
                    ? "ring-1 ring-emerald-500/50 dark:bg-slate-800 bg-slate-100"
                    : "dark:bg-slate-800/50 bg-slate-50"
              } ${hasTrades ? "cursor-pointer hover:dark:bg-slate-700/80 hover:bg-slate-100" : "cursor-default"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-base font-bold ${d.isToday ? "dark:text-white text-slate-900" : "dark:text-slate-200 text-slate-700"}`}>
                    {d.dayNum}
                  </span>
                  <span className="text-[10px] font-medium dark:text-slate-500 text-slate-400">{d.dayName}</span>
                </div>
                {hasTrades && (
                  <FileText className="w-3.5 h-3.5 dark:text-slate-600 text-slate-300 shrink-0 mt-0.5" />
                )}
              </div>
              <div>
                <p className={`text-xs font-bold ${hasTrades ? (pnl >= 0 ? "text-emerald-400" : "text-red-400") : "dark:text-slate-600 text-slate-300"}`}>
                  {hasTrades ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}` : "$0"}
                </p>
                <p className="text-[10px] font-medium dark:text-slate-500 text-slate-400">
                  {count} trade{count !== 1 ? "s" : ""}
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
              left: popupDayIndex <= 3
                ? `${(popupDayIndex / 7) * 100}%`
                : undefined,
              right: popupDayIndex > 3
                ? `${((6 - popupDayIndex) / 7) * 100}%`
                : undefined,
            }}
          >
            <p className="text-xs font-semibold dark:text-slate-300 text-slate-700 mb-2">
              {popupDate}
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
