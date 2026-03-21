"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { Search, Calendar, Tag, Users, Bookmark, ChevronDown, Check, X } from "lucide-react";
import { TradeFilterState, Trade, Account, MistakeType } from "@/lib/types";

interface TradeFilterBarProps {
  filter: TradeFilterState;
  onFilterChange: (partial: Partial<TradeFilterState>) => void;
  allTrades: Trade[];
  accounts: Account[];
  activeAccountId: string | null;
  isGuest: boolean;
}

// DROPDOWN_BTN — uniform h-9 button style for all filter controls
const DROPDOWN_BTN = (active: boolean) =>
  `h-9 px-3 flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
    active
      ? "bg-emerald-500/20 text-emerald-400"
      : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-200/60 dark:bg-slate-800/40 bg-slate-200/40"
  }`;

// Shared dropdown panel class
const PANEL_CLS =
  "absolute left-0 top-full mt-1 z-50 rounded-md dark:bg-slate-800 bg-white shadow-xl border dark:border-slate-700 border-slate-200 py-1";

// Shared option row for single-select radio-style items
function RadioOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
    >
      <span
        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
          selected ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TradeFilterBar({
  filter,
  onFilterChange,
  allTrades,
  accounts,
  activeAccountId,
}: TradeFilterBarProps) {
  // --- Unified dropdown state ---
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpenDropdown((prev) => (prev === key ? null : key));

  // --- Symbol search state ---
  const [symbolSearch, setSymbolSearch] = useState("");

  // --- Mistake types ---
  const [mistakeTypes, setMistakeTypes] = useState<MistakeType[]>([]);

  // --- Dropdown refs ---
  const dropdownRefs = {
    symbol: useRef<HTMLDivElement>(null),
    status: useRef<HTMLDivElement>(null),
    direction: useRef<HTMLDivElement>(null),
    date: useRef<HTMLDivElement>(null),
    pnl: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
    mistakes: useRef<HTMLDivElement>(null),
    account: useRef<HTMLDivElement>(null),
  };

  // Close open dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const ref = dropdownRefs[openDropdown as keyof typeof dropdownRefs];
      if (ref?.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  // Derive all symbols from allTrades
  const allSymbols = useMemo(() => {
    const set = new Set<string>();
    allTrades.forEach((t) => {
      if (t.symbol) set.add(t.symbol.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allTrades]);

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
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMistakeTypes(data);
      })
      .catch(() => {});
  }, []);

  // Quick presets
  const applyThisWeek = () => {
    const today = new Date();
    const day = today.getDay();
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

  // --- Symbol button label ---
  const symbolLabel = () => {
    if (!filter.symbols || filter.symbols.length === 0) return "Symbol";
    if (filter.symbols.length <= 2) return filter.symbols.join(", ");
    return `${filter.symbols.length} symbols`;
  };
  const symbolActive = filter.symbols && filter.symbols.length > 0;

  // Filtered symbol list for the search input
  const filteredSymbols = symbolSearch
    ? allSymbols.filter((s) => s.includes(symbolSearch.toUpperCase()))
    : allSymbols;

  const toggleSymbol = (sym: string) => {
    const current = filter.symbols ?? [];
    const next = current.includes(sym)
      ? current.filter((s) => s !== sym)
      : [...current, sym];
    onFilterChange({ symbols: next, symbol: "" });
  };

  // --- Status / Direction / PnL labels ---
  const statusActive = filter.status !== "all";
  const directionActive = filter.direction !== "all";
  const pnlActive = filter.pnlFilter !== "all";
  const dateActive = filter.dateFrom !== null || filter.dateTo !== null;

  const dateLabel = () => {
    if (filter.dateFrom && filter.dateTo) return `${filter.dateFrom} – ${filter.dateTo}`;
    if (filter.dateFrom) return `From ${filter.dateFrom}`;
    if (filter.dateTo) return `To ${filter.dateTo}`;
    return "Date";
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
    <div className="dark:bg-slate-900/80 bg-slate-100 rounded-lg px-3 py-2 border dark:border-slate-800/60 border-slate-200/80">
      <div className="flex flex-wrap items-center gap-2">

        {/* Symbol multi-select dropdown */}
        <div className="relative" ref={dropdownRefs.symbol}>
          <button
            onClick={() => { toggle("symbol"); setSymbolSearch(""); }}
            className={DROPDOWN_BTN(symbolActive || openDropdown === "symbol")}
          >
            <Search className="w-4 h-4" />
            <span>{symbolLabel()}</span>
            {symbolActive && (
              <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/30 text-emerald-300">
                {filter.symbols!.length}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
            {symbolActive && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterChange({ symbols: [] });
                  setOpenDropdown(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onFilterChange({ symbols: [] });
                    setOpenDropdown(null);
                  }
                }}
                className="ml-1 hover:text-white transition-colors"
                aria-label="Clear symbol filter"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
          {openDropdown === "symbol" && (
            <div className={`${PANEL_CLS} w-52`}>
              <div className="px-2 pb-1">
                <input
                  autoFocus
                  type="text"
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  placeholder="Search symbols..."
                  className="w-full px-2 py-1.5 text-sm rounded dark:bg-slate-700 bg-slate-100 dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSymbols.length === 0 && (
                  <p className="px-3 py-2 text-xs dark:text-slate-500 text-slate-400">No symbols</p>
                )}
                {filteredSymbols.map((sym) => {
                  const selected = (filter.symbols ?? []).includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => toggleSymbol(sym)}
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {sym}
                    </button>
                  );
                })}
              </div>
              {(filter.symbols ?? []).length > 0 && (
                <div className="border-t dark:border-slate-700 border-slate-200 mt-1 pt-1 px-3">
                  <button
                    onClick={() => onFilterChange({ symbols: [] })}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status dropdown */}
        <div className="relative" ref={dropdownRefs.status}>
          <button
            onClick={() => toggle("status")}
            className={DROPDOWN_BTN(statusActive || openDropdown === "status")}
          >
            <span>{statusActive ? capitalize(filter.status) : "Status"}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {openDropdown === "status" && (
            <div className={`${PANEL_CLS} min-w-[140px]`}>
              {(["all", "planned", "open", "closed"] as TradeFilterState["status"][]).map((s) => (
                <RadioOption
                  key={s}
                  label={capitalize(s)}
                  selected={filter.status === s}
                  onClick={() => { onFilterChange({ status: s }); setOpenDropdown(null); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Direction dropdown */}
        <div className="relative" ref={dropdownRefs.direction}>
          <button
            onClick={() => toggle("direction")}
            className={DROPDOWN_BTN(directionActive || openDropdown === "direction")}
          >
            <span>{directionActive ? capitalize(filter.direction) : "Direction"}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {openDropdown === "direction" && (
            <div className={`${PANEL_CLS} min-w-[130px]`}>
              {(["all", "long", "short"] as TradeFilterState["direction"][]).map((d) => (
                <RadioOption
                  key={d}
                  label={capitalize(d)}
                  selected={filter.direction === d}
                  onClick={() => { onFilterChange({ direction: d }); setOpenDropdown(null); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* P&L dropdown */}
        <div className="relative" ref={dropdownRefs.pnl}>
          <button
            onClick={() => toggle("pnl")}
            className={DROPDOWN_BTN(pnlActive || openDropdown === "pnl")}
          >
            <span>{pnlActive ? capitalize(filter.pnlFilter) : "P&L"}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {openDropdown === "pnl" && (
            <div className={`${PANEL_CLS} min-w-[130px]`}>
              {(["all", "winners", "losers"] as TradeFilterState["pnlFilter"][]).map((p) => (
                <RadioOption
                  key={p}
                  label={capitalize(p)}
                  selected={filter.pnlFilter === p}
                  onClick={() => { onFilterChange({ pnlFilter: p }); setOpenDropdown(null); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Date dropdown */}
        <div className="relative" ref={dropdownRefs.date}>
          <button
            onClick={() => toggle("date")}
            className={DROPDOWN_BTN(dateActive || openDropdown === "date")}
          >
            <Calendar className="w-4 h-4" />
            <span className="max-w-[160px] truncate">{dateLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {openDropdown === "date" && (
            <div className={`${PANEL_CLS} w-64 px-3 py-2 space-y-2`}>
              <div className="space-y-1.5">
                <label className="text-xs dark:text-slate-400 text-slate-500 font-medium">From</label>
                <input
                  type="date"
                  value={filter.dateFrom ?? ""}
                  onChange={(e) => onFilterChange({ dateFrom: e.target.value || null })}
                  className="w-full h-8 px-2 text-sm rounded dark:bg-slate-700 bg-slate-50 dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:[color-scheme:dark]"
                  title="From date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs dark:text-slate-400 text-slate-500 font-medium">To</label>
                <input
                  type="date"
                  value={filter.dateTo ?? ""}
                  onChange={(e) => onFilterChange({ dateTo: e.target.value || null })}
                  className="w-full h-8 px-2 text-sm rounded dark:bg-slate-700 bg-slate-50 dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:[color-scheme:dark]"
                  title="To date"
                />
              </div>
              <div className="flex items-center gap-2 pt-1 border-t dark:border-slate-700 border-slate-200">
                <button
                  onClick={() => { applyThisWeek(); setOpenDropdown(null); }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  This Week
                </button>
                <span className="dark:text-slate-600 text-slate-300">·</span>
                <button
                  onClick={() => { applyThisMonth(); setOpenDropdown(null); }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  This Month
                </button>
                {dateActive && (
                  <>
                    <span className="dark:text-slate-600 text-slate-300">·</span>
                    <button
                      onClick={() => { onFilterChange({ dateFrom: null, dateTo: null }); setOpenDropdown(null); }}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Clear dates
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tags multi-select dropdown */}
        {allTags.length > 0 && (
          <div className="relative" ref={dropdownRefs.tags}>
            <button
              onClick={() => toggle("tags")}
              className={DROPDOWN_BTN(filter.tags.length > 0 || openDropdown === "tags")}
            >
              <Tag className="w-4 h-4" />
              <span>Tags</span>
              {filter.tags.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/30 text-emerald-300">
                  {filter.tags.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openDropdown === "tags" && (
              <div className={`${PANEL_CLS} min-w-[160px]`}>
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
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {tag}
                    </button>
                  );
                })}
                {filter.tags.length > 0 && (
                  <div className="border-t dark:border-slate-700 border-slate-200 mt-1 pt-1 px-3">
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

        {/* Mistakes dropdown */}
        <div className="relative" ref={dropdownRefs.mistakes}>
          <button
            onClick={() => toggle("mistakes")}
            className={DROPDOWN_BTN(filter.mistakeId !== null || openDropdown === "mistakes")}
          >
            <Bookmark className="w-4 h-4" />
            <span>{selectedMistakeName ?? "Mistakes"}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {openDropdown === "mistakes" && (
            <div className={`${PANEL_CLS} min-w-[180px]`}>
              <button
                onClick={() => { onFilterChange({ mistakeId: null }); setOpenDropdown(null); }}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    filter.mistakeId === null ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                  }`}
                >
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
                  onClick={() => { onFilterChange({ mistakeId: m.id }); setOpenDropdown(null); }}
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      filter.mistakeId === m.id ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                    }`}
                  >
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
          <div className="relative" ref={dropdownRefs.account}>
            <button
              onClick={() => toggle("account")}
              className={DROPDOWN_BTN(filter.accountId !== null || openDropdown === "account")}
            >
              <Users className="w-4 h-4" />
              <span>{selectedAccountName}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openDropdown === "account" && (
              <div className={`${PANEL_CLS} min-w-[180px]`}>
                <button
                  onClick={() => { onFilterChange({ accountId: null }); setOpenDropdown(null); }}
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      filter.accountId === null ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                    }`}
                  >
                    {filter.accountId === null && <Check className="w-3 h-3 text-white" />}
                  </span>
                  All Accounts
                </button>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { onFilterChange({ accountId: a.id }); setOpenDropdown(null); }}
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        filter.accountId === a.id ? "bg-emerald-500 border-emerald-500" : "dark:border-slate-600 border-slate-300"
                      }`}
                    >
                      {filter.accountId === a.id && <Check className="w-3 h-3 text-white" />}
                    </span>
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
