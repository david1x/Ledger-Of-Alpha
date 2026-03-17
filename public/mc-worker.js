/**
 * Monte Carlo Web Worker
 * Runs simulation off main thread to avoid blocking UI.
 *
 * Message types received:
 *   { type: 'run', returns, startingBalance, numTrades, iterations, ruinThreshold }
 *   { type: 'findSuggestedSize', returns, startingBalance, numTrades, iterations,
 *     maxRuinProb, entry, stopLoss, direction, commission }
 *
 * Message types posted:
 *   { type: 'result', ...SimulationResult }
 *   { type: 'suggestedSize', shares: number }
 */

/**
 * Run Monte Carlo simulation.
 * Copied from lib/simulation.ts (workers cannot import TS modules).
 *
 * @param {number[]} returns - Array of historical P&L % (e.g., [0.02, -0.01, 0.05])
 * @param {number} startingBalance
 * @param {number} numTrades - Number of trades to project forward
 * @param {number} iterations - Number of simulation paths
 * @param {number} ruinThreshold - Drawdown fraction that constitutes ruin (e.g., 0.5 = 50%)
 * @returns {object} SimulationResult
 */
function runMonteCarlo(returns, startingBalance, numTrades, iterations, ruinThreshold) {
  if (returns.length === 0) {
    return {
      medianFinalBalance: startingBalance,
      maxDrawdown: 0,
      probOfRuin: 0,
      probOfProfit: 0,
      paths: [],
      distribution: [],
    };
  }

  let ruinedCount = 0;
  let profitableCount = 0;
  const finalBalances = [];
  const samplePaths = [];
  const maxDrawdowns = [];

  for (let i = 0; i < iterations; i++) {
    let balance = startingBalance;
    let peak = startingBalance;
    let maxDD = 0;
    let ruined = false;
    const currentPath = [startingBalance];

    for (let t = 0; t < numTrades; t++) {
      const randomReturn = returns[Math.floor(Math.random() * returns.length)];
      balance *= (1 + randomReturn);

      if (i < 50) {
        currentPath.push(balance);
      }

      if (balance > peak) peak = balance;
      const dd = (peak - balance) / peak;
      if (dd > maxDD) maxDD = dd;

      if (dd >= ruinThreshold || balance <= 0) {
        ruined = true;
        if (balance <= 0) {
          balance = 0;
          break;
        }
      }
    }

    if (ruined) ruinedCount++;
    if (balance > startingBalance) profitableCount++;
    finalBalances.push(balance);
    maxDrawdowns.push(maxDD);
    if (i < 50) {
      samplePaths.push(currentPath);
    }
  }

  // Calculate statistics
  finalBalances.sort((a, b) => a - b);
  const medianFinalBalance = finalBalances[Math.floor(finalBalances.length / 2)];
  const avgMaxDD = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;

  // Create distribution histogram (20 bins)
  const binCount = 20;
  const min = finalBalances[0];
  const max = finalBalances[finalBalances.length - 1];
  const binSize = (max - min) / binCount || 1;
  const distribution = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binSize;
    const binEnd = binStart + binSize;
    const count = finalBalances.filter(b => b >= binStart && b < binEnd).length;
    distribution.push({
      balance: Math.round(binStart + binSize / 2),
      count,
    });
  }

  return {
    medianFinalBalance,
    maxDrawdown: avgMaxDD,
    probOfRuin: (ruinedCount / iterations) * 100,
    probOfProfit: (profitableCount / iterations) * 100,
    paths: samplePaths,
    distribution,
  };
}

/**
 * Binary search for the largest share count that keeps ruin probability
 * under maxRuinProb (expressed as a percentage, e.g. 5 = 5%).
 *
 * Each candidate share count produces a new "returns" array that accounts
 * for the per-trade dollar P&L expressed as a percentage of account size.
 * We re-scale the historical % returns to reflect the position size.
 *
 * Approach: For a given share count, the actual dollar P&L per trade is:
 *   pnl_dollar = pnl_percent * entry * shares
 * The pnl as a fraction of current balance (starting balance for simplicity):
 *   adjusted_return = pnl_percent * (entry * shares / startingBalance)
 *
 * Binary search from 1..maxShares to find largest shares where ruinProb < maxRuinProb.
 */
function findSuggestedSize(
  returns,
  startingBalance,
  numTrades,
  iterations,
  maxRuinProb,
  entry,
  stopLoss,
  direction,
  commission
) {
  if (!entry || entry <= 0 || returns.length === 0) {
    return 0;
  }

  const maxShares = Math.max(1, Math.floor(startingBalance / entry));
  const ruinThreshold = maxRuinProb / 100;

  // Quick check: does 1 share pass?
  const scaledReturnsForOne = returns.map(r => r * (entry * 1 / startingBalance));
  const resultForOne = runMonteCarlo(scaledReturnsForOne, startingBalance, numTrades, iterations, ruinThreshold);
  if (resultForOne.probOfRuin >= maxRuinProb) {
    return 0; // Even 1 share exceeds ruin threshold
  }

  // Quick check: does max pass?
  const scaledReturnsForMax = returns.map(r => r * (entry * maxShares / startingBalance));
  const resultForMax = runMonteCarlo(scaledReturnsForMax, startingBalance, numTrades, iterations, ruinThreshold);
  if (resultForMax.probOfRuin < maxRuinProb) {
    return maxShares; // Max shares still under threshold
  }

  // Binary search
  let lo = 1;
  let hi = maxShares;
  let best = 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const scaledReturns = returns.map(r => r * (entry * mid / startingBalance));
    const result = runMonteCarlo(scaledReturns, startingBalance, numTrades, iterations, ruinThreshold);

    if (result.probOfRuin < maxRuinProb) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

// Handle messages from the main thread
self.onmessage = function (event) {
  const data = event.data;

  if (!data || !data.type) {
    // Legacy format: backwards-compatible run message without explicit type
    const { returns, startingBalance, numTrades, iterations, ruinThreshold } = data;
    const result = runMonteCarlo(
      returns || [],
      startingBalance || 10000,
      numTrades || 100,
      iterations || 1000,
      ruinThreshold || 0.5
    );
    self.postMessage({ type: 'result', ...result });
    return;
  }

  if (data.type === 'run') {
    const { returns, startingBalance, numTrades, iterations, ruinThreshold } = data;
    const result = runMonteCarlo(
      returns || [],
      startingBalance || 10000,
      numTrades || 100,
      iterations || 1000,
      ruinThreshold || 0.5
    );
    self.postMessage({ type: 'result', ...result });
    return;
  }

  if (data.type === 'findSuggestedSize') {
    const {
      returns,
      startingBalance,
      numTrades,
      iterations,
      maxRuinProb,
      entry,
      stopLoss,
      direction,
      commission,
    } = data;

    const shares = findSuggestedSize(
      returns || [],
      startingBalance || 10000,
      numTrades || 100,
      iterations || 1000,
      maxRuinProb || 5,
      entry || 0,
      stopLoss || 0,
      direction || 'long',
      commission || 0
    );

    self.postMessage({ type: 'suggestedSize', shares });
    return;
  }
};
