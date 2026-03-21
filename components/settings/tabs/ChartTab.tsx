"use client";
import { useEffect, useState } from "react";
import { LineChart, CheckCircle, Settings, Save } from "lucide-react";
import clsx from "clsx";
import { LABEL, CARD, INITIAL_SETTINGS, useTabDirty } from "@/components/settings/types";

export default function ChartTab() {
  const [tvHideSideToolbar, setTvHideSideToolbar] = useState("false");
  const [tvWithdateranges, setTvWithdateranges] = useState("true");
  const [tvDetails, setTvDetails] = useState("false");
  const [tvHotlist, setTvHotlist] = useState("false");
  const [tvCalendar, setTvCalendar] = useState("false");
  const [tvStudies, setTvStudies] = useState<string[]>(
    JSON.parse(INITIAL_SETTINGS.tv_studies)
  );
  const chartState = { tvHideSideToolbar, tvWithdateranges, tvDetails, tvHotlist, tvCalendar, tvStudies: tvStudies as unknown } as Record<string, unknown>;
  const { resetBaseline } = useTabDirty("chart", chartState);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.tv_hide_side_toolbar !== undefined) setTvHideSideToolbar(data.tv_hide_side_toolbar);
        if (data.tv_withdateranges !== undefined) setTvWithdateranges(data.tv_withdateranges);
        if (data.tv_details !== undefined) setTvDetails(data.tv_details);
        if (data.tv_hotlist !== undefined) setTvHotlist(data.tv_hotlist);
        if (data.tv_calendar !== undefined) setTvCalendar(data.tv_calendar);
        if (data.tv_studies) {
          try {
            setTvStudies(JSON.parse(data.tv_studies));
          } catch {
            /* keep default */
          }
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tv_hide_side_toolbar: tvHideSideToolbar,
        tv_withdateranges: tvWithdateranges,
        tv_details: tvDetails,
        tv_hotlist: tvHotlist,
        tv_calendar: tvCalendar,
        tv_studies: JSON.stringify(tvStudies),
      }),
    });
    setSaving(false);
    setSaved(true);
    resetBaseline();
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Features */}
        <section className={CARD}>
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-emerald-400" /> Chart Features
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-500">
            Customize the default appearance and features of the embedded TradingView charts.
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Drawing Toolbar</p>
                <p className="text-[10px] dark:text-slate-500 text-slate-400">Show left-side drawing tools</p>
              </div>
              <input type="checkbox" checked={tvHideSideToolbar !== "true"} onChange={(e) => setTvHideSideToolbar(e.target.checked ? "false" : "true")} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Date Ranges</p>
                <p className="text-[10px] dark:text-slate-500 text-slate-400">Show bottom range selector (1D, 5D, 1M...)</p>
              </div>
              <input type="checkbox" checked={tvWithdateranges !== "false"} onChange={(e) => setTvWithdateranges(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Symbol Details</p>
                <p className="text-[10px] dark:text-slate-500 text-slate-400">Show description panel on the right</p>
              </div>
              <input type="checkbox" checked={tvDetails === "true"} onChange={(e) => setTvDetails(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Market Hotlist</p>
                <p className="text-[10px] dark:text-slate-500 text-slate-400">Show gainers/losers on the right</p>
              </div>
              <input type="checkbox" checked={tvHotlist === "true"} onChange={(e) => setTvHotlist(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-800 border-slate-100 hover:dark:bg-slate-800/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-sm font-medium dark:text-slate-200 text-slate-700">Economic Calendar</p>
                <p className="text-[10px] dark:text-slate-500 text-slate-400">Show events panel on the right</p>
              </div>
              <input type="checkbox" checked={tvCalendar === "true"} onChange={(e) => setTvCalendar(e.target.checked ? "true" : "false")} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500" />
            </label>
          </div>
        </section>

        {/* Default Indicators */}
        <section className={CARD}>
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" /> Default Indicators
          </h2>
          <p className="text-[10px] dark:text-slate-400 text-slate-500">
            Choose indicators to load by default.{" "}
            <span className="text-emerald-400">Note:</span> The free version uses default lengths
            (e.g. 20). You can manually change the length (e.g. 150) and color (e.g. Red) directly
            on the chart, and it will be remembered.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: "MAExp@tv-basicstudies", label: "Moving Average Exponential (EMA)" },
              { id: "MASimple@tv-basicstudies", label: "Moving Average Simple (SMA)" },
              { id: "RSI@tv-basicstudies", label: "Relative Strength Index (RSI)" },
              { id: "MACD@tv-basicstudies", label: "MACD" },
              { id: "StochasticRSI@tv-basicstudies", label: "Stochastic RSI" },
              { id: "BollingerBands@tv-basicstudies", label: "Bollinger Bands" },
              { id: "Volume@tv-basicstudies", label: "Volume" },
            ].map((study) => {
              const isSelected = tvStudies.includes(study.id);
              return (
                <button
                  key={study.id}
                  onClick={() => {
                    const next = isSelected
                      ? tvStudies.filter((id) => id !== study.id)
                      : [...tvStudies, study.id];
                    setTvStudies(next);
                  }}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                      : "dark:bg-slate-800/50 bg-slate-50 dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:border-slate-400"
                  )}
                >
                  {study.label}
                  {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Pro Tips */}
        <section className={CARD + " lg:col-span-2"}>
          <h3 className="text-sm font-semibold dark:text-emerald-400 text-emerald-600 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Pro Tips: Manual Tuning
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl dark:bg-slate-800/30 bg-slate-50 p-4 border dark:border-slate-800 border-slate-100 space-y-1">
              <p className="text-xs font-bold dark:text-slate-200 text-slate-700">
                Set MA to 150 (or any length)
              </p>
              <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                TradingView&apos;s free embed always loads indicators with defaults (e.g. 9 or 20).
                Hover over the &quot;MA&quot; label → Click gear icon → Change Length to 150. Your browser remembers it!
              </p>
            </div>
            <div className="rounded-xl dark:bg-slate-800/30 bg-slate-50 p-4 border dark:border-slate-800 border-slate-100 space-y-1">
              <p className="text-xs font-bold dark:text-slate-200 text-slate-700">
                Move Volume to a New Pane
              </p>
              <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                Right-click Volume bars → &quot;Move to...&quot; → &quot;New Pane Below&quot;. Layout persisted automatically.
              </p>
            </div>
            <div className="rounded-xl dark:bg-slate-800/30 bg-slate-50 p-4 border dark:border-slate-800 border-slate-100 space-y-1">
              <p className="text-xs font-bold dark:text-slate-200 text-slate-700">
                Sidebar Behavior
              </p>
              <p className="text-[10px] dark:text-slate-400 text-slate-500 leading-relaxed">
                Enabling Details, Hotlist, or Calendar forces the right sidebar open. Disable for a &quot;borderless&quot; look.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </>
  );
}
