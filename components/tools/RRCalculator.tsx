"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { riskReward, positionSize } from "@/lib/calculators";

export default function RRCalculator() {
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(95);
  const [target, setTarget] = useState(110);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [posOpen, setPosOpen] = useState(false);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);

  const rr = useMemo(
    () => riskReward(entry, stop, target, direction),
    [entry, stop, target, direction]
  );

  const pos = useMemo(
    () => (posOpen ? positionSize(accountSize, riskPct, entry, stop) : null),
    [posOpen, accountSize, riskPct, entry, stop]
  );

  // Build the price ladder positions
  // For the ladder, we need to figure out the vertical range
  const prices = [entry, stop, target];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;

  // Convert price to % bottom within ladder (higher price = higher position)
  function toBottomPct(price: number): number {
    if (range === 0) return 50;
    return ((price - minPrice) / range) * 80 + 10; // 10%–90% range for padding
  }

  const entryPct = toBottomPct(entry);
  const stopPct = toBottomPct(stop);
  const targetPct = toBottomPct(target);

  // For the colored zones, we need top/bottom of each zone
  // Risk zone: between entry and stop
  const riskZoneBottom = Math.min(entryPct, stopPct);
  const riskZoneHeight = Math.abs(entryPct - stopPct);
  // Reward zone: between entry and target
  const rewardZoneBottom = Math.min(entryPct, targetPct);
  const rewardZoneHeight = Math.abs(entryPct - targetPct);

  function numInput(
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 0.01,
    prefix = "$"
  ) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 dark:text-slate-400">{label}</label>
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-slate-400 text-sm pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            type="number"
            value={value}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className={`w-full bg-slate-800 dark:bg-slate-800 bg-slate-100 border border-slate-700 dark:border-slate-700 border-slate-200 rounded-lg py-2 text-sm text-slate-100 dark:text-slate-100 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${prefix ? "pl-7 pr-3" : "px-3"}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inputs row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Direction toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Direction</label>
          <div className="flex rounded-lg border border-slate-700 dark:border-slate-700 border-slate-200 overflow-hidden">
            <button
              onClick={() => {
                if (direction !== "long") {
                  setDirection("long");
                  setStop(target);
                  setTarget(stop);
                }
              }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                direction === "long"
                  ? "bg-emerald-600 text-white"
                  : "dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-600 dark:hover:bg-slate-700 hover:bg-slate-200"
              }`}
            >
              Long
            </button>
            <button
              onClick={() => {
                if (direction !== "short") {
                  setDirection("short");
                  setStop(target);
                  setTarget(stop);
                }
              }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                direction === "short"
                  ? "bg-red-600 text-white"
                  : "dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-600 dark:hover:bg-slate-700 hover:bg-slate-200"
              }`}
            >
              Short
            </button>
          </div>
        </div>

        {numInput("Entry Price", entry, setEntry, 0.01)}
        {numInput("Stop Loss", stop, setStop, 0.01)}
        {numInput("Take Profit", target, setTarget, 0.01)}
      </div>

      {/* Price Ladder + Stats layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Price Ladder Visualization */}
        <div className="flex-shrink-0 md:w-48">
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
            Price Ladder
          </p>
          <div
            className="relative w-full rounded-xl dark:bg-slate-800/50 bg-slate-100 border dark:border-slate-700 border-slate-200"
            style={{ height: 300 }}
          >
            {/* Reward zone */}
            <div
              className="absolute left-6 right-6 bg-emerald-500/20 rounded"
              style={{
                bottom: `${rewardZoneBottom}%`,
                height: `${rewardZoneHeight}%`,
              }}
            />
            {/* Risk zone */}
            <div
              className="absolute left-6 right-6 bg-red-500/20 rounded"
              style={{
                bottom: `${riskZoneBottom}%`,
                height: `${riskZoneHeight}%`,
              }}
            />

            {/* Target line */}
            <div
              className="absolute left-4 right-4 flex items-center gap-2"
              style={{ bottom: `${targetPct}%` }}
            >
              <div className="h-0.5 flex-1 bg-emerald-500" />
              <span className="text-xs font-mono text-emerald-400 whitespace-nowrap">
                {target.toFixed(2)}
              </span>
            </div>

            {/* Entry line */}
            <div
              className="absolute left-4 right-4 flex items-center gap-2"
              style={{ bottom: `${entryPct}%` }}
            >
              <div className="h-0.5 flex-1 bg-slate-400" />
              <span className="text-xs font-mono text-slate-300 whitespace-nowrap">
                {entry.toFixed(2)}
              </span>
            </div>

            {/* Stop line */}
            <div
              className="absolute left-4 right-4 flex items-center gap-2"
              style={{ bottom: `${stopPct}%` }}
            >
              <div className="h-0.5 flex-1 bg-red-500" />
              <span className="text-xs font-mono text-red-400 whitespace-nowrap">
                {stop.toFixed(2)}
              </span>
            </div>

            {/* Labels on left side */}
            <div
              className="absolute left-0 text-[10px] text-emerald-400 px-1"
              style={{ bottom: `${targetPct}%`, transform: "translateY(50%)" }}
            >
              TP
            </div>
            <div
              className="absolute left-0 text-[10px] text-slate-400 px-1"
              style={{ bottom: `${entryPct}%`, transform: "translateY(50%)" }}
            >
              EN
            </div>
            <div
              className="absolute left-0 text-[10px] text-red-400 px-1"
              style={{ bottom: `${stopPct}%`, transform: "translateY(50%)" }}
            >
              SL
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-4">
          {/* R:R ratio — hero stat */}
          <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">R:R Ratio</p>
            <p className="text-3xl font-bold text-slate-100 dark:text-slate-100 text-slate-900">
              {rr.rrRatio.toFixed(2)}{" "}
              <span className="text-xl font-normal text-slate-400">: 1</span>
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Risk / Share</p>
              <p className="text-sm font-semibold text-red-400">
                ${rr.riskPerShare.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{rr.riskPct.toFixed(2)}%</p>
            </div>
            <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Reward / Share</p>
              <p className="text-sm font-semibold text-emerald-400">
                ${rr.rewardPerShare.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{rr.rewardPct.toFixed(2)}%</p>
            </div>
          </div>

          {/* Direction note */}
          <p className="text-xs text-slate-500 text-center">
            {direction === "long" ? "Long" : "Short"} trade —{" "}
            {direction === "long"
              ? "target above entry, stop below"
              : "target below entry, stop above"}
          </p>
        </div>
      </div>

      {/* Collapsible Position Sizing */}
      <div className="border dark:border-slate-700 border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setPosOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 dark:bg-slate-800/50 bg-slate-50 dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors text-sm font-medium dark:text-slate-200 text-slate-700"
        >
          <span>Position Sizing</span>
          {posOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {posOpen && (
          <div className="p-4 dark:bg-slate-800/30 bg-white border-t dark:border-slate-700 border-slate-200 space-y-4">
            {/* Position sizing inputs */}
            <div className="grid grid-cols-2 gap-4">
              {numInput("Account Size", accountSize, setAccountSize, 100)}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Risk %</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={riskPct}
                    step={0.1}
                    min={0.1}
                    max={100}
                    onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
                    className="w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 rounded-lg py-2 pl-3 pr-7 text-sm dark:text-slate-100 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 text-slate-400 text-sm pointer-events-none">%</span>
                </div>
              </div>
            </div>

            {/* Results */}
            {pos && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Dollar Risk</p>
                  <p className="text-sm font-semibold text-red-400">
                    ${pos.dollarRisk.toFixed(2)}
                  </p>
                </div>
                <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Dollar Reward</p>
                  <p className="text-sm font-semibold text-emerald-400">
                    ${(pos.dollarRisk * rr.rrRatio).toFixed(2)}
                  </p>
                </div>
                <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Shares</p>
                  <p className="text-sm font-semibold dark:text-slate-100 text-slate-900">
                    {pos.shares.toLocaleString()}
                  </p>
                </div>
                <div className="dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Position Value</p>
                  <p className="text-sm font-semibold dark:text-slate-100 text-slate-900">
                    ${pos.positionValue.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
