---
phase: 25-navbar-collapse-lock-filter-bar-redesign
plan: 01
subsystem: ui
tags: [react, tailwind, sidebar, navbar, tooltips, group-hover]

# Dependency graph
requires: []
provides:
  - Permanently collapsed sidebar (icon-only, sm:w-16 always on desktop)
  - CSS group-hover tooltips on all sidebar nav items
  - Sidebar background dark:bg-slate-900 bg-slate-100 (cohesive with filter bar)
affects:
  - 25-02 (filter bar redesign — sidebar color is now established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tooltip pattern: relative group on parent + absolute left-full span with opacity-0/group-hover:opacity-100"
    - "Sidebar lock: remove expanded state entirely, always use sm:w-16 on aside"

key-files:
  created: []
  modified:
    - components/Navbar.tsx

key-decisions:
  - "Sidebar background changed from dark:bg-slate-950 bg-white to dark:bg-slate-900 bg-slate-100 — one step off-body to create visible sidebar frame"
  - "Tooltip added to account switcher Wallet button, TradingView link, and user menu avatar in addition to nav links"
  - "showLabels now derives from mobileOpen only (was expanded || mobileOpen) — desktop always icon-only"

patterns-established:
  - "Nav tooltip: relative group on <Link>/<button> + !showLabels conditional span with left-full ml-3 positioning at z-50"

requirements-completed: [NAV-LOCK, NAV-TOOLTIP, COLOR-SIDEBAR]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 25 Plan 01: Navbar Collapse Lock Summary

**Sidebar permanently locked to 64px icon-only mode with styled CSS group-hover tooltips on all 10 nav items and cohesive dark:bg-slate-900 bg-slate-100 background**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T21:56:45Z
- **Completed:** 2026-03-21T22:04:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed `expanded` state, two localStorage `useEffect` hooks, and the floating expand toggle button entirely
- Removed `ChevronsLeft` and `ChevronsRight` from lucide-react imports
- Sidebar `<aside>` now hardcoded to `sm:w-16` — no conditional width on desktop
- Changed sidebar bg from `dark:bg-slate-950 bg-white` to `dark:bg-slate-900 bg-slate-100` for visual cohesion with filter bar (Plan 02)
- Added `relative group` + tooltip span to all 6 NAV_LINKS (single map), Alerts link, Settings link, account switcher Wallet button, TradingView external link, and user menu avatar button — 6 total tooltip spans
- Mobile behavior fully preserved: hamburger opens full-width w-64 sidebar with labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock sidebar collapsed and add tooltips** - `e33cb7e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `components/Navbar.tsx` - Removed expand toggle, locked to sm:w-16, changed bg color, added group-hover tooltips on all nav items

## Decisions Made
- Changed sidebar background from `dark:bg-slate-950 bg-white` (same as body) to `dark:bg-slate-900 bg-slate-100` — creates visible sidebar frame distinct from page body, connects visually with filter bar in Plan 02
- Applied tooltip pattern to account switcher, TradingView link, and user menu button in addition to all nav links for full coverage
- `showLabels = mobileOpen` (was `expanded || mobileOpen`) — desktop is always icon-only now

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Windows `.next` cache stale file issue caused two failed build attempts (ENOENT rename error and stale type stubs). Resolved by cleaning `.next` with PowerShell Remove-Item. Third build run succeeded cleanly with `Compiled successfully` and all 58 static pages generated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sidebar is locked at 64px with cohesive `dark:bg-slate-900` background — ready for Plan 02 filter bar redesign
- No blockers

---
*Phase: 25-navbar-collapse-lock-filter-bar-redesign*
*Completed: 2026-03-21*
