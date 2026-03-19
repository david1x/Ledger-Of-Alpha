---
phase: 08-trading-tools-hub
plan: "01"
subsystem: tools-hub
tags: [calculators, tools, navbar, math-library]
dependency_graph:
  requires: []
  provides: [tools-hub-foundation, math-library, tools-page-shell]
  affects: [components/Navbar.tsx]
tech_stack:
  added: []
  patterns: [pure-math-library, tab-shell-with-searchparams, suspense-wrapper, click-to-copy]
key_files:
  created:
    - lib/calculators.ts
    - app/tools/page.tsx
    - components/tools/DrawdownCalculator.tsx
    - components/tools/KellyCalculator.tsx
    - components/tools/FibCalculator.tsx
    - components/tools/RRCalculator.tsx
    - components/tools/GrowthCalculator.tsx
    - components/tools/CorrelationMatrix.tsx
  modified:
    - components/Navbar.tsx
decisions:
  - "Tab default is 'rr' (Risk/Reward) as specified by plan context"
  - "Stub components use 'Coming soon' messaging so Plans 02/03 can fill them in independently"
  - "FibCalculator uses copiedLabel string key per row instead of boolean to support multiple simultaneous copy states"
  - "Retracement levels styled sky-400, extension levels violet-400 for visual distinction"
metrics:
  duration_seconds: 227
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 1
---

# Phase 8 Plan 01: Tools Hub Foundation Summary

**One-liner:** Pure math library + /tools page shell with 6-tab navigation (3 working calculators, 3 stubs) + Wrench link in sidebar.

## What Was Built

### lib/calculators.ts
Pure TypeScript math module with six deterministic functions:
- `drawdownRecovery(drawdownPct)` — required gain to recover from loss
- `kellyFraction(winRatePct, avgWin, avgLoss)` — Kelly Criterion, clamped [0, 100]
- `fibonacciLevels(high, low)` — 7 retracements + 3 extensions with metadata
- `compoundGrowthCurve(startBalance, monthlyReturnPct, months)` — month-by-month curve
- `riskReward(entry, stop, target, direction)` — per-share risk/reward and ratios
- `positionSize(accountSize, riskPercent, entry, stop, commission?)` — shares and dollar risk

### app/tools/page.tsx
Tab shell following the settings page Suspense pattern:
- `useSearchParams().get("tab")` defaulting to `"rr"`
- 6 tabs: R:R, Compound Growth, Drawdown Recovery, Kelly Criterion, Fibonacci Levels, Correlation Matrix
- Emerald active border tab styling consistent with settings page
- Imports all 6 calculator components from `@/components/tools/`

### components/Navbar.tsx
- Added `Wrench` to the lucide-react import
- Added `{ href: "/tools", label: "Tools", icon: Wrench }` as last NAV_LINKS entry

### Working Calculators

**DrawdownCalculator.tsx**
- Single number input (default 20%)
- Live useMemo result showing "Required recovery: X.XX%"
- Reference table for [5, 10, 20, 25, 30, 50, 75]% with emerald row highlight + arrow marker when input matches

**KellyCalculator.tsx**
- Three inputs: win rate %, avg win $, avg loss $ (defaults: 55%, $200, $100)
- Outputs Full Kelly (emerald), Half Kelly (sky), Quarter Kelly (violet) prominently
- Amber warning when Full Kelly > 25%; red warning when edge is negative

**FibCalculator.tsx**
- High and low price inputs (defaults: 100, 80)
- Retracement rows in sky-400, extension rows in violet-400
- Dashed separator + "Extensions" label between sections
- Click-to-copy each price with 1.5s "Copied" feedback via Check icon

### Stub Components (Plans 02/03 targets)
- `RRCalculator.tsx` — "Risk/Reward Calculator — Coming soon"
- `GrowthCalculator.tsx` — "Compound Growth Calculator — Coming soon"
- `CorrelationMatrix.tsx` — "Correlation Matrix — Coming soon"

## Verification

- `npm run build` passes with no TypeScript errors
- `/tools` appears in build output at 4.03 kB
- All 8 new files present on disk
- Both task commits confirmed in git history

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files confirmed present. Both commits (45e67d4, 058ed52) confirmed in git log.
