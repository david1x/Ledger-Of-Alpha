/**
 * Pure math functions for the Trading Tools Hub calculators.
 * No React, no side effects — all functions are deterministic.
 */

/**
 * Calculate the required gain percentage to recover from a drawdown.
 * Formula: ((1 / (1 - d)) - 1) * 100 where d = drawdownPct / 100
 */
export function drawdownRecovery(drawdownPct: number): number {
  if (drawdownPct <= 0) return 0;
  if (drawdownPct >= 100) return Infinity;
  const d = drawdownPct / 100;
  return ((1 / (1 - d)) - 1) * 100;
}

/**
 * Calculate the Kelly Criterion optimal position size percentage.
 * Formula: (b * p - q) / b * 100
 * where b = avgWin/avgLoss, p = winRate, q = 1 - p
 * Returns 0 if any input is invalid or edge is negative.
 * Clamped to [0, 100].
 */
export function kellyFraction(winRatePct: number, avgWin: number, avgLoss: number): number {
  if (winRatePct <= 0 || winRatePct >= 100 || avgWin <= 0 || avgLoss <= 0) return 0;
  const p = winRatePct / 100;
  const q = 1 - p;
  const b = avgWin / avgLoss;
  const kelly = ((b * p - q) / b) * 100;
  return Math.max(0, Math.min(100, kelly));
}

/**
 * Calculate Fibonacci retracement and extension levels.
 * Retracement ratios: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
 * Extension ratios: 127.2%, 161.8%, 261.8%
 */
export function fibonacciLevels(
  high: number,
  low: number
): { label: string; price: number; isExtension: boolean }[] {
  const range = high - low;

  const retracements = [
    { label: "0%", ratio: 0 },
    { label: "23.6%", ratio: 0.236 },
    { label: "38.2%", ratio: 0.382 },
    { label: "50%", ratio: 0.5 },
    { label: "61.8%", ratio: 0.618 },
    { label: "78.6%", ratio: 0.786 },
    { label: "100%", ratio: 1.0 },
  ].map(({ label, ratio }) => ({
    label,
    price: high - range * ratio,
    isExtension: false,
  }));

  const extensions = [
    { label: "127.2%", ratio: 1.272 },
    { label: "161.8%", ratio: 1.618 },
    { label: "261.8%", ratio: 2.618 },
  ].map(({ label, ratio }) => ({
    label,
    price: low - range * (ratio - 1),
    isExtension: true,
  }));

  return [...retracements, ...extensions];
}

/**
 * Generate a compound growth curve over a given number of months.
 * Returns an array of { month, balance } pairs starting at month 0.
 */
export function compoundGrowthCurve(
  startBalance: number,
  monthlyReturnPct: number,
  months: number
): { month: number; balance: number }[] {
  const rate = monthlyReturnPct / 100;
  const result: { month: number; balance: number }[] = [];
  for (let i = 0; i <= months; i++) {
    result.push({
      month: i,
      balance: startBalance * Math.pow(1 + rate, i),
    });
  }
  return result;
}

/**
 * Calculate risk/reward metrics for a trade setup.
 */
export function riskReward(
  entry: number,
  stopLoss: number,
  takeProfit: number,
  direction: "long" | "short"
): {
  riskPerShare: number;
  rewardPerShare: number;
  rrRatio: number;
  riskPct: number;
  rewardPct: number;
} {
  const riskPerShare = Math.abs(entry - stopLoss);
  const rewardPerShare = Math.abs(takeProfit - entry);
  const rrRatio = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  const riskPct = entry > 0 ? (riskPerShare / entry) * 100 : 0;
  const rewardPct = entry > 0 ? (rewardPerShare / entry) * 100 : 0;

  return { riskPerShare, rewardPerShare, rrRatio, riskPct, rewardPct };
}

/**
 * Calculate position size based on account risk parameters.
 * shares = floor(dollarRisk / stopDistance)
 */
export function positionSize(
  accountSize: number,
  riskPercent: number,
  entry: number,
  stopLoss: number,
  commission: number = 0
): {
  dollarRisk: number;
  shares: number;
  positionValue: number;
} {
  const dollarRisk = accountSize * (riskPercent / 100);
  const stopDistance = Math.abs(entry - stopLoss);
  if (stopDistance === 0 || entry === 0) {
    return { dollarRisk, shares: 0, positionValue: 0 };
  }
  const adjustedRisk = Math.max(0, dollarRisk - commission);
  const shares = Math.floor(adjustedRisk / stopDistance);
  const positionValue = shares * entry;
  return { dollarRisk, shares, positionValue };
}
