"use client";
import { useEffect, useState } from "react";
import { ListChecks, Trash2, Save, CheckCircle } from "lucide-react";
import { INPUT, INITIAL_SETTINGS } from "@/components/settings/types";

export default function TagsTab() {
  const [defaultTags, setDefaultTags] = useState<string[]>([]);
  const [defaultMistakes, setDefaultMistakes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        try {
          setDefaultTags(JSON.parse(data.default_tags || "[]"));
        } catch {
          setDefaultTags([]);
        }
        try {
          setDefaultMistakes(
            JSON.parse(
              data.default_mistakes ||
                JSON.stringify(
                  JSON.parse(INITIAL_SETTINGS.default_mistakes)
                )
            )
          );
        } catch {
          setDefaultMistakes([]);
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_tags: JSON.stringify(defaultTags),
        default_mistakes: JSON.stringify(defaultMistakes),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-6">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-emerald-400" /> Default Tags &amp; Mistakes
      </h2>

      {/* Default Tags */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700">Quick-Select Tags</h3>
        <p className="text-xs dark:text-slate-500 text-slate-400">
          These appear as quick-select pills in the Trade Modal.
        </p>
        <div className="flex flex-wrap gap-2">
          {defaultTags.map((tag, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            >
              {tag}
              <button
                type="button"
                onClick={() => setDefaultTags((prev) => prev.filter((_, j) => j !== i))}
                className="hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a tag..."
            className={INPUT + " flex-1"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                const val = (e.target as HTMLInputElement).value.trim();
                if (!defaultTags.includes(val)) {
                  setDefaultTags((prev) => [...prev, val]);
                }
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>
      </div>

      {/* Default Mistakes */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium dark:text-slate-300 text-slate-700">Mistake Options</h3>
        <p className="text-xs dark:text-slate-500 text-slate-400">
          Customizable list of common trading mistakes shown in the Reflection tab.
        </p>
        <div className="flex flex-wrap gap-2">
          {defaultMistakes.map((m, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
            >
              {m}
              <button
                type="button"
                onClick={() => setDefaultMistakes((prev) => prev.filter((_, j) => j !== i))}
                className="hover:text-white transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a mistake..."
            className={INPUT + " flex-1"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                const val = (e.target as HTMLInputElement).value.trim();
                if (!defaultMistakes.includes(val)) {
                  setDefaultMistakes((prev) => [...prev, val]);
                }
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
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
