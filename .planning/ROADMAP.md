# Ledger Of Alpha Roadmap

## [v1.0.0 (SHIPPED)](.planning/milestones/v1.0.0-ROADMAP.md) - Core Architecture, Journaling, & Analytics

---

## v2.0 — Intelligence & Automation

**Goal:** Transform Ledger Of Alpha from a manual journal into an intelligent trading companion through AI-powered analysis, integrated risk modeling, broker automation, and a trading tools hub.

## Phases

- [ ] **Phase 8: Trading Tools Hub** - Six calculators at a dedicated /tools page; zero external dependencies
- [ ] **Phase 9: Monte Carlo Entry Integration** - Inline risk simulation and position sizing inside the trade entry modal
- [ ] **Phase 10: AI Chart Pattern Recognition** - GPT-4o screenshot analysis with similar trade finder and pattern performance stats
- [ ] **Phase 11: IBKR Broker Sync** - Client Portal REST integration with live positions, manual sync, and deduplication

## Phase Details

### Phase 8: Trading Tools Hub
**Goal**: Traders can access six standalone calculators from a dedicated /tools page in the navigation
**Depends on**: Nothing (first phase of v2.0; no new external dependencies)
**Requirements**: TOOLS-01, TOOLS-02, TOOLS-03, TOOLS-04, TOOLS-05, TOOLS-06, TOOLS-07
**Success Criteria** (what must be TRUE):
  1. User can navigate to /tools from the sidebar and see all six calculators on one page
  2. User can calculate risk/reward ratio by entering entry, stop, and target prices and see a visual display of the levels
  3. User can project account growth by entering starting balance, return rate, and period and see a compound growth curve
  4. User can enter a drawdown percentage and see exactly what gain is required to recover to breakeven
  5. User can enter a win rate, average win, and average loss and receive an optimal position size percentage via Kelly Criterion
  6. User can enter a high and low price and see all Fibonacci retracement and extension levels
  7. User can select traded symbols and see a color-coded correlation matrix computed from historical OHLCV data
**Plans:** 2/3 plans executed

Plans:
- [ ] 08-01-PLAN.md — Math library, page shell, navbar link, Drawdown/Kelly/Fibonacci calculators
- [ ] 08-02-PLAN.md — R:R Calculator with price ladder and Compound Growth with Recharts chart
- [ ] 08-03-PLAN.md — Correlation Matrix with symbol picker and sequential OHLCV fetching

### Phase 9: Monte Carlo Entry Integration
**Goal**: Traders see live risk simulation results and position size suggestions directly inside the trade entry modal before submitting a trade
**Depends on**: Phase 8
**Requirements**: MC-01, MC-02, MC-03, MC-04
**Success Criteria** (what must be TRUE):
  1. User sees a ruin probability warning with a red indicator inside the trade modal when the proposed risk exceeds a safe threshold
  2. User sees median outcome and probability of profit computed from their historical trades without leaving the trade entry modal
  3. User sees a suggested position size derived from their historical performance for the account the trade is assigned to
  4. User can filter the simulation by strategy or setup type and see the preview update to reflect only trades matching that filter
**Plans**: TBD

### Phase 10: AI Chart Pattern Recognition
**Goal**: Traders can upload a chart screenshot to a trade and receive AI-identified pattern labels with confidence scores, and find past trades with similar patterns
**Depends on**: Phase 9
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. User can upload a chart screenshot from the trade view and receive a structured analysis result (pattern type, confidence score) without leaving the trade record
  2. User sees at least one identified chart pattern (e.g. head and shoulders, flag, wedge) with a confidence percentage on the analysis result
  3. The analysis result is stored and remains visible when the user reopens the trade later
  4. User can search or filter trades by AI-detected pattern type and see only trades matching that pattern
  5. User can view a summary table showing win rate and average P&L grouped by pattern type across all analyzed trades
**Plans**: TBD

### Phase 11: IBKR Broker Sync
**Goal**: Traders can connect their IBKR account to Ledger Of Alpha, trigger a manual sync, and view live open positions alongside their journal data
**Depends on**: Phase 10
**Requirements**: IBKR-01, IBKR-02, IBKR-03, IBKR-04, IBKR-05
**Success Criteria** (what must be TRUE):
  1. User can enter IBKR Client Portal gateway URL and account credentials in the Settings Broker tab and save the configuration
  2. User can click "Sync Now" and see new IBKR-executed trades appear in the trades list without duplicates, even when synced multiple times on the same day
  3. User can view a live open positions panel showing each open position from IBKR with its current unrealized P&L
  4. User can see the timestamp of the last successful sync and a clear error message when the gateway is unreachable
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Trading Tools Hub | 2/3 | In Progress|  |
| 9. Monte Carlo Entry Integration | 0/? | Not started | — |
| 10. AI Chart Pattern Recognition | 0/? | Not started | — |
| 11. IBKR Broker Sync | 0/? | Not started | — |

---
*Roadmap created: 2026-03-15 for v2.0 Intelligence & Automation*
*Phase numbering continues from v1.0.0 (phases 1-7)*
