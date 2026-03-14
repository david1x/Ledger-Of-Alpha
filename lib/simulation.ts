export interface SimulationResult {
  medianFinalBalance: number;
  maxDrawdown: number;
  probOfRuin: number; // % of paths hitting threshold
  probOfProfit: number;
  paths: number[][]; // 50 sample paths for visualization
  distribution: { balance: number; count: number }[]; // for histogram
}

export function runMonteCarlo(
  returns: number[], // Array of historical P&L % (e.g., [0.02, -0.01, 0.05])
  startingBalance: number,
  numTrades: number = 100,
  iterations: number = 5000,
  ruinThreshold: number = 0.5
): SimulationResult {
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
  const finalBalances: number[] = [];
  const samplePaths: number[][] = [];
  const maxDrawdowns: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let balance = startingBalance;
    let peak = startingBalance;
    let maxDD = 0;
    let ruined = false;
    const currentPath: number[] = [startingBalance];

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
        // Even if ruined, we continue to fill the path for visualization consistency if needed, 
        // but here we just keep the 0 or threshold value
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

  // Create distribution histogram (bins)
  const binCount = 20;
  const min = finalBalances[0];
  const max = finalBalances[finalBalances.length - 1];
  const binSize = (max - min) / binCount;
  const distribution: { balance: number; count: number }[] = [];

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
