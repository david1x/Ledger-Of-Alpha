"use client";
import { useEffect, useState, useCallback } from "react";
import { Alert } from "@/lib/types";
import { 
  Bell, Plus, Trash2, Power, Clock, 
  ChevronRight, Filter, Search, AlertTriangle,
  CheckCircle2, XCircle
} from "lucide-react";
import AlertModal from "@/components/AlertModal";
import clsx from "clsx";

type FilterStatus = "all" | "active" | "triggered" | "inactive";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAlert, setEditAlert] = useState<Alert | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      loadAlerts();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      loadAlerts();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const filtered = alerts.filter(a => {
    if (filter === "active") return a.active && !a.triggered_at;
    if (filter === "triggered") return !!a.triggered_at;
    if (filter === "inactive") return !a.active && !a.triggered_at;
    return true;
  }).filter(a => a.symbol.includes(search.toUpperCase()));

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">Alerts</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">
            Manage your price targets and notifications
          </p>
        </div>
        <button
          onClick={() => { setEditAlert(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-400 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol..."
            className="w-full pl-9 pr-3 py-1.5 h-9 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1.5 h-9">
          <Filter className="w-4 h-4 dark:text-slate-500 text-slate-400" />
          {(["all", "active", "triggered", "inactive"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filter === s
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800/50 bg-slate-100/50"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl dark:bg-slate-800/50 bg-white overflow-hidden p-1">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b dark:border-slate-700/50 border-slate-100">
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider">Condition</th>
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider">Last Triggered</th>
              <th className="px-4 py-3 text-xs font-bold dark:text-slate-500 text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-700/50 divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center dark:text-slate-500 text-slate-400">Loading alerts...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center dark:text-slate-500 text-slate-400">No alerts found.</td></tr>
            ) : filtered.map((a) => (
              <tr key={a.id} className="hover:dark:bg-slate-800/30 hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-3">
                  <span className="font-bold text-emerald-400">{a.symbol}</span>
                  {a.note && <p className="text-[10px] dark:text-slate-500 text-slate-400 truncate max-w-[150px]">{a.note}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    "text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-tighter",
                    a.condition === "above" || a.condition === "percent_up" ? "bg-emerald-500/10 text-emerald-400" :
                    a.condition === "below" || a.condition === "percent_down" ? "bg-red-500/10 text-red-400" :
                    a.condition === "percent_move" ? "bg-purple-500/10 text-purple-400" :
                    "bg-blue-500/10 text-blue-400"
                  )}>
                    {a.condition === "percent_up" ? `+${a.percent_value}%` : a.condition === "percent_down" ? `-${a.percent_value}%` : a.condition === "percent_move" ? `\u00B1${a.percent_value}%` : a.condition}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm dark:text-slate-300 text-slate-700">
                  <div>${a.target_price.toLocaleString()}</div>
                  {a.anchor_price && (
                    <div className="text-[10px] dark:text-slate-500 text-slate-400">from ${a.anchor_price.toLocaleString()}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.triggered_at ? (
                    <span className="flex items-center gap-1.5 text-xs text-yellow-500 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Triggered
                    </span>
                  ) : a.active ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs dark:text-slate-500 text-slate-400 font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs dark:text-slate-500 text-slate-400">
                  {a.triggered_at ? (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(a.triggered_at)}
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditAlert(a); setShowModal(true); }}
                      className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                      title="Edit"
                    >
                      <AlertPencil className="w-4 h-4 dark:text-slate-400 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleToggle(a.id, !a.active)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        a.active ? "hover:dark:bg-slate-700 hover:bg-slate-200" : "hover:bg-emerald-500/20"
                      )}
                      title={a.active ? "Deactivate" : "Activate"}
                    >
                      <Power className={clsx("w-4 h-4", a.active ? "dark:text-slate-500 text-slate-400" : "text-emerald-400")} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditAlert(null); }}
        onSaved={loadAlerts}
        editAlert={editAlert}
      />
    </div>
  );
}

function AlertPencil({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );
}
