---
phase: 09-monte-carlo-entry-integration
plan: "01"
subsystem: monte-carlo
tags: [web-worker, simulation, react-hook, position-sizing, risk-analysis]
dependency_graph:
  requires: []
  provides: [mc-worker, use-monte-carlo-hook, monte-carlo-preview-component]
  affects: [components/TradeModal.tsx]
tech_stack:
  added: []
  patterns: [web-worker-offthread, debounced-hook, binary-search-sizing, collapsible-panel]
key_files:
  created:
    - public/mc-worker.js
    - lib/use-monte-carlo.ts
    - components/MonteCarloPreview.tsx
  modified: []
decisions:
  - "Copied runMonteCarlo logic verbatim into mc-worker.js (plain JS) because Web Workers cannot import TypeScript modules"
  - "Binary search scales historical % returns by (entry * shares / balance) to correctly model per-share ruin risk at each candidate size"
  - "suggestedShares = 0 is treated as null (no suggestion displayed) when even 1 share exceeds threshold"
  - "JSON.stringify(filteredTrades) used as useEffect dependency to avoid stale closure while keeping the dep array stable"
metrics:
  duration: 160s
  completed: "2026-03-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 9 Plan 01: Monte Carlo Engine and Preview Panel Summary

Web Worker Monte Carlo simulation engine with React hook and collapsible risk preview panel — runs 1K-iteration simulation off main thread with binary search position sizing and three-level severity indicators.

## What Was Built

### public/mc-worker.js
Plain-JS Web Worker (must be static, not TypeScript) containing a full copy of the `runMonteCarlo` function from `lib/simulation.ts`. Handles two message types:
- `{ type: 'run', ... }` — runs simulation, posts `{ type: 'result', ...SimulationResult }`
- `{ type: 'findSuggestedSize', ... }` — binary searches 1..maxShares for the largest position size keeping ruin probability under the user threshold, posts `{ type: 'suggestedSize', shares }`

### lib/use-monte-carlo.ts
`useMonteCarloPreview` hook that:
1. Creates a Worker on mount, terminates on unmount
2. Filters `historicalTrades` by `strategyFilter` if set
3. Debounces 500ms before posting to worker
4. Returns `{ result, suggestedShares, isRunning, tradeCount, hasEnoughData }`

### components/MonteCarloPreview.tsx
Collapsible panel component with:
- Header with Activity icon and collapse toggle
- Mini risk badge (Low risk / Moderate risk / High risk: X.X%) always visible even when collapsed
- Risk warning banners inside expanded panel (yellow = moderate, red = high)
- Low-data warning when `tradeCount < 10`
- 2x2 results grid: Median Outcome, Prob. of Profit, Max Drawdown, Ruin Probability — with pulse animation while `isRunning`
- Position size row: MC Suggested vs current shares with delta text and Apply button
- Strategy filter dropdown showing per-strategy trade counts and `(min 5)` disabled guard

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. Worker binary search scales the historical pnl_percent returns by `(entry * shares / startingBalance)` rather than using raw returns — this correctly models how position size affects ruin probability (larger position = larger % swing per trade).
2. `JSON.stringify(filteredTrades)` used as a useEffect dependency to give the hook a stable reference while still reacting to trade array content changes.
3. `suggestedShares = 0` treated as `null` in component — "Apply" row hidden if even 1 share exceeds the threshold rather than suggesting 0 shares.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| public/mc-worker.js | FOUND |
| lib/use-monte-carlo.ts | FOUND |
| components/MonteCarloPreview.tsx | FOUND |
| Commit 40438ae (worker + hook) | FOUND |
| Commit 8e729e2 (component) | FOUND |
| TypeScript no errors | PASSED |
