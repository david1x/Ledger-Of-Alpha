---
phase: 15-dashboard-layout-templates
plan: 01
subsystem: ui
tags: [dashboard, layout, templates, settings, react]

# Dependency graph
requires: []
provides:
  - "Per-account dashboard layout storage with legacy fallback"
  - "getLayoutKey() helper for account-scoped settings keys"
  - "BUILT_IN_TEMPLATES constant with Performance Review and Daily Monitor presets"
  - "LayoutTemplate and BuiltInTemplate interfaces"
  - "Template CRUD handlers: handleSaveTemplate, handleLoadTemplate, handleDeleteTemplate, handleSaveAsCopy"
  - "allTemplates computed memo merging built-ins with user templates"
affects:
  - "15-02: Template save/load/delete UI consumes handlers and allTemplates"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-account settings key pattern: dashboard_layout_{accountId} or dashboard_layout_all_accounts"
    - "Legacy fallback: account-specific key first, then global dashboard_layout key"
    - "Template state co-located with layout state in DashboardShell"

key-files:
  created: []
  modified:
    - components/dashboard/DashboardShell.tsx

key-decisions:
  - "Per-account layout key: dashboard_layout_{accountId} for named accounts, dashboard_layout_all_accounts for null (All Accounts view)"
  - "Legacy fallback: settingsData[getLayoutKey(activeAccountId)] ?? settingsData.dashboard_layout ensures migration from global key"
  - "activeAccountId added to saveLayout useCallback deps to prevent stale closure writing to wrong account key"
  - "Performance Review preset: hidden:[] so all 39 widgets are visible for full deep-dive analysis"
  - "Daily Monitor preset: 8 compact widgets visible (daily-loss-status, fear-greed, vix, market-overview, heatmap, total-return, total-trades, profit-factor), 31 hidden"
  - "Template handlers stubbed in Plan 01 to keep state management co-located; UI wired in Plan 02"

patterns-established:
  - "getLayoutKey(accountId): standard helper for any code that reads/writes account-scoped layout settings"
  - "Template library key: dashboard_layout_templates (separate from per-account layout keys)"

requirements-completed:
  - DASH-04

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 15 Plan 01: Dashboard Layout Templates - Foundation Summary

**Per-account dashboard layout storage with getLayoutKey helper plus BUILT_IN_TEMPLATES constant (Performance Review, Daily Monitor), LayoutTemplate/BuiltInTemplate types, and all template CRUD handlers ready for Plan 02 UI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T19:22:21Z
- **Completed:** 2026-03-20T19:25:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Refactored DashboardShell layout storage to be per-account using `getLayoutKey(accountId)` with legacy `dashboard_layout` fallback
- Added two hardcoded built-in preset templates: Performance Review (all widgets visible) and Daily Monitor (8 compact widgets)
- Added full template state management: `templates` state, load from settings, and four handler functions (save, load, delete, saveAsCopy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-account layout storage key derivation and refactor load/save** - `40f1706` (feat)
2. **Task 2: Built-in preset constants, LayoutTemplate type, and template state** - `83a8b70` (feat)

## Files Created/Modified
- `components/dashboard/DashboardShell.tsx` - Added getLayoutKey helper, BUILT_IN_TEMPLATES constant, LayoutTemplate/BuiltInTemplate interfaces, templates state, template CRUD handlers, allTemplates memo; refactored load/save to use per-account keys

## Decisions Made
- `activeAccountId` added to `saveLayout` useCallback dependency array — critical to prevent stale closure writing layout to wrong account's key when user switches accounts
- Legacy fallback pattern: account-specific key takes priority, falls back to global `dashboard_layout` — enables zero-friction migration for existing users
- Daily Monitor hides 31 of 39 widgets (only 8 compact gauges visible) — confirmed against plan spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.next` build directory had Windows permission lock (EPERM on trace file), preventing `npx next build`. Used `npx tsc --noEmit` as equivalent type-check validation instead. All type checks pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All prerequisites for Plan 02 are in place: `allTemplates`, `BUILT_IN_TEMPLATES`, handler functions, and `LayoutTemplate`/`BuiltInTemplate` types are all exported/available in component scope
- Plan 02 can directly wire `allTemplates`, `handleSaveTemplate`, `handleLoadTemplate`, `handleDeleteTemplate`, `handleSaveAsCopy` to the template library UI

---
*Phase: 15-dashboard-layout-templates*
*Completed: 2026-03-20*
