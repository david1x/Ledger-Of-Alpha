"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Camera, Send, CheckCircle, AlertCircle, Plus, X, ExternalLink, Link, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Trash2, Pencil, List, Download, Upload, MoreHorizontal, GripVertical, FolderPlus } from "lucide-react";
import RiskCalculator from "@/components/RiskCalculator";
import PositionSizer from "@/components/PositionSizer";
import SetupChart, { type SetupChartHandle } from "@/components/SetupChart";
import SymbolSearch from "@/components/SymbolSearch";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TradingViewWidget = dynamic(() => import("@/components/TradingViewWidget"), { ssr: false });

const INTERVALS = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

interface Tab { id: string; label: string; interval: string; symbol?: string; }
interface WatchlistSymbol { symbol: string; name: string; }
interface WatchlistSector { type: "sector"; id: string; name: string; collapsed: boolean; }
type WatchlistItem = WatchlistSymbol | WatchlistSector;
function isSector(item: WatchlistItem): item is WatchlistSector { return "type" in item && item.type === "sector"; }
function itemId(item: WatchlistItem): string { return isSector(item) ? `sector-${item.id}` : item.symbol; }

interface Watchlist { id: string; name: string; items: WatchlistItem[]; }

// Backwards compat: migrate old format
interface LegacyWatchlist { id: string; name: string; symbols?: WatchlistSymbol[]; items?: WatchlistItem[]; }
function migrateWatchlist(w: LegacyWatchlist): Watchlist {
  if (w.items) return w as Watchlist;
  return { id: w.id, name: w.name, items: w.symbols ?? [] };
}

const DEFAULT_TABS: Tab[] = [{ id: "1", label: "Chart 1", interval: "D" }];
const DEFAULT_WATCHLISTS: Watchlist[] = [{ id: "1", name: "Watchlist 1", items: [] }];

const EMPTY_FORM = {
  symbol: "", direction: "long" as "long" | "short",
  status: "planned" as "planned" | "open" | "closed",
  entry_price: "", stop_loss: "", take_profit: "", shares: "", notes: "",
  commission: "", risk_percent: "",
};

// ── Sortable row components ──────────────────────────────────────────────────

function SortableSymbolRow({ item, onSelect, onRemove, hidden: isHidden }: {
  item: WatchlistSymbol; onSelect: (s: string) => void; onRemove: (s: string) => void; hidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.symbol });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-2 py-1.5 cursor-pointer hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors group ${isHidden ? "hidden" : ""}`}
      onClick={() => onSelect(item.symbol)}
    >
      <div className="flex items-center gap-1 min-w-0">
        <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing dark:text-slate-600 text-slate-300 hover:dark:text-slate-400 hover:text-slate-500 shrink-0" onClick={e => e.stopPropagation()}>
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="min-w-0">
          <div className="text-xs font-semibold dark:text-white text-slate-900">{item.symbol}</div>
          <div className="text-[10px] dark:text-slate-400 text-slate-500 truncate">{item.name}</div>
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove(item.symbol); }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 dark:text-slate-500 text-slate-400 transition-all shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function SortableSectorRow({ item, onToggle, onRename, onDelete, hidden: isHidden }: {
  item: WatchlistSector; onToggle: () => void; onRename: (name: string) => void; onDelete: () => void; hidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sector-${item.id}` });
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(item.name);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const commit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== item.name) onRename(trimmed);
    setEditing(false);
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 px-2 py-1.5 dark:bg-slate-800/50 bg-slate-100/50 border-b dark:border-slate-700/50 border-slate-200/50 group ${isHidden ? "hidden" : ""}`}
    >
      <button {...attributes} {...listeners} className="p-0.5 cursor-grab active:cursor-grabbing dark:text-slate-600 text-slate-300 hover:dark:text-slate-400 hover:text-slate-500 shrink-0" onClick={e => e.stopPropagation()}>
        <GripVertical className="w-3 h-3" />
      </button>
      <button onClick={onToggle} className="p-0.5 dark:text-slate-400 text-slate-500 shrink-0">
        <ChevronDown className={`w-3 h-3 transition-transform ${item.collapsed ? "-rotate-90" : ""}`} />
      </button>
      {editing ? (
        <input
          autoFocus
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="flex-1 min-w-0 px-1 py-0.5 text-xs font-bold rounded border dark:border-slate-600 border-slate-300 dark:bg-slate-700 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          onDoubleClick={() => { setNameInput(item.name); setEditing(true); }}
          className="flex-1 text-xs font-bold dark:text-slate-300 text-slate-700 truncate cursor-default select-none"
        >
          {item.name}
        </span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 dark:text-slate-500 text-slate-400 transition-all shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

function buildSetupMessage(
  symbol: string, direction: string,
  entry: number, stop: number, target: number | null
): string {
  const dir = direction === "long" ? "\u{1F4C8} LONG" : "\u{1F4C9} SHORT";
  const riskPct = ((Math.abs(entry - stop) / entry) * 100).toFixed(1);
  const lines = [
    `\u{1F4CA} **${symbol} ${dir}**`,
    `Entry $${entry.toFixed(2)} \u00B7 Stop $${stop.toFixed(2)} (${riskPct}% risk)`,
  ];
  if (target) {
    const rr = (Math.abs(target - entry) / Math.abs(entry - stop)).toFixed(1);
    lines.push(`T/P $${target.toFixed(2)} \u00B7 R:R 1:${rr}`);
  }
  return lines.join("\n");
}

export default function PersistentChart() {
  const pathname = usePathname();
  const isChart = pathname === "/chart";

  const nextId = useRef(2);
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [activeId, setActiveId] = useState("1");
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  // Discord
  const [discordMode, setDiscordMode] = useState<"capture" | "link">("capture");
  const [message, setMessage] = useState("");
  const [tvLink, setTvLink] = useState("");
  const [discordStatus, setDiscordStatus] = useState<"idle" | "capturing" | "sending" | "success" | "error">("idle");
  const [discordMsg, setDiscordMsg] = useState("");
  const [countdown, setCountdown] = useState<null | 3 | 2 | 1>(null);

  // Quick-add trade panel — open by default on desktop, closed on mobile
  const [showPanel, setShowPanel] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [commission, setCommission] = useState(0);

  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const resetActiveTab = () => setResetKeys(prev => ({ ...prev, [activeId]: (prev[activeId] ?? 0) + 1 }));

  // Watchlist
  const nextWlId = useRef(2);
  const nextSectorId = useRef(1);
  const [watchlists, setWatchlists] = useState<Watchlist[]>(DEFAULT_WATCHLISTS);
  const [activeWlId, setActiveWlId] = useState("1");
  const [showWatchlist, setShowWatchlist] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );
  const [editingWlName, setEditingWlName] = useState(false);
  const [wlNameInput, setWlNameInput] = useState("");
  const [wlSearch, setWlSearch] = useState("");
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const wlFileInputRef = useRef<HTMLInputElement>(null);
  const [wlToolbarExpanded, setWlToolbarExpanded] = useState(false);
  const [wlFilter, setWlFilter] = useState("");
  const [wlWidth, setWlWidth] = useState(220);
  const [panelWidth, setPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const setupChartRef = useRef<SetupChartHandle>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Separate save timers to avoid cancellation bugs
  const saveTabsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveWlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  // dnd-kit sensor
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Load settings + tabs ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.account_size) setAccountSize(parseFloat(data.account_size));
        if (data.risk_per_trade) setRiskPercent(parseFloat(data.risk_per_trade));
        if (data.commission_per_trade) setCommission(parseFloat(data.commission_per_trade));
        if (data.chart_tabs) {
          try {
            const saved: Tab[] = JSON.parse(data.chart_tabs);
            if (Array.isArray(saved) && saved.length > 0) {
              const maxId = Math.max(...saved.map(t => parseInt(t.id) || 0));
              nextId.current = maxId + 1;
              setTabs(saved);
              setActiveId(saved[0].id);
            }
          } catch { /* ignore */ }
        }
        if (data.watchlists) {
          try {
            const saved: LegacyWatchlist[] = JSON.parse(data.watchlists);
            if (Array.isArray(saved) && saved.length > 0) {
              const migrated = saved.map(migrateWatchlist);
              const maxId = Math.max(...migrated.map(w => parseInt(w.id) || 0));
              nextWlId.current = maxId + 1;
              // Compute max sector id
              let maxSectorId = 0;
              for (const wl of migrated) {
                for (const item of wl.items) {
                  if (isSector(item)) {
                    const sid = parseInt(item.id) || 0;
                    if (sid > maxSectorId) maxSectorId = sid;
                  }
                }
              }
              nextSectorId.current = maxSectorId + 1;
              setWatchlists(migrated);
              setActiveWlId(migrated[0].id);
            }
          } catch { /* ignore */ }
        }
        if (data.watchlist_width) {
          const w = parseInt(data.watchlist_width);
          if (w >= 160 && w <= 400) setWlWidth(w);
        }
        if (data.panel_width) {
          const w = parseInt(data.panel_width);
          if (w >= 300 && w <= 600) setPanelWidth(w);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);


  // ── Tab save ─────────────────────────────────────────────────────────────
  const saveTabs = useCallback((newTabs: Tab[]) => {
    if (saveTabsTimer.current) clearTimeout(saveTabsTimer.current);
    saveTabsTimer.current = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chart_tabs: JSON.stringify(newTabs) }),
      }).catch(() => {});
    }, 600);
  }, []);

  const saveWatchlists = useCallback((next: Watchlist[]) => {
    if (saveWlTimer.current) clearTimeout(saveWlTimer.current);
    saveWlTimer.current = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlists: JSON.stringify(next) }),
      }).catch(() => {});
    }, 600);
  }, []);

  const saveWlWidth = useCallback((w: number) => {
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist_width: String(w) }),
    }).catch(() => {});
  }, []);

  const savePanelWidth = useCallback((w: number) => {
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panel_width: String(w) }),
    }).catch(() => {});
  }, []);

  const addTab = () => {
    const id = String(nextId.current++);
    const next = [...tabs, { id, label: `Chart ${id}`, interval: "D" }];
    setTabs(next); setActiveId(id); saveTabs(next);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1].id);
      saveTabs(next);
      return next;
    });
  };

  const setActiveInterval = (val: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === activeId ? { ...t, interval: val } : t);
      saveTabs(next);
      return next;
    });
  };

  // ── Watchlist helpers ─────────────────────────────────────────────────────
  const activeWatchlist = watchlists.find(w => w.id === activeWlId) ?? watchlists[0];

  const addToWatchlist = (symbol: string, name: string) => {
    setWatchlists(prev => {
      const wl = prev.find(w => w.id === activeWlId);
      if (wl?.items.some(s => !isSector(s) && s.symbol === symbol)) return prev;
      const next = prev.map(w =>
        w.id === activeWlId ? { ...w, items: [...w.items, { symbol, name }] } : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlists(prev => {
      const next = prev.map(w =>
        w.id === activeWlId ? { ...w, items: w.items.filter(s => isSector(s) || s.symbol !== symbol) } : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  const createWatchlist = () => {
    const id = String(nextWlId.current++);
    const next = [...watchlists, { id, name: `Watchlist ${id}`, items: [] }];
    setWatchlists(next); setActiveWlId(id); saveWatchlists(next);
  };

  const deleteActiveWatchlist = () => {
    if (watchlists.length === 1) return;
    const next = watchlists.filter(w => w.id !== activeWlId);
    setWatchlists(next); setActiveWlId(next[0].id); saveWatchlists(next);
  };

  const commitWlRename = () => {
    const trimmed = wlNameInput.trim();
    if (trimmed) {
      const next = watchlists.map(w => w.id === activeWlId ? { ...w, name: trimmed } : w);
      setWatchlists(next); saveWatchlists(next);
    }
    setEditingWlName(false);
  };

  const exportWatchlist = () => {
    const symbols = activeWatchlist.items.filter((s): s is WatchlistSymbol => !isSector(s)).map(s => s.symbol).join(", ");
    const blob = new Blob([symbols], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeWatchlist.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBulkSymbols = (text: string) => {
    const symbols = text
      .split(/[,\n]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0 && s.length <= 20);
    if (symbols.length === 0) return;

    setWatchlists(prev => {
      const wl = prev.find(w => w.id === activeWlId);
      if (!wl) return prev;
      const existing = new Set(wl.items.filter((s): s is WatchlistSymbol => !isSector(s)).map(s => s.symbol));
      const toAdd = symbols.filter(s => !existing.has(s));
      if (toAdd.length === 0) return prev;
      const next = prev.map(w =>
        w.id === activeWlId
          ? { ...w, items: [...w.items, ...toAdd.map(s => ({ symbol: s, name: s }))] }
          : w
      );
      saveWatchlists(next);
      return next;
    });
    setBulkInput("");
    setShowBulkImport(false);
  };

  const handleWlFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    importBulkSymbols(text);
  };

  // ── Sector helpers ──────────────────────────────────────────────────────
  const addSector = () => {
    const id = String(nextSectorId.current++);
    setWatchlists(prev => {
      const next = prev.map(w =>
        w.id === activeWlId ? { ...w, items: [{ type: "sector" as const, id, name: "New Sector", collapsed: false }, ...w.items] } : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  const toggleSectorCollapse = (sectorId: string) => {
    setWatchlists(prev => {
      const next = prev.map(w =>
        w.id === activeWlId
          ? { ...w, items: w.items.map(item => isSector(item) && item.id === sectorId ? { ...item, collapsed: !item.collapsed } : item) }
          : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  const renameSector = (sectorId: string, name: string) => {
    setWatchlists(prev => {
      const next = prev.map(w =>
        w.id === activeWlId
          ? { ...w, items: w.items.map(item => isSector(item) && item.id === sectorId ? { ...item, name } : item) }
          : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  const deleteSector = (sectorId: string) => {
    setWatchlists(prev => {
      const next = prev.map(w =>
        w.id === activeWlId
          ? { ...w, items: w.items.filter(item => !(isSector(item) && item.id === sectorId)) }
          : w
      );
      saveWatchlists(next);
      return next;
    });
  };

  // ── Visible items (handles sector collapse + filter) ──────────────────
  const visibleItems = useMemo(() => {
    const items = activeWatchlist.items;
    const filterLower = wlFilter.toLowerCase().trim();

    // Track which items are hidden
    const hidden = new Set<number>();
    let currentSectorCollapsed = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (isSector(item)) {
        currentSectorCollapsed = item.collapsed;
        // Filter sectors by name if filtering
        if (filterLower && !item.name.toLowerCase().includes(filterLower)) {
          hidden.add(i);
        }
      } else {
        // Hide if sector is collapsed
        if (currentSectorCollapsed) hidden.add(i);
        // Hide if doesn't match filter
        if (filterLower && !item.symbol.toLowerCase().includes(filterLower) && !item.name.toLowerCase().includes(filterLower)) {
          hidden.add(i);
        }
      }
    }

    return items.map((item, i) => ({ item, hidden: hidden.has(i) }));
  }, [activeWatchlist.items, wlFilter]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = activeWatchlist.items;
    const oldIndex = items.findIndex(item => itemId(item) === active.id);
    const newIndex = items.findIndex(item => itemId(item) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const next = watchlists.map(w =>
      w.id === activeWlId ? { ...w, items: reordered } : w
    );
    setWatchlists(next);
    saveWatchlists(next);
  };

  // ── Generic resize helper (works over iframes via overlay) ──────────────
  const startResize = useCallback((e: React.MouseEvent, side: "left" | "right") => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === "left" ? wlWidth : panelWidth;
    const min = side === "left" ? 160 : 300;
    const max = side === "left" ? 400 : 600;
    // direction: for the watchlist (left), dragging right = wider; for trade panel (right), dragging left = wider
    const dir = side === "left" ? 1 : -1;

    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * dir;
      const newW = Math.max(min, Math.min(max, startWidth + delta));
      if (side === "left") setWlWidth(newW);
      else setPanelWidth(newW);
    };

    const onUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (side === "left") setWlWidth(w => { saveWlWidth(w); return w; });
      else setPanelWidth(w => { savePanelWidth(w); return w; });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [wlWidth, panelWidth, saveWlWidth, savePanelWidth]);

  const selectSymbol = (symbol: string) => {
    setField("symbol", symbol);
    setTabs(prev => {
      const next = prev.map(t => t.id === activeId ? { ...t, symbol } : t);
      saveTabs(next);
      return next;
    });
    setResetKeys(k => ({ ...k, [activeId]: (k[activeId] ?? 0) + 1 }));
  };

  const startRename = (tab: Tab, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingId(tab.id); setEditLabel(tab.label);
  };
  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editLabel.trim();
    if (trimmed) {
      setTabs(prev => {
        const next = prev.map(t => t.id === editingId ? { ...t, label: trimmed } : t);
        saveTabs(next); return next;
      });
    }
    setEditingId(null);
  };

  // ── Discord ───────────────────────────────────────────────────────────────
  const isTvLink = /tradingview\.com\/x\/[a-zA-Z0-9]+/i.test(tvLink);

  const resetDiscord = (delay = 3000) => {
    setTimeout(() => { setDiscordStatus("idle"); setDiscordMsg(""); }, delay);
  };

  const sendTvLink = async () => {
    if (!isTvLink) return;
    setDiscordStatus("sending");
    try {
      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotUrl: tvLink.trim(), message }),
      });
      if (res.ok) {
        setDiscordStatus("success"); setDiscordMsg("Sent!"); setTvLink(""); resetDiscord();
      } else {
        const d = await res.json();
        setDiscordStatus("error"); setDiscordMsg(d.error ?? "Failed."); resetDiscord();
      }
    } catch {
      setDiscordStatus("error"); setDiscordMsg("Network error."); resetDiscord();
    }
  };

  const captureAndSend = useCallback(async () => {
    if (!chartRef.current) return;
    setDiscordStatus("capturing"); setDiscordMsg("Grant screen access…");
    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices.getDisplayMedia as (
        opts: MediaStreamConstraints & { preferCurrentTab?: boolean }
      ) => Promise<MediaStream>)({ video: true, audio: false, preferCurrentTab: true });
    } catch (e: unknown) {
      setDiscordStatus("error");
      setDiscordMsg(e instanceof Error && e.name === "NotAllowedError" ? "Permission denied." : String(e));
      resetDiscord(); return;
    }
    const [track] = stream.getVideoTracks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageCapture = new (window as any).ImageCapture(track);
    await new Promise<void>(resolve => {
      setCountdown(3); let tick = 3;
      countdownRef.current = setInterval(() => {
        tick--;
        if (tick === 0) { clearInterval(countdownRef.current!); countdownRef.current = null; setCountdown(null); resolve(); }
        else setCountdown(tick as 3 | 2 | 1);
      }, 1000);
    });
    setDiscordMsg("Capturing…");
    try {
      const bitmap: ImageBitmap = await imageCapture.grabFrame();
      track.stop(); stream.getTracks().forEach(t => t.stop());
      const rect = chartRef.current!.getBoundingClientRect();
      const scaleX = bitmap.width / document.documentElement.clientWidth;
      const scaleY = bitmap.height / document.documentElement.clientHeight;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width * scaleX);
      canvas.height = Math.round(rect.height * scaleY);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap,
        Math.round(rect.left * scaleX), Math.round(rect.top * scaleY),
        Math.round(rect.width * scaleX), Math.round(rect.height * scaleY),
        0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/png");
      setDiscordStatus("sending"); setDiscordMsg("Sending…");
      const res = await fetch("/api/discord", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, message }),
      });
      if (res.ok) { setDiscordStatus("success"); setDiscordMsg("Sent!"); resetDiscord(); }
      else { const d = await res.json(); setDiscordStatus("error"); setDiscordMsg(d.error ?? "Failed."); resetDiscord(); }
    } catch (e: unknown) {
      track.stop(); stream.getTracks().forEach(t => t.stop());
      setDiscordStatus("error"); setDiscordMsg(String(e)); resetDiscord();
    }
  }, [message]);

  // ── Quick-add trade ───────────────────────────────────────────────────────
  const setField = (k: keyof typeof EMPTY_FORM, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submitTrade = async () => {
    if (!form.symbol.trim()) { setSaveError("Symbol required."); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          direction: form.direction,
          status: form.status,
          entry_price: form.entry_price ? parseFloat(form.entry_price) : null,
          stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
          take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
          shares: form.shares ? parseFloat(form.shares) : null,
          notes: form.notes || null,
          entry_date: new Date().toISOString().slice(0, 10),
          commission: form.commission ? parseFloat(form.commission) : commission || null,
          risk_per_trade: form.risk_percent ? parseFloat(form.risk_percent) : null,
        }),
      });
      if (res.ok) { setForm(EMPTY_FORM); setShowPanel(false); }
      else { const d = await res.json(); setSaveError(d.error ?? "Failed to save."); }
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  const saveAndShare = async () => {
    if (!form.symbol.trim()) { setSaveError("Symbol required."); return; }
    const entry = form.entry_price ? parseFloat(form.entry_price) : null;
    const stop = form.stop_loss ? parseFloat(form.stop_loss) : null;
    if (!entry || !stop) { setSaveError("Entry & stop required to share."); return; }

    setSaving(true); setSaveError(""); setShareStatus("sending");
    try {
      // 1. Save trade
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          direction: form.direction,
          status: "planned",
          entry_price: entry,
          stop_loss: stop,
          take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
          shares: form.shares ? parseFloat(form.shares) : null,
          commission: form.commission ? parseFloat(form.commission) : commission || null,
          risk_per_trade: form.risk_percent ? parseFloat(form.risk_percent) : null,
          notes: form.notes || null,
          entry_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Save failed.");
        setShareStatus("error");
        return;
      }

      // 2. Capture chart as PNG
      const imageData = setupChartRef.current?.captureImage() ?? null;

      // 3. Build message + post to Discord
      const target = form.take_profit ? parseFloat(form.take_profit) : null;
      const msg = buildSetupMessage(form.symbol.trim().toUpperCase(), form.direction, entry, stop, target);
      const dRes = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, message: msg }),
      });

      if (dRes.ok) {
        setShareStatus("done");
        setForm(EMPTY_FORM); setShowPanel(false);
      } else {
        const d = await dRes.json();
        setSaveError(`Saved! But Discord: ${d.error ?? "failed."}`);
        setShareStatus("error");
        setForm(EMPTY_FORM);
      }
    } catch { setSaveError("Network error."); setShareStatus("error"); }
    finally {
      setSaving(false);
      setTimeout(() => setShareStatus("idle"), 3000);
    }
  };

  // Don't render until settings are loaded (only happens once on first mount)
  if (!loaded) return null;

  const discordBusy = countdown !== null || discordStatus === "capturing" || discordStatus === "sending";

  const symbolCount = activeWatchlist.items.filter(s => !isSector(s)).length;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 flex-col"
      style={{ top: "56px", display: isChart ? "flex" : "none" }}
    >

      {/* Transparent overlay during resize to prevent iframes from stealing mouse events */}
      {isResizing && <div className="fixed inset-0 z-50" style={{ cursor: "col-resize" }} />}

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white shrink-0">
        <div className="flex items-center overflow-x-auto flex-1 min-w-0">
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveId(tab.id)}
              className={`flex items-center gap-1 px-3 py-2 border-r dark:border-slate-800 border-slate-200 cursor-pointer text-xs whitespace-nowrap shrink-0 select-none transition-colors ${
                activeId === tab.id
                  ? "dark:bg-slate-800 bg-slate-100 dark:text-white text-slate-900 font-medium"
                  : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-900 hover:bg-slate-50"
              }`}
            >
              {editingId === tab.id ? (
                <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onBlur={commitRename} onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                  className="w-20 bg-transparent border-b dark:border-slate-500 border-slate-400 outline-none text-xs" />
              ) : (
                <span onDoubleClick={e => startRename(tab, e)}>{tab.label}</span>
              )}
              {tabs.length > 1 && (
                <button onClick={e => closeTab(tab.id, e)} className="ml-0.5 hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addTab} className="px-2 py-2 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white shrink-0">
        {/* Intervals */}
        <div className="flex gap-1">
          {INTERVALS.map(iv => (
            <button key={iv.value} onClick={() => setActiveInterval(iv.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab.interval === iv.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 border dark:border-slate-700 border-slate-200"
              }`}
            >{iv.label}</button>
          ))}
        </div>

        <button onClick={resetActiveTab} title="Reset chart"
          className="flex items-center gap-1 px-2.5 py-1 rounded border dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 text-xs font-medium transition-colors">
          <RotateCcw className="w-3 h-3" />
        </button>

        <a href={`https://www.tradingview.com/chart/?symbol=${activeTab.symbol || ""}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 rounded border dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 text-xs font-medium transition-colors whitespace-nowrap">
          <ExternalLink className="w-3 h-3" /><span className="hidden sm:inline">Open in TradingView</span>
        </a>

        <div className="flex-1" />

        {/* Discord mode toggle */}
        <div className="flex rounded border dark:border-slate-700 border-slate-200 overflow-hidden shrink-0">
          <button onClick={() => setDiscordMode("capture")}
            className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
              discordMode === "capture"
                ? "dark:bg-slate-700 bg-slate-200 dark:text-white text-slate-900"
                : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100"
            }`} title="Screen capture">
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDiscordMode("link")}
            className={`flex items-center gap-1 px-2 py-1 text-xs border-l dark:border-slate-700 border-slate-200 transition-colors ${
              discordMode === "link"
                ? "dark:bg-slate-700 bg-slate-200 dark:text-white text-slate-900"
                : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100"
            }`} title="Paste TV snapshot link">
            <Link className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* TV link input — link mode only */}
        {discordMode === "link" && (
          <input type="text" value={tvLink} onChange={e => setTvLink(e.target.value)}
            placeholder="Paste tradingview.com/x/… link"
            className="px-2.5 py-1 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48" />
        )}
        {/* Note input — always visible */}
        <input type="text" value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Note for Discord…"
          className="px-2.5 py-1 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-24 sm:w-36" />

        {/* Status message */}
        {discordMsg && (
          <span className={`text-xs shrink-0 ${discordStatus === "error" ? "text-red-400" : discordStatus === "success" ? "text-emerald-400" : "dark:text-slate-400 text-slate-500"}`}>
            {discordMsg}
          </span>
        )}

        {/* Single -> Discord button */}
        <button
          onClick={discordMode === "link" ? sendTvLink : captureAndSend}
          disabled={discordBusy || (discordMode === "link" && !isTvLink)}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          {countdown !== null && <span className="w-4 h-4 flex items-center justify-center font-bold text-sm">{countdown}</span>}
          {countdown === null && discordStatus === "capturing" && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {countdown === null && discordStatus === "sending"   && <Send className="w-3.5 h-3.5" />}
          {countdown === null && discordStatus === "success"   && <CheckCircle className="w-3.5 h-3.5" />}
          {countdown === null && discordStatus === "error"     && <AlertCircle className="w-3.5 h-3.5" />}
          {countdown === null && discordStatus === "idle" && (
            discordMode === "link" ? <Link className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />
          )}
          <span>
            {countdown !== null ? `${countdown}… move mouse away` :
              discordMode === "link" ? "Send Link \u2192 Discord" : "Capture \u2192 Discord"}
          </span>
        </button>
      </div>

      {/* ── Chart area + watchlist + trade panel ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Watchlist sidebar ── */}
        <div
          className={
            showWatchlist
              ? "fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col overflow-hidden dark:bg-slate-900 bg-white sm:relative sm:inset-auto sm:z-auto sm:shrink-0 sm:border-r dark:border-slate-800 border-slate-200"
              : "hidden sm:flex sm:flex-col sm:shrink-0 sm:w-0 sm:overflow-hidden sm:transition-[width] sm:duration-200 dark:bg-slate-900 bg-white"
          }
          style={showWatchlist ? { width: undefined, ...(typeof window !== "undefined" && window.innerWidth >= 640 ? { width: wlWidth } : {}) } : undefined}
        >
          {/* Mobile close bar */}
          <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b dark:border-slate-800 border-slate-200 shrink-0">
            <span className="text-sm font-semibold dark:text-white text-slate-900">Watchlist</span>
            <button
              onClick={() => setShowWatchlist(false)}
              className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 dark:text-slate-400 text-slate-500" />
            </button>
          </div>

          {/* Header Row 1: watchlist dropdown + ... toggle + close */}
          <div className="flex items-center gap-1 px-2 py-2 border-b dark:border-slate-800 border-slate-200 shrink-0">
            {editingWlName ? (
              <input
                autoFocus
                value={wlNameInput}
                onChange={e => setWlNameInput(e.target.value)}
                onBlur={commitWlRename}
                onKeyDown={e => { if (e.key === "Enter") commitWlRename(); if (e.key === "Escape") setEditingWlName(false); }}
                className="flex-1 min-w-0 px-1.5 py-1 text-xs rounded border dark:border-slate-600 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            ) : (
              <select
                value={activeWlId}
                onChange={e => setActiveWlId(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1 text-xs rounded border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {watchlists.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setWlToolbarExpanded(v => !v)}
              title="More actions"
              className={`p-1 rounded dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0 ${wlToolbarExpanded ? "dark:bg-slate-800 bg-slate-100" : ""}`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowWatchlist(false)} title="Close" className="hidden sm:block p-1 rounded hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0">
              <X className="w-3.5 h-3.5 dark:text-slate-400 text-slate-500" />
            </button>
          </div>

          {/* Header Row 2: collapsible toolbar */}
          {wlToolbarExpanded && (
            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b dark:border-slate-800 border-slate-200 shrink-0">
              <button
                onClick={() => { setWlNameInput(activeWatchlist.name); setEditingWlName(true); setWlToolbarExpanded(false); }}
                title="Rename watchlist"
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => { createWatchlist(); setWlToolbarExpanded(false); }}
                title="New watchlist"
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={deleteActiveWatchlist}
                title="Delete watchlist"
                disabled={watchlists.length === 1}
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:text-red-400 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={exportWatchlist}
                title="Export watchlist"
                disabled={symbolCount === 0}
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:text-emerald-400 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setShowBulkImport(v => !v); setWlToolbarExpanded(false); }}
                title="Import symbols"
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:text-emerald-400 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              >
                <Upload className="w-3 h-3" />
              </button>
              <button
                onClick={() => { addSector(); setWlToolbarExpanded(false); }}
                title="Add sector group"
                className="p-1 rounded dark:text-slate-400 text-slate-500 hover:text-amber-400 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Symbol search / add */}
          <div className="px-2 py-2 border-b dark:border-slate-800 border-slate-200 shrink-0">
            <SymbolSearch
              value={wlSearch}
              onChange={setWlSearch}
              onSelectFull={({ symbol, name }) => { addToWatchlist(symbol, name); setWlSearch(""); }}
              placeholder="Add symbol"
            />
            <button
              onClick={() => setShowCustomAdd(v => !v)}
              className="mt-1.5 text-[10px] dark:text-slate-500 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              {showCustomAdd ? "Cancel" : "+ Add custom symbol"}
            </button>
            {showCustomAdd && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                <input
                  type="text"
                  value={customSymbol}
                  onChange={e => setCustomSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol (e.g. BTC)"
                  className="w-full px-2 py-1.5 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full px-2 py-1.5 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => {
                    const sym = customSymbol.trim();
                    if (!sym) return;
                    addToWatchlist(sym, customName.trim() || sym);
                    setCustomSymbol("");
                    setCustomName("");
                    setShowCustomAdd(false);
                  }}
                  disabled={!customSymbol.trim()}
                  className="w-full py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                >
                  Add to Watchlist
                </button>
              </div>
            )}
          </div>

          {/* Bulk import panel */}
          {showBulkImport && (
            <div className="px-2 py-2 border-b dark:border-slate-800 border-slate-200 shrink-0 space-y-1.5">
              <p className="text-[10px] dark:text-slate-400 text-slate-500">Paste symbols separated by commas or upload a file:</p>
              <textarea
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                placeholder="AAPL, MSFT, TSLA, NVDA..."
                rows={3}
                className="w-full px-2 py-1.5 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => importBulkSymbols(bulkInput)}
                  disabled={!bulkInput.trim()}
                  className="flex-1 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                >
                  Add Symbols
                </button>
                <button
                  onClick={() => wlFileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium rounded border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Upload File
                </button>
                <input
                  ref={wlFileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleWlFileImport}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Filter input */}
          <div className="px-2 py-1.5 border-b dark:border-slate-800 border-slate-200 shrink-0">
            <input
              type="text"
              value={wlFilter}
              onChange={e => setWlFilter(e.target.value)}
              placeholder="Filter list"
              className="w-full px-2 py-1 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Symbol / sector list with drag-and-drop */}
          <div className="flex-1 overflow-y-auto">
            {activeWatchlist.items.length === 0 ? (
              <p className="px-3 py-5 text-xs dark:text-slate-500 text-slate-400 text-center">
                Search above to add symbols
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeWatchlist.items.map(itemId)} strategy={verticalListSortingStrategy}>
                  {visibleItems.map(({ item, hidden: isHidden }) =>
                    isSector(item) ? (
                      <SortableSectorRow
                        key={`sector-${item.id}`}
                        item={item}
                        onToggle={() => toggleSectorCollapse(item.id)}
                        onRename={(name) => renameSector(item.id, name)}
                        onDelete={() => deleteSector(item.id)}
                        hidden={isHidden}
                      />
                    ) : (
                      <SortableSymbolRow
                        key={item.symbol}
                        item={item}
                        onSelect={selectSymbol}
                        onRemove={removeFromWatchlist}
                        hidden={isHidden}
                      />
                    )
                  )}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* ── Watchlist resize handle (desktop only) ── */}
        {showWatchlist && (
          <div
            onMouseDown={e => startResize(e, "left")}
            className="hidden sm:block w-1 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors shrink-0 z-10"
            style={{ marginLeft: -2, marginRight: -2 }}
          />
        )}

        {/* ── Watchlist collapse/expand toggle strip ── */}
        <button
          onClick={() => setShowWatchlist(v => !v)}
          title={showWatchlist ? "Collapse watchlist" : "Watchlist"}
          className="hidden sm:flex relative flex-col items-center justify-center w-5 shrink-0 border-r dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-slate-50 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors z-10 gap-2"
        >
          {!showWatchlist && (
            <span className="[writing-mode:vertical-rl] text-[9px] font-bold tracking-widest text-emerald-400 rotate-180 select-none">
              WATCHLIST
            </span>
          )}
          {showWatchlist
            ? <ChevronLeft className="w-3 h-3 dark:text-slate-500 text-slate-400 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
          }
        </button>

        {/* Charts */}
        <div className="relative flex-1 min-h-0">
          {tabs.map(tab => (
            <div key={tab.id}
              ref={tab.id === activeId ? chartRef : undefined}
              className={`absolute inset-0 ${tab.id !== activeId ? "invisible pointer-events-none" : ""}`}
            >
              <TradingViewWidget key={resetKeys[tab.id] ?? 0} interval={tab.interval} symbol={tab.symbol || undefined} />
            </div>
          ))}
        </div>

        {/* ── Collapse/expand toggle strip (desktop only) ── */}
        <button
          onClick={() => setShowPanel(v => !v)}
          title={showPanel ? "Collapse panel" : "Add Trade"}
          className="hidden sm:flex relative flex-col items-center justify-center w-5 shrink-0 border-l dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-slate-50 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors z-10 gap-2"
        >
          {!showPanel && (
            <span className="[writing-mode:vertical-rl] text-[9px] font-bold tracking-widest text-emerald-400 rotate-180 select-none">
              ADD TRADE
            </span>
          )}
          {showPanel
            ? <ChevronRight className="w-3 h-3 dark:text-slate-500 text-slate-400 shrink-0" />
            : <ChevronLeft  className="w-3 h-3 text-emerald-400 shrink-0" />
          }
        </button>

        {/* ── Trade panel resize handle (desktop only) ── */}
        {showPanel && (
          <div
            onMouseDown={e => startResize(e, "right")}
            className="hidden sm:block w-1 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors shrink-0 z-10"
            style={{ marginLeft: -2, marginRight: -2 }}
          />
        )}

        {/* ── Quick-add trade side panel ── */}
        <div
          className={
            showPanel
              ? "fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col overflow-hidden dark:bg-slate-900 bg-white sm:relative sm:inset-auto sm:z-auto sm:shrink-0 sm:border-l dark:border-slate-800 border-slate-200"
              : "hidden sm:flex sm:flex-col sm:shrink-0 sm:w-0 sm:overflow-hidden sm:transition-[width] sm:duration-200 dark:bg-slate-900 bg-white"
          }
          style={showPanel ? { width: typeof window !== "undefined" && window.innerWidth >= 640 ? panelWidth : undefined } : undefined}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-800 border-slate-200 shrink-0">
            <span className="text-sm font-semibold dark:text-white text-slate-900">Add Trade</span>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1.5 rounded-lg hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 dark:text-slate-400 text-slate-500" />
            </button>
          </div>

          {/* Chart — pinned, never scrolls away */}
          <div className="shrink-0">
            <SetupChart
              ref={setupChartRef}
              symbol={form.symbol.trim().toUpperCase()}
              entry={form.entry_price ? parseFloat(form.entry_price) : null}
              stopLoss={form.stop_loss ? parseFloat(form.stop_loss) : null}
              takeProfit={form.take_profit ? parseFloat(form.take_profit) : null}
              direction={form.direction}
              onEntryChange={p => setField("entry_price", String(p))}
              onStopChange={p => setField("stop_loss", String(p))}
              onTargetChange={p => setField("take_profit", String(p))}
              height={220}
            />
          </div>

          {/* Form — scrolls independently below the pinned chart */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
              {/* Symbol + Direction inline */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Symbol</label>
                  <SymbolSearch
                    value={form.symbol}
                    onChange={v => setField("symbol", v)}
                    placeholder="Search symbol…"
                  />
                </div>
                <div className="shrink-0">
                  <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Direction</label>
                  <div className="flex rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
                    {(["long", "short"] as const).map(d => (
                      <button key={d} onClick={() => setField("direction", d)}
                        className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${
                          form.direction === d
                            ? d === "long" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                            : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-50"
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "entry_price", label: "Entry" },
                  { key: "stop_loss",   label: "Stop Loss" },
                  { key: "take_profit", label: "Take Profit" },
                  { key: "shares",      label: "Shares" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">{label}</label>
                    <input
                      type="number" step="any"
                      value={form[key as keyof typeof form]}
                      onChange={e => setField(key as keyof typeof EMPTY_FORM, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Risk (%)</label>
                  <input
                    type="number" step="0.1"
                    value={form.risk_percent}
                    onChange={e => setField("risk_percent", e.target.value)}
                    placeholder={`Default: ${riskPercent}%`}
                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Commission ($)</label>
                  <input
                    type="number" step="0.01"
                    value={form.commission}
                    onChange={e => setField("commission", e.target.value)}
                    placeholder={commission ? `Default: $${commission}` : "0.00"}
                    className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Status</label>
                <div className="flex rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
                  {(["planned", "open", "closed"] as const).map(s => (
                    <button key={s} onClick={() => setField("status", s)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
                        form.status === s
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs dark:text-slate-400 text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
                  rows={2} placeholder="Trade rationale…"
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              {saveError && <p className="text-xs text-red-400">{saveError}</p>}

              {/* Save buttons */}
              <div className="flex gap-2">
                <button onClick={submitTrade} disabled={saving}
                  className="flex-1 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 text-xs font-medium disabled:opacity-50 hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                  {saving ? "Saving…" : "Save as Planned"}
                </button>
                <button onClick={saveAndShare} disabled={saving || shareStatus === "sending"}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1">
                  <Send className="w-3 h-3" />
                  {shareStatus === "sending" ? "Sharing…" : "Save + Share"}
                </button>
              </div>

              {/* Risk analysis — expands downward, never affects chart above */}
              <RiskCalculator
                entry={form.entry_price ? parseFloat(form.entry_price) : null}
                stopLoss={form.stop_loss ? parseFloat(form.stop_loss) : null}
                takeProfit={form.take_profit ? parseFloat(form.take_profit) : null}
                shares={form.shares ? parseFloat(form.shares) : null}
                direction={form.direction}
                commission={form.commission ? parseFloat(form.commission) : commission}
              />
              <PositionSizer
                accountSize={accountSize}
                riskPercent={form.risk_percent ? parseFloat(form.risk_percent) : riskPercent}
                entry={form.entry_price ? parseFloat(form.entry_price) : null}
                stopLoss={form.stop_loss ? parseFloat(form.stop_loss) : null}
                direction={form.direction}
                manualShares={form.shares ? parseFloat(form.shares) : null}
                onApplyShares={(s) => setField("shares", String(s))}
                commission={form.commission ? parseFloat(form.commission) : commission}
              />
            </div>
          </div>
      </div>

      {/* ── Mobile FABs — each button shown when its own panel is closed ── */}
      <div className="sm:hidden fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3 pointer-events-none">
        {!showWatchlist && (
          <button
            onClick={() => setShowWatchlist(true)}
            className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full dark:bg-slate-700 bg-slate-800 hover:bg-slate-600 text-white text-sm font-medium shadow-lg transition-colors"
          >
            <List className="w-4 h-4" />
            Watchlist
          </button>
        )}
        {!showPanel && (
          <button
            onClick={() => setShowPanel(true)}
            className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </button>
        )}
      </div>
    </div>
  );
}
