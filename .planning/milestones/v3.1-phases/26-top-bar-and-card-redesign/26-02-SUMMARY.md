---
phase: 26-top-bar-and-card-redesign
plan: 02
subsystem: ui
tags: [dashboard, tailwind, cards, design-system]

# Dependency graph
requires:
  - phase: 26-01
    provides: Top bar redesign and viewport lock established as foundation for card styling pass
provides:
  - Unified rounded-md border card styling across all dashboard card-like elements
  - WidgetCard component with consistent border instead of shadow for definition
  - WeeklyCalendar updated to match card convention
affects: [27-grid-resize, 28-final-polish, any future dashboard widget additions]

# Tech tracking
tech-stack:
  added: []
  patterns: [rounded-md border dark:border-slate-800 border-slate-200 as standard card container, no shadow-sm on cards]

key-files:
  created: []
  modified:
    - components/dashboard/DashboardShell.tsx
    - components/dashboard/WeeklyCalendar.tsx

key-decisions:
  - "All dashboard cards use border for visual definition, not shadow — matches trades page design language"
  - "Export dropdown keeps shadow-2xl (floating overlay) — exempt from card border rule"
  - "Time filter pills and utility group buttons retain rounded-2xl/rounded-xl — these are UI controls, not cards"

patterns-established:
  - "Card container pattern: rounded-md border dark:border-slate-800 border-slate-200 (no shadow-sm)"
  - "Floating overlay pattern: keeps shadow-2xl for depth (export dropdown, popups)"

requirements-completed: [CARD-01, CARD-02, CARD-03]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 26 Plan 02: Card Border Redesign Summary

**All 24 dashboard widget cards and card-like elements migrated to rounded-md border dark:border-slate-800 convention, eliminating rounded-2xl and shadow-sm in favor of border-based card definition matching the trades page design language**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T17:00:00Z
- **Completed:** 2026-03-22T17:08:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- WidgetCard component updated to unified `rounded-md border dark:border-slate-800 border-slate-200` — all 24 widgets inherit this through the single wrapper
- All standalone card-like elements (empty state, hidden widgets panel, open trades wrapper, daily loss warning) updated to `rounded-md` with no `shadow-sm`
- Export dropdown updated to `rounded-md` while keeping `shadow-2xl` for floating overlay depth
- Hidden widget restore buttons updated from `rounded-xl` to `rounded-md`
- WeeklyCalendar outer container, day cells, and day popup all updated to `rounded-md` with border
- Confirmed no `recent-trades` widget exists in ALL_WIDGETS (CARD-02 already satisfied)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update WidgetCard and all DashboardShell card-like elements** - `80f1085` (feat)
2. **Task 2: Update WeeklyCalendar styling to match new card conventions** - `3168126` (feat)

## Files Created/Modified
- `components/dashboard/DashboardShell.tsx` - 7 card-like elements updated to rounded-md border, shadow-sm removed
- `components/dashboard/WeeklyCalendar.tsx` - outer container, day cells, and popup updated to rounded-md border

## Decisions Made
- Export dropdown keeps `shadow-2xl` — it's a floating overlay, not a card; shadow provides depth cue
- Time filter pill group and utility group retain `rounded-2xl`/`rounded-xl` — these are UI controls (pill-shaped groupings and icon buttons), not card containers
- WeeklyCalendar day popup retains `shadow-xl` — floating overlay with positional anchoring needs shadow for visual separation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.next` build cache had a file lock (EPERM on trace file) from a running dev server. Cleared with PowerShell Remove-Item and used `npx tsc --noEmit` for TypeScript validation instead of full build. Type check passed with zero errors.

## Next Phase Readiness
- Card styling pass complete across dashboard — consistent rounded-md border design language established
- Phase 27 (grid resize) can build widget cards without changing container styling
- Phase 28 (final polish) inherits clean, consistent card convention

---
*Phase: 26-top-bar-and-card-redesign*
*Completed: 2026-03-22*
