"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Filter, Calendar, Tag, Users, Bookmark, ChevronDown, Check } from "lucide-react";
import { TradeFilterState, Trade, Account, MistakeType } from "@/lib/types";

interface TradeFilterBarProps {
  filter: TradeFilterState;
  onFilterChange: (partial: Partial<TradeFilterState>) => void;
  allTrades: Trade[];
  accounts: Account[];
  activeAccountId: string | null;
  isGuest: boolean;
}

const FILTER_BTN = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active
      ? "bg-emerald-500/20 text-emerald-400"
      : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50"
  }`;

export default function TradeFilterBar({
  filter,
  onFilterChange,
  allTrades,
  accounts,
  activeAccountId,
  isGuest,
}: TradeFilterBarProps) {
  // --- Tags dropdown ---
  const [showTagsMenu, setShowTagsMenu] = useState(false);
  const tagsMenuRef = useRef<HTMLDivElement>(null);

  // --- Mistakes dropdown ---
  const [showMistakesMenu, setShowMistakesMenu] = useState(false);
  const mistakesMenuRef = useRef<HTMLDivElement>(null);
  const [mistakeTypes, setMistakeTypes] = useState<MistakeType[]>([]);

  // --- Account dropdown ---
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Derive distinct tags from allTrades
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTrades.forEach((t) => {
      if (t.tags) {
        t.tags.split(",").forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [allTrades]);

  // Fetch mistake types on mount
  useEffect(() => {
    fetch("/api/mistakes")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setMistakeTypes(data);
      })
      .catch(() => {});
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showTagsMenu) return;
    const handler = (e: MouseEvent) => {
      if (tagsMenuRef.current && !tagsMenuRef.current.contains(e.target as Node)) {
        setShowTagsMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTagsMenu]);

  useEffect(() => {
    if (!showMistakesMenu) return;
    const handler = (e: MouseEvent) => {
      if (mistakesMenuRef.current && !mistakesMenuRef.current.contains(e.target as Node)) {
        setShowMistakesMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMistakesMenu]);

  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAccountMenu]);

  // Quick presets
  const applyThisWeek = () => {
    const today = new Date();
    const day = today.getDay();
    // Monday start: (day + 6) % 7 gives 0 for Mon, 6 for Sun
    const daysFromMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    onFilterChange({ dateFrom: fmt(monday), dateTo: fmt(sunday) });
  };

  const applyThisMonth = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    onFilterChange({ dateFrom: fmt(first), dateTo: fmt(last) });
  };

  const selectedAccountName =
    filter.accountId
      ? accounts.find((a) => a.id === filter.accountId)?.name ?? "Account"
      : "All";

  const selectedMistakeName =
    filter.mistakeId
      ? mistakeTypes.find((m) => m.id === filter.mistakeId)?.name ?? "Mistake"
      : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Symbol search */}
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-400 text-slate-500" />
        <input
          type="text"
          value={filter.symbol}
          onChange={(e) => onFilterChange({ symbol: e.target.value.toUpperCase() })}
          placeholder="Filter by symbol"
          className="w-full pl-9 pr-3 py-1.5 h-9 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 h-9">
        <Filter className="w-4 h-4 dark:text-slate-500 text-slate-400" />
        {(["all", "planned", "open", "closed"] as TradeFilterState["status"][]).map((s) => (
          <button key={s} onClick={() => onFilterChange({ status: s })} className={FILTER_BTN(filter.status === s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Direction filter */}
      <div className="flex items-center gap-1.5 h-9">
        {(["all", "long", "short"] as TradeFilterState["direction"][]).map((d) => (
          <button key={d} onClick={() => onFilterChange({ direction: d })} className={FILTER_BTN(filter.direction === d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* Date range inputs */}
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 dark:text-slate-500 text-slate-400 shrink-0" />
        <input
          type="date"
          value={filter.dateFrom ?? ""}
          onChange={(e) => onFilterChange({ dateFrom: e.target.value || null })}
          className="h-9 px-3 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]"
          title="From date"
        />
        <span className="text-sm dark:text-slate-500 text-slate-400">to</span>
        <input
          type="date"
          value={filter.dateTo ?? ""}
          onChange={(e) => onFilterChange({ dateTo: e.target.value || null })}
          className="h-9 px-3 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark]"
          title="To date"
        />
      </div>

      {/* Tags multi-select dropdown */}
      {allTags.length > 0 && (
        <div className="relative" ref={tagsMenuRef}>
          <button
            onClick={() => setShowTagsMenu((p) => !p)}
            className={FILTER_BTN(filter.tags.length > 0 || showTagsMenu)}
          >
            <span className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              Tags
              {filter.tags.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/30 text-emerald-300">
                  {filter.tags.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          </button>
          {showTagsMenu && (
            <div className="absolute left-0 top-full mt-2 z-50 min-w-[160px] rounded-lg dark:bg-slate-800 bg-white shadow-xl py-2">
              {allTags.map((tag) => {
                const selected = filter.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const next = selected
                        ? filter.tags.filter((t) => t !== tag)
                        : [...filter.tags, tag];
                      onFilterChange({ tags: next });
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"}`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    {tag}
                  </button>
                );
              })}
              {filter.tags.length > 0 && (
                <div className="border-t dark:border-slate-700 border-slate-200 mt-1.5 pt-1.5 px-3">
                  <button
                    onClick={() => onFilterChange({ tags: [] })}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Clear tags
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mistake type dropdown (placeholder — filtering deferred to Phase 22) */}
      <div className="relative" ref={mistakesMenuRef}>
        <button
          onClick={() => setShowMistakesMenu((p) => !p)}
          className={FILTER_BTN(filter.mistakeId !== null || showMistakesMenu)}
        >
          <span className="flex items-center gap-1.5">
            <Bookmark className="w-4 h-4" />
            {selectedMistakeName ? selectedMistakeName : "Mistakes"}
            <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </button>
        {showMistakesMenu && (
          <div className="absolute left-0 top-full mt-2 z-50 min-w-[180px] rounded-lg dark:bg-slate-800 bg-white shadow-xl py-2">
            <button
              onClick={() => { onFilterChange({ mistakeId: null }); setShowMistakesMenu(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${filter.mistakeId === null ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"}`}>
                {filter.mistakeId === null && <Check className="w-3 h-3 text-white" />}
              </span>
              All
            </button>
            {mistakeTypes.length === 0 && (
              <p className="px-3 py-2 text-xs dark:text-slate-500 text-slate-400">No mistake types yet</p>
            )}
            {mistakeTypes.map((m) => (
              <button
                key={m.id}
                onClick={() => { onFilterChange({ mistakeId: m.id }); setShowMistakesMenu(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${filter.mistakeId === m.id ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"}`}>
                  {filter.mistakeId === m.id && <Check className="w-3 h-3 text-white" />}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Account filter (only in All Accounts mode) */}
      {activeAccountId === null && accounts.length > 1 && (
        <div className="relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu((p) => !p)}
            className={FILTER_BTN(filter.accountId !== null || showAccountMenu)}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {selectedAccountName}
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          </button>
          {showAccountMenu && (
            <div className="absolute left-0 top-full mt-2 z-50 min-w-[180px] rounded-lg dark:bg-slate-800 bg-white shadow-xl py-2">
              <button
                onClick={() => { onFilterChange({ accountId: null }); setShowAccountMenu(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${filter.accountId === null ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"}`}>
                  {filter.accountId === null && <Check className="w-3 h-3 text-white" />}
                </span>
                All Accounts
              </button>
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onFilterChange({ accountId: a.id }); setShowAccountMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${filter.accountId === a.id ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"}`}>
                    {filter.accountId === a.id && <Check className="w-3 h-3 text-white" />}
                  </span>
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick preset buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onFilterChange({ pnlFilter: filter.pnlFilter === "winners" ? "all" : "winners" })}
          className={FILTER_BTN(filter.pnlFilter === "winners")}
        >
          Winners
        </button>
        <button
          onClick={() => onFilterChange({ pnlFilter: filter.pnlFilter === "losers" ? "all" : "losers" })}
          className={FILTER_BTN(filter.pnlFilter === "losers")}
        >
          Losers
        </button>
        <button
          onClick={applyThisWeek}
          className={FILTER_BTN(false)}
        >
          This Week
        </button>
        <button
          onClick={applyThisMonth}
          className={FILTER_BTN(false)}
        >
          This Month
        </button>
      </div>
    </div>
  );
}
