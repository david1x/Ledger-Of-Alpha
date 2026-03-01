"use client";
import { useMemo } from "react";
import clsx from "clsx";

interface Props {
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  shares: number | null;
  direction: "long" | "short";
  commission?: number;
}

export default function RiskCalculator({ entry, stopLoss, takeProfit, shares, direction, commission = 0 }: Props) {
  const calc = useMemo(() => {
    if (!entry || !stopLoss) return null;

    const stopDist = Math.abs(entry - stopLoss);

    // Trailing stop: stop is on the profit side of entry
    const isTrailing = direction === "long" ? stopLoss > entry : stopLoss < entry;

    const targetDist = takeProfit ? Math.abs(takeProfit - entry) : null;

    const riskPerShare = stopDist;
    const rewardPerShare = targetDist ?? null;

    // When trailing, risk is 0 (profit locked) — R:R doesn't apply the same way
    const effectiveRisk = isTrailing ? 0 : riskPerShare;
    const rrRatio = !isTrailing && rewardPerShare ? rewardPerShare / riskPerShare : null;

    const totalRisk = shares ? effectiveRisk * shares : null;
    const totalReward = shares && rewardPerShare ? rewardPerShare * shares : null;

    // Locked-in profit when trailing
    const lockedProfit = isTrailing ? stopDist : 0;
    const totalLockedProfit = shares && isTrailing ? lockedProfit * shares : null;

    const breakEven = direction === "long"
      ? entry + (entry * 0.001)
      : entry - (entry * 0.001);

    const validTarget = takeProfit
      ? (direction === "long" ? takeProfit > entry : takeProfit < entry)
      : true;

    return {
      stopDist,
      targetDist,
      riskPerShare,
      rewardPerShare,
      rrRatio,
      totalRisk,
      totalReward,
      breakEven,
      validTarget,
      isTrailing,
      lockedProfit,
      totalLockedProfit,
    };
  }, [entry, stopLoss, takeProfit, shares, direction]);

  if (!calc) {
    return (
      <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-4">
        <p className="text-xs dark:text-slate-500 text-slate-400 text-center">Enter entry & stop loss to see risk metrics</p>
      </div>
    );
  }

  const rrColor = calc.rrRatio
    ? calc.rrRatio >= 2 ? "text-emerald-400" : calc.rrRatio >= 1 ? "text-yellow-400" : "text-red-400"
    : "dark:text-slate-400 text-slate-500";

  return (
    <div className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">Risk Analysis</h3>
        {calc.isTrailing && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            Trailing Stop
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {calc.isTrailing ? (
          <Stat
            label="Locked Profit"
            value={calc.totalLockedProfit ? `+$${calc.totalLockedProfit.toFixed(2)}` : `$${calc.lockedProfit.toFixed(2)}/sh`}
            className="text-emerald-400"
          />
        ) : (
          <Stat label="Stop Distance" value={`$${calc.stopDist.toFixed(2)}/sh`} />
        )}
        <Stat label="Target Distance" value={calc.targetDist ? `$${calc.targetDist.toFixed(2)}/sh` : "—"} warn={!calc.validTarget} warnMsg="Target wrong side" />

        {calc.isTrailing ? (
          <Stat
            label="Risk / Trade"
            value="$0.00 (profit locked)"
            className="text-emerald-400"
          />
        ) : (
          <Stat
            label="Risk / Trade"
            value={calc.totalRisk ? `-$${calc.totalRisk.toFixed(2)}` : `$${calc.riskPerShare.toFixed(2)}/sh`}
            className="text-red-400"
          />
        )}
        <Stat
          label="Reward / Trade"
          value={calc.totalReward ? `+$${calc.totalReward.toFixed(2)}` : calc.rewardPerShare ? `$${calc.rewardPerShare.toFixed(2)}/sh` : "—"}
          className="text-emerald-400"
        />

        <div className="col-span-2 flex items-center justify-between rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 p-3">
          <span className="text-xs dark:text-slate-400 text-slate-500 font-medium">
            {calc.isTrailing ? "Status" : "Risk:Reward Ratio"}
          </span>
          <span className={clsx("text-xl font-bold", calc.isTrailing ? "text-emerald-400" : rrColor)}>
            {calc.isTrailing ? "Risk-Free" : calc.rrRatio ? `1 : ${calc.rrRatio.toFixed(2)}` : "—"}
          </span>
        </div>

        <Stat label="Break Even" value={`$${calc.breakEven.toFixed(2)}`} className="dark:text-slate-300 text-slate-600" />
        {calc.isTrailing ? (
          <Stat label="Minimum P&L" value={calc.totalLockedProfit ? `+$${calc.totalLockedProfit.toFixed(2)}` : `+$${calc.lockedProfit.toFixed(2)}/sh`} className="text-emerald-400" />
        ) : (
          <Stat
            label="R:R Rating"
            value={calc.rrRatio ? (calc.rrRatio >= 2 ? "Excellent" : calc.rrRatio >= 1.5 ? "Good" : calc.rrRatio >= 1 ? "Fair" : "Poor") : "—"}
            className={rrColor}
          />
        )}

        {commission > 0 && shares && (
          <>
            <Stat label="Commission" value={`-$${(commission * 2).toFixed(2)}`} className="text-orange-400" />
            <Stat
              label="Net P&L (at target)"
              value={calc.totalReward != null ? `$${(calc.totalReward - commission * 2).toFixed(2)}` : "—"}
              className={calc.totalReward != null && calc.totalReward - commission * 2 >= 0 ? "text-emerald-400" : "text-red-400"}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label, value, className, warn, warnMsg
}: {
  label: string; value: string; className?: string; warn?: boolean; warnMsg?: string;
}) {
  return (
    <div className="rounded-lg dark:bg-slate-900/60 bg-white border dark:border-slate-700 border-slate-200 p-2.5">
      <div className="text-xs dark:text-slate-500 text-slate-400 mb-0.5">{label}</div>
      <div className={clsx("text-sm font-semibold", className ?? "dark:text-white text-slate-900")}>
        {value}
      </div>
      {warn && warnMsg && (
        <div className="text-xs text-red-400 mt-0.5">⚠ {warnMsg}</div>
      )}
    </div>
  );
}
