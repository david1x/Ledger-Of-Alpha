"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Cable, WifiOff, AlertTriangle } from "lucide-react";

interface IBKRPosition {
  symbol: string;
  quantity: number;
  unrealizedPnl: number;
  pnlPercent: number;
  direction: "long" | "short";
  mktPrice: number;
  avgPrice: number;
  ibkrAccountId: string;
}

interface Props {
  size: "large" | "medium" | "compact";
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "dark:text-slate-300 text-slate-600";
}

export default function IBKRPositionsWidget({ size }: Props) {
  const [positions, setPositions] = useState<IBKRPosition[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayConfigured, setGatewayConfigured] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/broker/ibkr/positions");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg: string = data?.error ?? data?.message ?? "Failed to fetch positions";
        if (msg.includes("No gateway URL configured") || msg.includes("gateway URL")) {
          setGatewayConfigured(false);
        } else {
          setError(msg);
        }
      } else {
        const data: { positions: IBKRPosition[]; fetchedAt: string } = await res.json();
        setPositions(data.positions ?? []);
        setLastFetched(new Date());
        setError(null);
        setGatewayConfigured(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const textSize = size === "compact" ? "text-xs" : "text-sm";

  // ── Unconfigured state ────────────────────────────────────────────────
  if (!gatewayConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 dark:text-slate-400 text-slate-500">
        <Cable className="w-8 h-8 opacity-40" />
        <p className={`${textSize} text-center`}>Connect to IBKR in Settings</p>
        <a
          href="/settings?tab=broker"
          className="text-xs text-sky-500 hover:text-sky-400 underline underline-offset-2"
        >
          Open Settings
        </a>
      </div>
    );
  }

  // ── Never fetched / initial state ────────────────────────────────────
  if (!lastFetched && !loading && !error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs dark:bg-slate-700/60 bg-slate-100 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
            aria-label="Refresh positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span className={`${textSize} dark:text-slate-500 text-slate-400`}>Never updated</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-1.5 dark:text-slate-500 text-slate-400">
          <RefreshCw className="w-7 h-7 opacity-30" />
          <p className="text-xs text-center">Click refresh to load positions</p>
        </div>
      </div>
    );
  }

  // ── Error — never fetched (no stale data) ────────────────────────────
  if (error && positions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs dark:bg-slate-700/60 bg-slate-100 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
            aria-label="Refresh positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-red-400">
          <WifiOff className="w-7 h-7 opacity-60" />
          <p className="text-xs text-center">{error}</p>
          <p className="text-xs dark:text-slate-500 text-slate-400">Try refreshing</p>
        </div>
      </div>
    );
  }

  // ── Normal / stale data state ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-1.5">
      {/* Header: refresh button + timestamp */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs dark:bg-slate-700/60 bg-slate-100 dark:text-slate-300 text-slate-600 hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          aria-label="Refresh positions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <span className="text-xs dark:text-slate-500 text-slate-400">
          {lastFetched ? `Updated ${formatRelativeTime(lastFetched)}` : "Never updated"}
        </span>
      </div>

      {/* Offline / stale data banner */}
      {error && positions.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Gateway offline</span>
          {lastFetched && (
            <span className="dark:text-slate-400 text-slate-500 ml-auto">
              Last seen {formatRelativeTime(lastFetched)}
            </span>
          )}
        </div>
      )}

      {/* Positions table */}
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-1 dark:text-slate-500 text-slate-400">
          <p className="text-xs">No open positions</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b dark:border-slate-700/50 border-slate-200">
                <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2`}>Symbol</th>
                {size === "large" && (
                  <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2`}>Dir</th>
                )}
                {(size === "large" || size === "medium") && (
                  <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2 text-right`}>Qty</th>
                )}
                {size === "large" && (
                  <>
                    <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2 text-right`}>Avg</th>
                    <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2 text-right`}>Mkt</th>
                  </>
                )}
                <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 pr-2 text-right`}>Unr. P&L</th>
                {(size === "large" || size === "medium") && (
                  <th className={`${textSize} font-medium dark:text-slate-400 text-slate-500 pb-1 text-right`}>P&L %</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700/50 divide-slate-200/50">
              {positions.map((pos, i) => (
                <tr key={`${pos.ibkrAccountId}-${pos.symbol}-${i}`}>
                  <td className={`${textSize} dark:text-white text-slate-900 font-medium py-1 pr-2`}>
                    {pos.symbol}
                  </td>
                  {size === "large" && (
                    <td className={`${textSize} py-1 pr-2 ${pos.direction === "long" ? "text-emerald-400" : "text-red-400"}`}>
                      {pos.direction === "long" ? "▲" : "▼"}
                    </td>
                  )}
                  {(size === "large" || size === "medium") && (
                    <td className={`${textSize} dark:text-slate-300 text-slate-600 py-1 pr-2 text-right`}>
                      {pos.quantity}
                    </td>
                  )}
                  {size === "large" && (
                    <>
                      <td className={`${textSize} dark:text-slate-300 text-slate-600 py-1 pr-2 text-right`}>
                        ${pos.avgPrice.toFixed(2)}
                      </td>
                      <td className={`${textSize} dark:text-slate-300 text-slate-600 py-1 pr-2 text-right`}>
                        ${pos.mktPrice.toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className={`${textSize} font-medium py-1 pr-2 text-right ${pnlColor(pos.unrealizedPnl)}`}>
                    {formatPnl(pos.unrealizedPnl)}
                  </td>
                  {(size === "large" || size === "medium") && (
                    <td className={`${textSize} py-1 text-right ${pnlColor(pos.pnlPercent)}`}>
                      {formatPct(pos.pnlPercent)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: total unrealized P&L */}
      {positions.length > 0 && (
        <div className="flex items-center justify-between pt-1.5 border-t dark:border-slate-700/50 border-slate-200 shrink-0">
          <span className={`${textSize} dark:text-slate-400 text-slate-500`}>Total Unrealized P&L</span>
          <span className={`${textSize} font-bold ${pnlColor(totalUnrealized)}`}>
            {formatPnl(totalUnrealized)}
          </span>
        </div>
      )}
    </div>
  );
}
