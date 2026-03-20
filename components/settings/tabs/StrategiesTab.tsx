"use client";
import { useEffect, useState } from "react";
import { ListChecks, Plus, GripVertical, ChevronDown, ChevronRight, Trash2, Save, CheckCircle } from "lucide-react";
import { DEFAULT_STRATEGIES } from "@/lib/strategies";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { INITIAL_SETTINGS, useTabDirty } from "@/components/settings/types";

interface Strategy {
  id: string;
  name: string;
  checklist: string[];
}

function SortableStrategy({
  strat,
  isCollapsed,
  toggleCollapse,
  updateStrategyName,
  removeStrategy,
  addChecklistItem,
  updateChecklistItem,
  removeChecklistItem,
}: {
  strat: Strategy;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  updateStrategyName: (id: string, name: string) => void;
  removeStrategy: (id: string) => void;
  addChecklistItem: (stratId: string) => void;
  updateChecklistItem: (stratId: string, idx: number, val: string) => void;
  removeChecklistItem: (stratId: string, idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white overflow-hidden shadow-sm"
    >
      <div className="p-4 dark:bg-slate-800/30 bg-slate-50/50 flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="p-1.5 rounded hover:dark:bg-slate-700 hover:bg-slate-200 cursor-grab active:cursor-grabbing transition-colors shrink-0"
        >
          <GripVertical className="w-4 h-4 dark:text-slate-500 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-0.5 rounded hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 dark:text-slate-400 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 dark:text-slate-400 text-slate-500" />
          )}
        </button>
        <input
          type="text"
          value={strat.name}
          onChange={(e) => updateStrategyName(strat.id, e.target.value)}
          className="flex-1 bg-transparent border-none p-0 font-bold dark:text-white text-slate-900 focus:ring-0 text-sm"
          placeholder="Strategy Name"
        />
        <span className="text-[10px] font-medium dark:text-slate-500 text-slate-400 tabular-nums shrink-0">
          {strat.checklist.length} items
        </span>
        <button
          onClick={() => removeStrategy(strat.id)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {!isCollapsed && (
        <div className="p-4 space-y-3 border-t dark:border-slate-800 border-slate-100">
          <div className="space-y-2">
            {strat.checklist.map((item: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md border dark:border-slate-700 border-slate-300 flex items-center justify-center text-[10px] dark:text-slate-500 text-slate-400 font-bold">
                  {idx + 1}
                </div>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateChecklistItem(strat.id, idx, e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white dark:text-slate-300 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Checklist item..."
                />
                <button
                  onClick={() => removeChecklistItem(strat.id, idx)}
                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => addChecklistItem(strat.id)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors mt-2"
          >
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>
      )}
    </div>
  );
}

export default function StrategiesTab() {
  const [strategiesJson, setStrategiesJson] = useState(INITIAL_SETTINGS.strategies);
  const { resetBaseline } = useTabDirty("strategies", { strategiesJson } as Record<string, unknown>);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.strategies) {
          try {
            const parsed = JSON.parse(data.strategies);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setStrategiesJson(data.strategies);
            } else {
              // Seed with built-in defaults
              setStrategiesJson(JSON.stringify(DEFAULT_STRATEGIES));
            }
          } catch {
            setStrategiesJson(JSON.stringify(DEFAULT_STRATEGIES));
          }
        } else {
          // Fresh install — seed with 5 built-in defaults
          setStrategiesJson(JSON.stringify(DEFAULT_STRATEGIES));
        }
      });
  }, []);

  const strategies: Strategy[] = (() => {
    try {
      return JSON.parse(strategiesJson || "[]");
    } catch {
      return [];
    }
  })();

  const updateStrategies = (newStrats: Strategy[]) => {
    setStrategiesJson(JSON.stringify(newStrats));
  };

  const addStrategy = () => {
    const newStrat: Strategy = {
      id: crypto.randomUUID(),
      name: "New Strategy",
      checklist: ["Checklist Item 1"],
    };
    updateStrategies([...strategies, newStrat]);
  };

  const removeStrategy = (id: string) => {
    updateStrategies(strategies.filter((s) => s.id !== id));
  };

  const updateStrategyName = (id: string, name: string) => {
    updateStrategies(strategies.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const addChecklistItem = (stratId: string) => {
    updateStrategies(
      strategies.map((s) =>
        s.id === stratId ? { ...s, checklist: [...s.checklist, ""] } : s
      )
    );
  };

  const updateChecklistItem = (stratId: string, idx: number, val: string) => {
    updateStrategies(
      strategies.map((s) =>
        s.id === stratId
          ? { ...s, checklist: s.checklist.map((item, i) => (i === idx ? val : item)) }
          : s
      )
    );
  };

  const removeChecklistItem = (stratId: string, idx: number) => {
    updateStrategies(
      strategies.map((s) =>
        s.id === stratId
          ? { ...s, checklist: s.checklist.filter((_, i) => i !== idx) }
          : s
      )
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = strategies.findIndex((s) => s.id === active.id);
      const newIndex = strategies.findIndex((s) => s.id === over.id);
      updateStrategies(arrayMove(strategies, oldIndex, newIndex));
    }
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategies: strategiesJson }),
    });
    setSaving(false);
    setSaved(true);
    resetBaseline();
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" /> Trade Strategies &amp; Checklists
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-500 mt-1">
            Define custom checklists for different trading strategies.
          </p>
        </div>
        <button
          onClick={addStrategy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-3.5 h-3.5" /> Add Strategy
        </button>
      </div>

      <div className="space-y-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={strategies.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {strategies.map((strat) => (
              <SortableStrategy
                key={strat.id}
                strat={strat}
                isCollapsed={!expandedStrategies.has(strat.id)}
                toggleCollapse={() =>
                  setExpandedStrategies((prev) => {
                    const next = new Set(prev);
                    if (next.has(strat.id)) next.delete(strat.id);
                    else next.add(strat.id);
                    return next;
                  })
                }
                updateStrategyName={updateStrategyName}
                removeStrategy={removeStrategy}
                addChecklistItem={addChecklistItem}
                updateChecklistItem={updateChecklistItem}
                removeChecklistItem={removeChecklistItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Strategies"}
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
