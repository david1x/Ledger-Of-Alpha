---
phase: 08-trading-tools-hub
plan: 02
subsystem: tools
tags: [calculator, recharts, visualization, risk-reward, compound-growth]
dependency_graph:
  requires: [08-01]
  provides: [rr-calculator, growth-calculator]
  affects: [app/tools/page.tsx]
tech_stack:
  added: []
  patterns: [recharts-area-chart, collapsible-accordion, price-ladder-css, useMemo-live-recalc]
key_files:
  created: []
  modified:
    - components/tools/RRCalculator.tsx
    - components/tools/GrowthCalculator.tsx
decisions:
  - "Price ladder uses CSS absolute positioning with bottom% derived from normalized price range — no SVG/canvas needed"
  - "Position sizing accordion collapsed by default, opened on demand"
  - "GrowthCalculator imports TOOLTIP_STYLE/GRID_STROKE/TICK from ChartWidgets for visual consistency with dashboard"
metrics:
  duration: 143s
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  completed_date: "2026-03-16"
---

# Phase 8 Plan 02: R:R and Growth Calculators Summary

**One-liner:** Vertical CSS price ladder for R:R visualization and Recharts area chart for compound growth, both with live recalculation.

## What Was Built

### Task 1: R:R Calculator (`components/tools/RRCalculator.tsx`)

Replaced stub with full implementation featuring:

- **Direction toggle** (Long/Short) styled as segmented button pair — emerald for long, red for short
- **Price ladder** — 300px container with CSS `position: absolute` + `bottom: X%` for each price line. Colors: emerald-500 for target, red-500 for stop, slate-400 for entry. Colored zones use `bg-emerald-500/20` and `bg-red-500/20` overlaid between lines.
- **Stats section** — R:R ratio as hero stat (large text), risk/reward per share with percentages in 2-column grid
- **Collapsible position sizing** — ChevronDown/Up accordion, collapsed by default. Expands to show account size + risk % inputs, then dollar risk, dollar reward, recommended shares, position value in a 4-column grid.
- **Live calculation** — `useMemo` on all input changes for both `riskReward()` and `positionSize()` from `lib/calculators.ts`

### Task 2: Growth Calculator (`components/tools/GrowthCalculator.tsx`)

Replaced stub with full implementation featuring:

- **3 inputs** — starting balance ($), monthly return (%), period in months (1–360)
- **Recharts AreaChart** — imports `TOOLTIP_STYLE`, `GRID_STROKE`, `TICK` from `ChartWidgets` for visual consistency. Emerald gradient (`#34d399` at 30% → 0%). X axis shows "Mo N" labels, Y axis abbreviates to $K/$M.
- **Summary stats** — 3-card row: final balance (emerald), total gain $ (+/- formatted), total gain %
- **Live calculation** — `useMemo` calls `compoundGrowthCurve()` from `lib/calculators.ts`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run build` passes (warnings are pre-existing Edge Runtime warnings unrelated to this plan)
- Both components satisfy `min_lines` requirements (RRCalculator ~300 lines, GrowthCalculator ~166 lines)
- All `key_links` satisfied: RRCalculator imports `riskReward, positionSize` from `lib/calculators`, GrowthCalculator imports `compoundGrowthCurve` from `lib/calculators` and `AreaChart` from `recharts`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 09dd254 | feat(08-02): implement R:R calculator with price ladder and position sizing |
| 2 | 43902e0 | feat(08-02): implement compound growth calculator with Recharts area chart |

## Self-Check

Verified files exist and commits are in git log.
