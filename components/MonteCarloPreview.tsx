"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { useMonteCarloPreview } from "@/lib/use-monte-carlo";

const LABEL =
  "block text-[10px] font-black uppercase tracking-[0.2em] dark:text-slate-500 text-slate-400 mb-2 ml-1";
const INPUT =
  "w-full px-4 py-2.5 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm hover:border-slate-400 dark:hover:border-slate-600";

interface Props {
  historicalTrades: { pnl_percent: number; strategy_id?: string | null }[];
  strategies: { id: string; name: string }[];
  startingBalance: number;
  entry: number | null;
  stopLoss: number | null;
  direction: "long" | "short";
  currentShares: number | null;
  ruinThreshold: number;
  commission: number;
  onApplyShares: (shares: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
}

/** Format a dollar amount with sign and color class */
function formatCurrency(value: number): { text: string; colorClass: string } {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    text: value >= 0 ? `+$${formatted}` : `-$${formatted}`,
    colorClass:
      value >= 0
        ? "text-emerald-400"
        : "text-red-400",
  };
}

/** Determine severity bucket based on ruin probability vs threshold */
function getSeverity(
  probOfRuin: number,
  threshold: number
): "low" | "moderate" | "high" {
  if (probOfRuin >= threshold * 2) return "high";
  if (probOfRuin >= threshold) return "moderate";
  return "low";
}

export default function MonteCarloPreview({
  historicalTrades,
  strategies,
  startingBalance,
  entry,
  stopLoss,
  direction,
  currentShares,
  ruinThreshold,
  commission,
  onApplyShares,
  onCollapsedChange,
  defaultCollapsed = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [strategyFilter, setStrategyFilter] = useState<string | null>(null);

  const { result, suggestedShares, isRunning, tradeCount, hasEnoughData } =
    useMonteCarloPreview({
      historicalTrades,
      startingBalance,
      entry,
      stopLoss,
      direction,
      currentShares,
      ruinThreshold,
      strategyFilter,
      commission,
    });

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    onCollapsedChange?.(next);
  }

  // --- Risk badge logic ---
  type BadgeInfo = {
    label: string;
    badgeClass: string;
    showWarning: boolean;
  };

  function getRiskBadge(): BadgeInfo {
    if (!result) {
      return {
        label: "No data",
        badgeClass:
          "dark:bg-slate-700 bg-slate-200 dark:text-slate-400 text-slate-500",
        showWarning: false,
      };
    }
    const severity = getSeverity(result.probOfRuin, ruinThreshold);
    if (severity === "high") {
      return {
        label: `High risk: ${result.probOfRuin.toFixed(1)}%`,
        badgeClass: "bg-red-500/20 text-red-400 border border-red-500/40",
        showWarning: true,
      };
    }
    if (severity === "moderate") {
      return {
        label: "Moderate risk",
        badgeClass:
          "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
        showWarning: false,
      };
    }
    return {
      label: "Low risk",
      badgeClass:
        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
      showWarning: false,
    };
  }

  const badge = getRiskBadge();

  // --- Strategy options with counts ---
  const strategyOptions = strategies.map((s) => {
    const count = historicalTrades.filter((t) => t.strategy_id === s.id).length;
    return { ...s, count, disabled: count < 5 };
  });

  // --- Position delta text ---
  function getDeltaText(): string | null {
    if (
      suggestedShares === null ||
      !currentShares ||
      currentShares <= 0
    )
      return null;
    const diff = currentShares - suggestedShares;
    if (diff === 0) return "MC matches your current size";
    const pct = Math.round(Math.abs(diff / currentShares) * 100);
    return diff > 0
      ? `MC suggests ${pct}% less risk`
      : `${pct}% more room available`;
  }

  const deltaText = getDeltaText();
  const showPositionRow =
    entry !== null &&
    stopLoss !== null &&
    suggestedShares !== null &&
    suggestedShares > 0;

  return (
    <div className="rounded-xl dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between px-4 py-3 hover:dark:bg-slate-700/40 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 dark:text-slate-400 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider dark:text-slate-300 text-slate-600">
            Monte Carlo Risk Preview
          </span>
          {isRunning && (
            <span className="text-[10px] dark:text-slate-500 text-slate-400 animate-pulse">
              running...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mini risk badge */}
          <span
            className={clsx(
              "flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
              badge.badgeClass
            )}
          >
            {badge.showWarning && <AlertTriangle className="w-3 h-3" />}
            {badge.label}
          </span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 dark:text-slate-400 text-slate-500" />
          ) : (
            <ChevronUp className="w-4 h-4 dark:text-slate-400 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t dark:border-slate-700 border-slate-200 pt-3">
          {/* Risk warning banner */}
          {result && getSeverity(result.probOfRuin, ruinThreshold) === "high" && (
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Ruin: {result.probOfRuin.toFixed(1)}% (threshold:{" "}
                  {ruinThreshold}%) — Consider reducing position size
                </span>
              </div>
            </div>
          )}
          {result && getSeverity(result.probOfRuin, ruinThreshold) === "moderate" && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
              <p className="text-xs text-yellow-400 font-medium">
                Ruin probability: {result.probOfRuin.toFixed(1)}% (threshold:{" "}
                {ruinThreshold}%)
              </p>
            </div>
          )}

          {/* Low data warning */}
          {tradeCount > 0 && !hasEnoughData && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
              <p className="text-xs text-amber-400">
                Not enough trade history ({tradeCount}/10 trades). Results may be
                unreliable.
              </p>
            </div>
          )}

          {/* No data state */}
          {tradeCount === 0 && (
            <div className="rounded-lg dark:bg-slate-900/40 bg-white px-3 py-3 text-center">
              <p className="text-xs dark:text-slate-500 text-slate-400">
                No historical trades found
                {strategyFilter ? " for the selected strategy" : ""}.
              </p>
            </div>
          )}

          {/* Results grid */}
          {result && (
            <div
              className={clsx(
                "grid grid-cols-2 gap-2 transition-opacity",
                isRunning && "opacity-50 animate-pulse"
              )}
            >
              {/* Median Outcome */}
              <div className="rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 px-3 py-2">
                <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">
                  Median Outcome
                </p>
                <p
                  className={clsx(
                    "text-sm font-bold",
                    formatCurrency(
                      result.medianFinalBalance - startingBalance
                    ).colorClass
                  )}
                >
                  {
                    formatCurrency(
                      result.medianFinalBalance - startingBalance
                    ).text
                  }
                </p>
              </div>

              {/* Prob. of Profit */}
              <div className="rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 px-3 py-2">
                <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">
                  Prob. of Profit
                </p>
                <p
                  className={clsx(
                    "text-sm font-bold",
                    result.probOfProfit >= 50
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {result.probOfProfit.toFixed(1)}%
                </p>
              </div>

              {/* Max Drawdown */}
              <div className="rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 px-3 py-2">
                <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">
                  Max Drawdown
                </p>
                <p className="text-sm font-bold text-red-400">
                  -{(result.maxDrawdown * 100).toFixed(1)}%
                </p>
              </div>

              {/* Ruin Probability */}
              <div className="rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 px-3 py-2">
                <p className="text-[10px] dark:text-slate-500 text-slate-400 mb-0.5">
                  Ruin Probability
                </p>
                <p
                  className={clsx("text-sm font-bold", {
                    "text-emerald-400":
                      getSeverity(result.probOfRuin, ruinThreshold) === "low",
                    "text-yellow-400":
                      getSeverity(result.probOfRuin, ruinThreshold) ===
                      "moderate",
                    "text-red-400":
                      getSeverity(result.probOfRuin, ruinThreshold) === "high",
                  })}
                >
                  {result.probOfRuin.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {/* Position size suggestion */}
          {showPositionRow && suggestedShares !== null && (
            <div className="rounded-lg dark:bg-slate-900/40 bg-white border dark:border-slate-700 border-slate-200 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs dark:text-slate-300 text-slate-700 font-semibold">
                    MC Suggested:{" "}
                    <span className="text-emerald-400">
                      {suggestedShares.toLocaleString()} shares
                    </span>
                  </p>
                  {currentShares && currentShares > 0 && (
                    <p className="text-[10px] dark:text-slate-500 text-slate-400">
                      Your current: {currentShares.toLocaleString()} shares
                      {deltaText && (
                        <span className="ml-1 dark:text-slate-400 text-slate-500">
                          — {deltaText}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onApplyShares(suggestedShares)}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Strategy filter */}
          <div>
            <label className={LABEL}>Filter by Strategy</label>
            <select
              value={strategyFilter ?? ""}
              onChange={(e) =>
                setStrategyFilter(e.target.value === "" ? null : e.target.value)
              }
              className={INPUT}
            >
              <option value="">
                All Strategies ({historicalTrades.length} trades)
              </option>
              {strategyOptions.map((s) => (
                <option key={s.id} value={s.id} disabled={s.disabled}>
                  {s.name} ({s.count} trade{s.count !== 1 ? "s" : ""}){" "}
                  {s.disabled ? "(min 5)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
