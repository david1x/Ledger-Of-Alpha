---
phase: 13-settings-page-overhaul
plan: 02
subsystem: ui
tags: [react, tailwind, settings, dirty-state, layout]

# Dependency graph
requires:
  - phase: 13-01
    provides: settings tab component scaffolding
provides:
  - Full-width settings content area (no max-w-2xl)
  - "Appearance" tab label replacing "Display" with URL backward-compat
  - Amber dirty-state indicator dot next to tab names in sidebar
affects: [13-03, settings page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - baselineRef + TAB_FIELDS map for dirty-state detection across a monolithic settings page
    - dirtyTabs Set<Category> state cleared on save, populated on settings change

key-files:
  created: []
  modified:
    - app/settings/page.tsx

key-decisions:
  - "Dirty-state tracking implemented inline in monolithic settings page (no separate tab components yet) using baselineRef + field-to-tab mapping"
  - "CATEGORIES id stays 'display' for URL backward-compat; only label changes to 'Appearance'"
  - "TAB_FIELDS maps each settings key to its owning tab for granular dirty detection"

patterns-established:
  - "Baseline-ref pattern: capture server state in useRef on fetch, compare on each settings change, clear on save"
  - "TAB_FIELDS: Record<Category, (keyof Settings)[]> maps fields to tabs for dirty detection"

requirements-completed: [SETT-01, SETT-03, SETT-04, SETT-05]

# Metrics
duration: 25min
completed: 2026-03-19
---

# Phase 13 Plan 02: Settings Layout Polish and Dirty Indicators Summary

**Full-width settings layout, "Appearance" tab rename with URL compat, and amber dirty-indicator dot in sidebar via baseline-ref field-mapping pattern**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-19T00:00:00Z
- **Completed:** 2026-03-19T00:25:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Removed `sm:max-w-2xl` from content wrapper so settings fills full desktop width (SETT-01)
- Renamed "Display" label to "Appearance" while keeping `id="display"` so `?tab=display` URLs still resolve correctly (SETT-03, SETT-05)
- Added amber dot indicator next to tab labels in both desktop sidebar and mobile tabs when that tab has unsaved changes (SETT-04)
- Dirty state clears immediately after successful save; baseline updates to match saved state

## Task Commits

Each task was committed atomically:

1. **Task 1: Full-width layout, tab rename, and URL compatibility** - `ac95aea` (feat)
2. **Task 2: Add unsaved-change indicator to all tabs** - `7733d9b` (feat)

## Files Created/Modified
- `app/settings/page.tsx` - Removed max-w-2xl, renamed Display to Appearance, added dirty-tab state tracking with amber dot UI

## Decisions Made
- Dirty-state tracking stays in the monolithic `app/settings/page.tsx` rather than per-tab components, since all tabs are inline sections in one file. Uses `baselineRef` captured on server fetch + `TAB_FIELDS` mapping to derive which tabs are dirty.
- Admin tabs (Users, System) and action-only tabs (Security, Data, Accounts, Broker) have empty field arrays in `TAB_FIELDS` — these tabs perform immediate actions, never have deferred saves, so they correctly never show the amber dot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Plan referenced `components/settings/types.ts` but it doesn't exist**
- **Found during:** Task 1 (Tab rename and layout)
- **Issue:** The plan described making changes to `components/settings/types.ts` but this file was never created — CATEGORIES are defined inline in `app/settings/page.tsx`
- **Fix:** Applied all changes directly to `app/settings/page.tsx` where CATEGORIES actually lives
- **Files modified:** app/settings/page.tsx
- **Verification:** grep confirms label is "Appearance" at line 71 in page.tsx
- **Committed in:** ac95aea (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (plan referenced non-existent file; applied changes to actual file)
**Impact on plan:** No scope change — all intended functionality delivered, just in the correct file.

## Issues Encountered
- `.next` build cache had permission error (EPERM) on first build attempt; cleared cache and re-ran successfully.

## Next Phase Readiness
- Full-width layout and tab rename complete, ready for Phase 13 Plan 03
- Dirty indicator works for the 8 settings keys currently in scope; future plans can extend TAB_FIELDS as new settings are added

---
*Phase: 13-settings-page-overhaul*
*Completed: 2026-03-19*

## Self-Check: PASSED
- SUMMARY.md created at `.planning/phases/13-settings-page-overhaul/13-02-SUMMARY.md`
- Commit ac95aea (Task 1): FOUND
- Commit 7733d9b (Task 2): FOUND
