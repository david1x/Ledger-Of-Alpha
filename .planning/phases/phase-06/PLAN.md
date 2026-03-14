# Phase 06 Plan: Risk Management & AI Insights

## Goal
Implement predictive risk modeling, heuristic-based edge detection, and a multi-channel alert system.

---

## Proposed Changes

### 1. Monte Carlo Risk Simulator (Wave 1)
- **lib/simulation.ts:** Implement the bootstrap resampling algorithm.
  - Shuffle actual historical trade % returns.
  - Support 5,000+ iterations for statistical significance.
  - Calculate: Median Final Balance, Max Drawdown, Risk of Ruin (50% threshold).
- **components/dashboard/RiskSimulator.tsx:** New large-grid widget.
  - Visualize 50 random sample paths using `recharts` AreaChart.
  - Histogram of final balance distribution.
  - "Ruin Probability" gauge.

### 2. AI Edge Discovery Engine (Wave 1)
- **lib/insight-engine.ts:** Implementation of the multi-dimensional heuristic analysis.
  - Scan trades for intersections: (Symbol + Time), (Tag + Weekday), (Session + Direction).
  - Score setups using Win Rate > 60% and Profit Factor > 2.0.
- **components/dashboard/AIInsightsWidget.tsx:** 
  - Dynamic "Edge Cards" (e.g., "🔥 High Edge Found: Buying TSLA on Tuesdays has a 75% Win Rate").

### 3. Multi-Channel Alerts System (Wave 2)
- **Background Worker:** Implement a polling route (`/api/alerts/check-prices`) that fetches latest prices and triggers active alerts.
- **lib/notifications.ts:** Centralize Discord and Email dispatch logic.
- **UI Updates:** Add "Email Notification" and "Discord Hook" toggles to the Alert creation modal.

### 4. Advanced Multi-Broker Import (Wave 2)
- **lib/broker-parsers.ts:** Regex and mapping logic for:
  - ThinkOrSwim (TOS) CSV
  - Interactive Brokers (IBKR) Flex Query
  - Robinhood (Basic CSV)
- **app/api/trades/import/multi/route.ts:** Unified import endpoint that auto-detects broker format based on column headers.

---

## Verification Plan

### Automated Tests
- [ ] **Simulation Logic:** `tests/simulation.test.ts` to verify bootstrap distribution matches expected median returns.
- [ ] **Insight Engine:** `tests/insights.test.ts` to confirm correct identification of sample "Edges" from mock trade data.
- [ ] **Broker Parsers:** Test files for each supported broker CSV format.

### Manual Verification
- [ ] **Sim Visualization:** Confirm 50 lines render correctly without lagging the UI.
- [ ] **Alert Trigger:** Manually trigger a price alert and verify both Discord message and Email are received.
- [ ] **Dashboard Integration:** Verify new widgets respect the "Edit Layout" and "Hidden" state settings.
