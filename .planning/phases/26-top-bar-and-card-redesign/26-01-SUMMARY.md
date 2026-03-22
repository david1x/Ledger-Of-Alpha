---
phase: 26-top-bar-and-card-redesign
plan: 01
subsystem: ui
tags: [dashboard, layout, top-bar, viewport-lock, dnd-kit, recharts, tailwind]

# Dependency graph
requires: []
provides:
  - Viewport-locked dashboard shell with h-16 top bar matching trades page design language
  - Inline account stats (Balance, P&L, Today P&L, Trades count, Win Rate) in top bar
  - All layout controls (time filter, edit mode, refresh, export, privacy, New Trade) moved into top bar
  - Independent scrolling content area below the top bar
affects:
  - 26-02 (card redesign — will operate inside the new scrollable content area)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Viewport-lock shell: flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden + height 100vh (same as TradesShell)"
    - "h-16 top bar: shrink-0 border-b dark:bg-slate-900 bg-slate-100 with left stats + right controls"
    - "Responsive stat visibility: always > sm > lg > xl breakpoints for progressive hiding"
    - "Scrollable content: flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4"
    - "Modals/overlays remain outside scrollable div as siblings in root flex container"

key-files:
  created: []
  modified:
    - components/dashboard/DashboardShell.tsx

key-decisions:
  - "Unified top bar design language: dashboard now matches trades page (h-16, same bg, same border, same escape pattern)"
  - "Account stats absorbed into top bar left side — dedicated account summary strip card removed"
  - "Page title and subtitle removed — dashboard identity conveyed by top bar stats, not headings"
  - "New Trade button adjusted to h-9 px-4 rounded-md to fit within h-16 bar (was h-10 px-5 rounded-2xl)"

patterns-established:
  - "Top bar escape pattern: -mx-6 -mt-6 -mb-6 on root div escapes page layout padding to go full-width"
  - "Stat visibility breakpoints: sm/lg/xl for progressive content hiding in constrained bars"

requirements-completed: [LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04]

# Metrics
duration: ~20min
completed: 2026-03-22
---

# Phase 26 Plan 01: Top Bar and Viewport Lock Summary

**Dashboard restructured with viewport-locked flex shell and h-16 navbar-style top bar containing inline account stats and all layout controls, matching the trades page design language**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 1

## Accomplishments

- Replaced `space-y-6` root div with viewport-locked flex shell (`flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden`, `height: 100vh`) — same escape pattern as TradesShell.tsx
- Built h-16 top bar with account stats (Balance, P&L, Today P&L, Trades count, Win Rate) on the left using responsive breakpoint visibility
- Moved all layout controls into top bar right side: time filter pills, edit mode toggle, template/reset buttons, refresh, export, privacy toggle, and New Trade button
- Removed page title "Dashboard" and subtitle "Your trading performance at a glance"
- Removed dedicated account summary strip card (absorbed into top bar)
- Wrapped widget grid and all remaining content in `flex-1 min-h-0 overflow-y-auto` scrollable area — only content scrolls, top bar stays fixed

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace root container with viewport-locked flex shell and build top bar** - `d3c2365` (feat)
2. **Task 2: Verify top bar layout and viewport locking** - checkpoint approved by user (no code commit)

## Files Created/Modified

- `components/dashboard/DashboardShell.tsx` - Restructured JSX: viewport-locked shell, h-16 top bar, scrollable content area

## Decisions Made

- Unified top bar design language — dashboard now uses the same h-16 bar, bg colors, and viewport-lock escape pattern as the trades page
- Account summary strip card removed — its content lives inline in the top bar left side, reducing visual hierarchy complexity
- Page title and subtitle removed — unnecessary given the stats-rich top bar conveys context
- New Trade button adjusted from `h-10 px-5 rounded-2xl` to `h-9 px-4 rounded-md` to fit proportionally in the h-16 bar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Top bar and viewport-locked shell are complete and verified. Ready for Plan 02 (card redesign).
- The scrollable content area (`flex-1 min-h-0 overflow-y-auto`) provides the correct context for resizable grid cards in Plan 02.

---
*Phase: 26-top-bar-and-card-redesign*
*Completed: 2026-03-22*
