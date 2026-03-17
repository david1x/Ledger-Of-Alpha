"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SimulationResult } from "./simulation";

export interface MonteCarloInput {
  historicalTrades: { pnl_percent: number; strategy_id?: string | null }[];
  startingBalance: number;
  entry: number | null;
  stopLoss: number | null;
  direction: "long" | "short";
  currentShares: number | null;
  ruinThreshold: number;     // user-configurable percentage, e.g. 5 means 5%
  strategyFilter: string | null; // null = "All Strategies"
  commission: number;
}

export interface MonteCarloOutput {
  result: SimulationResult | null;
  suggestedShares: number | null;
  isRunning: boolean;
  tradeCount: number;        // how many trades used in simulation
  hasEnoughData: boolean;    // >= 10 trades
}

export function useMonteCarloPreview(input: MonteCarloInput): MonteCarloOutput {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [suggestedShares, setSuggestedShares] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create and wire up the worker on mount
  useEffect(() => {
    const worker = new Worker("/mc-worker.js");
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === "result") {
        const { type: _type, ...simResult } = data;
        setResult(simResult as SimulationResult);
        // After getting simulation result, request suggested size
        setIsRunning(false);
      }

      if (data.type === "suggestedSize") {
        setSuggestedShares(data.shares > 0 ? data.shares : null);
      }
    };

    worker.onerror = () => {
      setIsRunning(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Filter trades by strategy
  const filteredTrades = input.strategyFilter
    ? input.historicalTrades.filter(
        (t) => t.strategy_id === input.strategyFilter
      )
    : input.historicalTrades;

  const tradeCount = filteredTrades.length;
  const hasEnoughData = tradeCount >= 10;

  // Debounced simulation trigger
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (tradeCount === 0) {
      setResult(null);
      setSuggestedShares(null);
      setIsRunning(false);
      return;
    }

    setIsRunning(true);

    debounceRef.current = setTimeout(() => {
      if (!workerRef.current) return;

      const returns = filteredTrades.map((t) => t.pnl_percent / 100);
      const ruinThresholdFraction = input.ruinThreshold / 100;

      // Post the simulation run message
      workerRef.current.postMessage({
        type: "run",
        returns,
        startingBalance: input.startingBalance,
        numTrades: 100,
        iterations: 1000,
        ruinThreshold: ruinThresholdFraction,
      });

      // After posting run, also request the suggested size (if we have entry/stop)
      if (input.entry && input.entry > 0) {
        workerRef.current.postMessage({
          type: "findSuggestedSize",
          returns,
          startingBalance: input.startingBalance,
          numTrades: 100,
          iterations: 1000,
          maxRuinProb: input.ruinThreshold,
          entry: input.entry,
          stopLoss: input.stopLoss,
          direction: input.direction,
          commission: input.commission,
        });
      } else {
        setSuggestedShares(null);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    // Rebuild dependency list from primitives to avoid re-running on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filteredTrades),
    input.startingBalance,
    input.entry,
    input.stopLoss,
    input.direction,
    input.ruinThreshold,
    input.commission,
    // tradeCount included via filteredTrades stringify
  ]);

  return {
    result,
    suggestedShares,
    isRunning,
    tradeCount,
    hasEnoughData,
  };
}
