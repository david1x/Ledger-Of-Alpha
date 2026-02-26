"use client";
import { useMemo } from "react";
import clsx from "clsx";

interface Props {
  accountSize: number;
  riskPercent: number;
  entry: number | null;
  stopLoss: number | null;
  direction: "long" | "short";
  manualShares?: number | null;
  onApplyShares?: (shares: number) => void;
}

export default function PositionSizer({
  accountSize,
  riskPercent,
  entry,
  stopLoss,
  direction,
  manualShares,
  onApplyShares,
}: Props) {
  const result = useMemo(() => {
    if (!entry || !stopLoss || !accountSize || !riskPercent) return null;

    const stopDist = Math.abs(entry - stopLoss);
    if (stopDist === 0) return null;

    const dollarRisk = (accountSize * riskPercent) / 100;
    const recommendedShares = Math.floor(dollarRisk / stopDist);

    // Stats for the recommended share count
    const recPositionValue = recommendedShares * entry;
    const recActualRisk = recommendedShares * stopDist;
    const recActualRiskPct = (recActualRisk / accountSize) * 100;
    const recPortfolioPct = (recPositionValue / accountSize) * 100;

    // Stats for manually entered shares (if provided)
    let manual = null;
    if (manualShares && manualShares > 0) {
      const manPositionValue = manualShares * entry;
      const manActualRisk = manualShares * stopDist;
      const manActualRiskPct = (manActualRisk / accountSize) * 100;
      const manPortfolioPct = (manPositionValue / accountSize) * 100;
      const overRisk = manActualRiskPct > riskPercent;
      manual = { manPositionValue, manActualRisk, manActualRiskPct, manPortfolioPct, overRisk };
    }

    return {
      recommendedShares,
      recPositionValue,
      recActualRisk,
      recActualRiskPct,
      recPortfolioPct,
      dollarRisk,
      manual,
    };
  }, [accountSize, riskPercent, entry, stopLoss, direction, manualShares]);

  if (!result) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-4">
        <p className="text-xs dark:text-slate-500 text-slate-400 text-center">
          Enter entry & stop loss to size position
        </p>
      </div>
    );
  }

  const isManual = result.manual !== null;

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">
          Position Sizing
        </h3>
        <span className="text-xs dark:text-slate-500 text-slate-400">
          Account: <span className="dark:text-slate-300 text-slate-600 font-medium">${accountSize.toLocaleString()}</span>
          {" · "}Risk: <span className="dark:text-slate-300 text-slate-600 font-medium">{riskPercent}%</span>
        </span>
      </div>

      {/* Recommended shares */}
      <div
        className={clsx(
          "rounded-lg border p-3 transition-colors",
          isManual
            ? "dark:bg-slate-900/40 bg-white dark:border-slate-700 border-slate-200 opacity-70"
            : "dark:bg-slate-900/60 bg-white dark:border-slate-700 border-slate-200"
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs dark:text-slate-400 text-slate-500">
            {isManual ? "Recommended shares" : "Recommended shares"}
          </span>
          {isManual && onApplyShares && (
            <button
              onClick={() => onApplyShares(result.recommendedShares)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              ← Use this
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={clsx("text-3xl font-bold", isManual ? "dark:text-slate-400 text-slate-500" : "text-emerald-400")}>
            {result.recommendedShares.toLocaleString()}
          </span>
          <span className="text-xs dark:text-slate-500 text-slate-400">
            @ {result.recActualRiskPct.toFixed(2)}% risk · ${result.recActualRisk.toFixed(2)} max loss
          </span>
        </div>
      </div>

      {/* Manual shares stats — shown when user entered shares */}
      {isManual && result.manual && (
        <div className={clsx(
          "rounded-lg border p-3",
          result.manual.overRisk
            ? "dark:bg-red-500/10 bg-red-50 dark:border-red-500/30 border-red-200"
            : "dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/30 border-emerald-200"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium dark:text-slate-300 text-slate-600">
              Your shares: {manualShares?.toLocaleString()}
            </span>
            {result.manual.overRisk && (
              <span className="text-xs text-red-400 font-medium">⚠ Over risk limit</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-xs dark:text-slate-500 text-slate-400">Position Value</div>
              <div className="text-sm font-semibold dark:text-white text-slate-900">
                ${result.manual.manPositionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-xs dark:text-slate-500 text-slate-400">Portfolio %</div>
              <div className="text-sm font-semibold dark:text-white text-slate-900">
                {result.manual.manPortfolioPct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs dark:text-slate-500 text-slate-400">Dollar at Risk</div>
              <div className={clsx("text-sm font-semibold", result.manual.overRisk ? "text-red-400" : "text-emerald-400")}>
                -${result.manual.manActualRisk.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs dark:text-slate-500 text-slate-400">Actual Risk %</div>
              <div className={clsx("text-sm font-semibold", result.manual.overRisk ? "text-red-400" : "text-emerald-400")}>
                {result.manual.manActualRiskPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer stat */}
      <div className="text-xs dark:text-slate-500 text-slate-400 text-right">
        Max dollar risk allowed: <span className="dark:text-slate-300 text-slate-600 font-medium">${result.dollarRisk.toFixed(2)}</span>
      </div>
    </div>
  );
}
