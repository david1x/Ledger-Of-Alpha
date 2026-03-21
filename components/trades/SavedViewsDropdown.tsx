"use client";
import { useState, useEffect, useRef } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { TradeFilterState, SavedView } from "@/lib/types";

interface SavedViewsDropdownProps {
  currentFilter: TradeFilterState;
  onLoadView: (filter: TradeFilterState) => void;
  isGuest: boolean;
  initialViews: SavedView[];
}

export default function SavedViewsDropdown({
  currentFilter,
  onLoadView,
  isGuest,
  initialViews,
}: SavedViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[]>(initialViews);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [viewName, setViewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when initialViews changes (e.g., on page load when settingsData arrives)
  useEffect(() => {
    setViews(initialViews);
  }, [initialViews]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowNameInput(false);
        setViewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const saveView = async (name: string) => {
    if (!name.trim()) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim(),
      filter: currentFilter,
      created_at: new Date().toISOString(),
    };
    const updated = [...views, view];
    setViews(updated);
    setShowNameInput(false);
    setViewName("");
    if (!isGuest) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_filter_views: JSON.stringify(updated) }),
      });
    }
  };

  const deleteView = async (id: string) => {
    const updated = views.filter(v => v.id !== id);
    setViews(updated);
    if (!isGuest) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_filter_views: JSON.stringify(updated) }),
      });
    }
  };

  const handleLoad = (view: SavedView) => {
    onLoadView(view.filter);
    setShowDropdown(false);
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setShowDropdown(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          showDropdown
            ? "bg-emerald-500/20 text-emerald-400"
            : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50"
        }`}
      >
        <Bookmark className="w-4 h-4" />
        <span>Views</span>
        {views.length > 0 && (
          <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            {views.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-lg dark:bg-slate-800 bg-white shadow-xl py-2">
          {views.length === 0 && !showNameInput && (
            <p className="px-3 py-2 text-sm dark:text-slate-400 text-slate-500">No saved views</p>
          )}

          {views.map(view => (
            <div
              key={view.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:dark:bg-slate-700/50 hover:bg-slate-50"
            >
              <button
                onClick={() => handleLoad(view)}
                className="flex-1 text-left min-w-0"
              >
                <span className="block text-sm dark:text-slate-200 text-slate-700 truncate">{view.name}</span>
                <span className="block text-[11px] dark:text-slate-500 text-slate-400">{formatDate(view.created_at)}</span>
              </button>
              <button
                onClick={() => deleteView(view.id)}
                className="shrink-0 text-red-400 hover:text-red-300 transition-colors p-0.5 rounded"
                title="Delete view"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="border-t dark:border-slate-700 border-slate-200 mt-1.5 pt-1.5 px-3">
            {showNameInput ? (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveView(viewName);
                    if (e.key === "Escape") { setShowNameInput(false); setViewName(""); }
                  }}
                  placeholder="View name..."
                  autoFocus
                  className="w-full px-2 py-1 text-sm rounded dark:bg-slate-700 bg-slate-100 dark:text-slate-200 text-slate-800 dark:placeholder-slate-500 placeholder-slate-400 border dark:border-slate-600 border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => saveView(viewName)}
                    disabled={!viewName.trim()}
                    className="flex-1 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowNameInput(false); setViewName(""); }}
                    className="px-2 py-1 text-xs rounded dark:bg-slate-700 bg-slate-100 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNameInput(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors py-0.5"
              >
                Save current filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
