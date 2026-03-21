"use client";
import { useEffect, useState } from "react";
import { Copy, Trash2, Save, CheckCircle } from "lucide-react";
import { useTabDirty } from "@/components/settings/types";

interface TradeTemplate {
  id: string;
  name: string;
  fields: Record<string, unknown>;
}

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const templatesState = { templates: templates as unknown } as Record<string, unknown>;
  const { resetBaseline } = useTabDirty("templates", templatesState);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        try {
          setTemplates(JSON.parse(data.trade_templates || "[]"));
        } catch {
          setTemplates([]);
        }
      });
  }, []);

  const removeTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTemplateName = (id: string, name: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_templates: JSON.stringify(templates) }),
    });
    setSaving(false);
    setSaved(true);
    resetBaseline();
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <Copy className="w-4 h-4 text-emerald-400" /> Trade Templates
      </h2>
      <p className="text-xs dark:text-slate-500 text-slate-400">
        Save commonly used trade setups as templates. Load them in the Trade Modal to pre-fill
        fields.
      </p>
      <div className="space-y-3">
        {templates.length === 0 && (
          <p className="text-sm dark:text-slate-500 text-slate-400 italic">
            No templates yet. Create one from the Trade Modal using &quot;Save as Template&quot;.
          </p>
        )}
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="flex items-center gap-3 p-3 rounded-lg dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200"
          >
            <input
              type="text"
              value={tmpl.name}
              onChange={(e) => updateTemplateName(tmpl.id, e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium dark:text-white text-slate-900 outline-none"
            />
            <div className="flex items-center gap-2 text-xs dark:text-slate-500 text-slate-400 shrink-0">
              {tmpl.fields.symbol ? <span>{String(tmpl.fields.symbol)}</span> : null}
              {tmpl.fields.direction ? (
                <span className="capitalize">{String(tmpl.fields.direction)}</span>
              ) : null}
            </div>
            <button
              onClick={() => removeTemplate(tmpl.id)}
              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Templates"}
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
