"use client";
import { useEffect, useState } from "react";
import { Grid3X3, Eye, EyeOff, Save, CheckCircle } from "lucide-react";
import clsx from "clsx";
import { INPUT, LABEL, HINT, INITIAL_SETTINGS } from "@/components/settings/types";

export default function AppearanceTab() {
  const [heatmapRanges, setHeatmapRanges] = useState({ high: 500, mid: 200, low: 1 });
  const [chartsCollapsed, setChartsCollapsed] = useState("false");
  const [privacyMode, setPrivacyMode] = useState("revealed");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        try {
          setHeatmapRanges(
            JSON.parse(
              data.heatmap_ranges || INITIAL_SETTINGS.heatmap_ranges
            )
          );
        } catch {
          setHeatmapRanges({ high: 500, mid: 200, low: 1 });
        }
        if (data.charts_collapsed !== undefined) setChartsCollapsed(data.charts_collapsed);
        if (data.privacy_mode !== undefined) setPrivacyMode(data.privacy_mode);
      });
  }, []);

  const setHeatRange = (key: string, value: number) => {
    setHeatmapRanges((r) => ({ ...r, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heatmap_ranges: JSON.stringify(heatmapRanges),
        charts_collapsed: chartsCollapsed,
        privacy_mode: privacyMode,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <Grid3X3 className="w-4 h-4 text-emerald-400" /> Activity Heatmap
      </h2>
      <p className="text-xs dark:text-slate-400 text-slate-500">
        Set P&amp;L thresholds for heatmap colors. Amounts above &quot;High&quot; get the darkest
        shade, &quot;Mid&quot; to &quot;High&quot; medium, &quot;Low&quot; to &quot;Mid&quot;
        lightest.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>High Threshold ($)</label>
          <input
            type="number"
            value={heatmapRanges.high}
            onChange={(e) => setHeatRange("high", Number(e.target.value))}
            className={INPUT}
          />
          <p className={HINT}>Darkest green/red shade</p>
        </div>
        <div>
          <label className={LABEL}>Mid Threshold ($)</label>
          <input
            type="number"
            value={heatmapRanges.mid}
            onChange={(e) => setHeatRange("mid", Number(e.target.value))}
            className={INPUT}
          />
          <p className={HINT}>Medium green/red shade</p>
        </div>
        <div>
          <label className={LABEL}>Low Threshold ($)</label>
          <input
            type="number"
            value={heatmapRanges.low}
            onChange={(e) => setHeatRange("low", Number(e.target.value))}
            className={INPUT}
          />
          <p className={HINT}>Lightest green/red shade</p>
        </div>
      </div>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm dark:text-slate-300 text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={chartsCollapsed === "true"}
            onChange={(e) => setChartsCollapsed(e.target.checked ? "true" : "false")}
            className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
          />
          Collapse charts by default
        </label>

        <div className="pt-2">
          <label className={LABEL}>Default Privacy Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPrivacyMode("revealed")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                privacyMode === "revealed"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-700 hover:bg-slate-200"
              )}
            >
              <Eye className="w-4 h-4" /> Revealed
            </button>
            <button
              onClick={() => setPrivacyMode("hidden")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                privacyMode === "hidden"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-700 hover:bg-slate-200"
              )}
            >
              <EyeOff className="w-4 h-4" /> Hidden
            </button>
          </div>
          <p className={HINT}>
            Choose whether prices are hidden or shown by default when you load the app.
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="pt-2 border-t dark:border-slate-800 border-slate-100">
        <p className="text-xs dark:text-slate-500 text-slate-400 mb-2">Color preview</p>
        <div className="flex items-center gap-2 text-[10px] dark:text-slate-500 text-slate-400">
          <span>-${heatmapRanges.high}+</span>
          <div className="w-5 h-5 rounded" style={{ background: "#dc2626" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#ef4444" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#fca5a5" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#475569" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#86efac" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#22c55e" }} />
          <div className="w-5 h-5 rounded" style={{ background: "#16a34a" }} />
          <span>+${heatmapRanges.high}+</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
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
    </section>
  );
}
