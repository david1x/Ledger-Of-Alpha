# Research: Phase 06 Features

## 1. Monte Carlo Risk Simulations
Monte Carlo simulations help traders understand the "sequence risk" of their strategy—how a string of losses at the wrong time could lead to ruin, even if the strategy is profitable long-term.

### Best Practices for Trading Journals
*   **Bootstrap Resampling**: Instead of just using Win Rate and Average Win/Loss (which assumes a normal distribution), use **actual historical trade returns**. Randomly shuffle the list of P&L percentages from the user's history for each simulation path.
*   **Fractional Position Sizing**: Model the equity curve using the user's `risk_per_trade` (e.g., 1% of current balance) to show the power of compounding and the impact of drawdowns.
*   **Ruin Probability**: Define "Ruin" as a specific drawdown threshold (typically 50% or 100%). It is much harder to recover from a 50% loss (requires 100% gain) than a 10% loss (requires 11% gain).

### Proposed Algorithm (TypeScript)
```typescript
interface SimulationResult {
  medianFinalBalance: number;
  maxDrawdown: number;
  probOfRuin: number; // % of paths hitting threshold
  probOfProfit: number;
}

function runSimulation(
  returns: number[], // Array of historical P&L % (e.g., [0.02, -0.01, 0.05])
  startingBalance: number,
  numTrades: number = 100,
  iterations: number = 5000,
  ruinThreshold: number = 0.5
): SimulationResult {
  let ruinedCount = 0;
  const finalBalances: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    let balance = startingBalance;
    let peak = startingBalance;
    let maxDD = 0;
    let ruined = false;

    for (let t = 0; t < numTrades; t++) {
      // Bootstrap: pick a random return from history
      const randomReturn = returns[Math.floor(Math.random() * returns.length)];
      balance *= (1 + randomReturn);
      
      if (balance > peak) peak = balance;
      const dd = (peak - balance) / peak;
      if (dd > maxDD) maxDD = dd;
      if (dd >= ruinThreshold) ruined = true;
      if (balance <= 0) break;
    }
    
    if (ruined) ruinedCount++;
    finalBalances.push(balance);
  }
  
  // Calculate stats from finalBalances and ruinedCount...
}
```

---

## 2. Heuristic Pattern Matching
Rather than complex neural networks, trading journals benefit from **multi-dimensional frequency analysis** to identify "Edges."

### Key Dimensions to Analyze
1.  **Temporal**: Day of Week, Trading Session (Asia/London/NY based on UTC).
2.  **Asset**: Symbol volatility and hit rates.
3.  **Setup**: Performance of specific tags (e.g., "Bull Flag", "Mean Reversion").
4.  **Duration**: Correlation between hold time and profitability.

### Simple Heuristic Engine
Identify "High Probability Traits" by filtering for intersections where:
*   **Win Rate** > 60%
*   **Profit Factor** > 2.0
*   **Sample Size (N)** > 10 trades

**Example Insight**: *"Your 'Bull Flag' setup on 'TSLA' has an 80% win rate during the NY Session (9:30 AM - 11:30 AM EST), but only 30% on Fridays."*

---

## 3. Discord/Email Alert System Architecture
Next.js + SQLite requires a balance between real-time responsiveness and serverless constraints.

### Architecture Components
1.  **Alert Definition**:
    *   `alerts` table: `id`, `user_id`, `symbol`, `condition` (above/below/percent_move), `target_value`, `active`, `last_triggered`.
2.  **Trigger Mechanisms**:
    *   **Manual Trigger**: User manually enters a trade -> notify Discord immediately using Next.js `after()` or `event.waitUntil()`.
    *   **Price Alerts (Polling)**: A background worker (or Vercel Cron) fetches latest prices for all *active* alert symbols every 1–5 minutes.
    *   **Logic**: If `current_price` meets `condition` relative to `target_value`, mark alert as `active = 0` (if one-shot) and dispatch notifications.
3.  **Dispatchers**:
    *   **Discord**: Webhook POST request (already partially implemented in `/api/alerts/trigger`).
    *   **Email**: `nodemailer` using the existing `lib/email.ts` utility.

### SQLite Concurrency Tip
Since SQLite can have "database is locked" errors during heavy write/read contention (e.g., price poller updating 50 alerts at once), ensure **WAL (Write-Ahead Logging)** mode is enabled (current `lib/db.ts` already does this). Use a single background process or a dedicated queue to avoid multiple instances fighting for the lock.
