---
phase: 21-summary-stats-bar
plan: 01
subsystem: ui
tags: [recharts, sparklines, privacy, trades, filters, stats]

# Dependency graph
requires:
  - phase: 19-tradesshell-refactor
    provides: TradesShell with filteredTrades, allTrades, accountSize state and PrivacyProvider/usePrivacy hook
  - phase: 20-filter-system-saved-views
    provides: applyFilter() function producing filteredTrades from all active filters
provides:
  - SummaryStatsBar component with three stat cards (Cumulative Return, P/L Ratio, Win %) and recharts sparklines
  - Replacement of AccountBanner on trades page with filter-aware stats
affects: [22-mistake-tagging, trades-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - recharts AreaChart sparklines with unique gradient IDs (statGradCumulative, statGradPL, statGradWin)
    - rolling 10-trade window for P/L ratio and win rate sparklines
    - privacy masking via usePrivacy() called inside leaf component (not parent shell)

key-files:
  created:
    - components/trades/SummaryStatsBar.tsx
  modified:
    - components/trades/TradesShell.tsx

key-decisions:
  - "SummaryStatsBar calls usePrivacy() internally — TradesShell no longer needs the usePrivacy import"
  - "P/L Ratio sparkline uses neutral blue (#3b82f6) to avoid confusing color flips as rolling ratio crosses 1.0"
  - "Rolling 10-trade window for sparklines gives local trend signal without being too noisy"

patterns-established:
  - "Sparkline pattern: ResponsiveContainer > AreaChart with no axes/tooltip/grid, unique gradient ID per instance, isAnimationActive=false"

requirements-completed: [STAT-01, STAT-02, STAT-03]

# Metrics
duration: 15min
completed: 2026-03-21
---

# Phase 21 Plan 01: Summary Stats Bar Summary

**Three filter-aware stat cards (Cumulative Return, P/L Ratio, Win %) with recharts sparklines replace AccountBanner on the trades page**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-21T15:30:00Z
- **Completed:** 2026-03-21T15:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created SummaryStatsBar with three stat cards showing Cumulative Return, P/L Ratio, and Win %
- Each card has a decorative recharts AreaChart sparkline (rolling 10-trade window for ratio/win rate)
- Stats respond to all active filters via filteredTrades prop
- Privacy masking via usePrivacy() masks all numbers while keeping sparkline shapes visible
- Filter label "Based on X of Y trades" appears when filters narrow results
- Full edge case handling: zero trades, all winners, all losers, single trade

## Task Commits

1. **Task 1: Create SummaryStatsBar component** - `dc901ca` (feat)
2. **Task 2: Wire SummaryStatsBar into TradesShell** - `76caaa6` (feat)

## Files Created/Modified
- `components/trades/SummaryStatsBar.tsx` - New stat cards component with sparklines and privacy masking
- `components/trades/TradesShell.tsx` - Replaced AccountBanner import/usage with SummaryStatsBar; removed unused usePrivacy import

## Decisions Made
- SummaryStatsBar calls `usePrivacy()` internally so TradesShell no longer needs the import — cleaner separation of concerns
- P/L Ratio sparkline uses neutral blue (#3b82f6) rather than color-coding: the rolling ratio crosses 1.0 frequently, making green/red flips more confusing than informative
- Rolling 10-trade window for P/L ratio and win rate sparklines provides local trend signal without excessive noise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.next` build directory was locked by a running dev server during Task 2 verification. Used `npx tsc --noEmit` for type checking, then ran `npm run build` which succeeded with "Compiled successfully" (only pre-existing warnings, no errors).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SummaryStatsBar is live on the trades page, replacing AccountBanner
- AccountBanner.tsx is untouched and still works on journal and other pages
- Phase 22 (mistake tagging / trade-mistake junction data) can proceed independently

---
*Phase: 21-summary-stats-bar*
*Completed: 2026-03-21*
