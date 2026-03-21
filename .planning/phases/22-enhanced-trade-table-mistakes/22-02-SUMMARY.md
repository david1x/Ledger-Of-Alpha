---
phase: 22-enhanced-trade-table-mistakes
plan: 02
subsystem: ui
tags: [react, mistakes, trade-tagging, junction-api, toggle-pills]

# Dependency graph
requires:
  - phase: 22-01
    provides: TradeTable with mistakeTypes prop, TradesShell fetching /api/mistakes
  - phase: 18-db-api-foundation
    provides: /api/trades/[id]/mistakes POST/DELETE endpoints, /api/mistakes GET endpoint

provides:
  - TradeModal Psychology tab with mistake toggle pills (MIST-02)
  - Colored mistake pills rendered in TradeTable symbol cell (MIST-03)
  - Dedicated "Mistakes" column option in column picker
  - Diff-based mistake tag sync on trade save

affects: [future sidebar analytics consuming mistake_tag_ids]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diff-based junction API sync: compute toAdd/toRemove sets, execute Promise.all, best-effort (non-blocking)"
    - "selectedMistakeIds re-initialized via useEffect on trade prop change to handle editing different trades"
    - "Mistake pills rendered inline under symbol name for always-visible display regardless of column config"

key-files:
  created: []
  modified:
    - components/TradeModal.tsx
    - components/TradeTable.tsx

key-decisions:
  - "TradeModal fetches /api/mistakes independently (returns [] for guests) — no prop pass needed from parent"
  - "Mistake tag sync is best-effort: errors are console.error logged but do not block onSaved()/onClose()"
  - "Pills rendered in symbol cell (always visible) AND optional dedicated Mistakes column (column picker)"

patterns-established:
  - "Toggle pill pattern: Set<string> state, copy set on toggle, visual feedback via backgroundColor+color style"
  - "Mistake pills use color+'33' hex suffix for 20% opacity background matching the established design system"

requirements-completed: [MIST-02, MIST-03]

# Metrics
duration: 25min
completed: 2026-03-21
---

# Phase 22 Plan 02: Mistake Tagging UI + Table Pills Summary

**TradeModal Psychology tab with mistake toggle pills synced via diff-based POST/DELETE API, and colored mistake pills rendered in TradeTable rows**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-21T18:42:00Z
- **Completed:** 2026-03-21T19:07:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TradeModal reflection tab shows mistake type toggle pills; clicking selects/deselects with color-coded feedback
- On save, diff-based sync computes toAdd/toRemove sets and fires parallel POST/DELETE to /api/trades/[id]/mistakes
- Colored mistake pills appear in the symbol cell of every TradeTable row that has mistake_tag_ids
- New "Mistakes" dedicated column option added to ALL_COLUMNS for column picker
- TradesShell `onSaved={load}` causes trade re-fetch picking up updated mistake_tag_ids

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mistake tagging UI to TradeModal** - `f0ba44b` (feat)
2. **Task 2: Render mistake pills in TradeTable rows** - `08f34eb` (feat)

**Plan metadata:** [docs commit hash — see below]

## Files Created/Modified
- `components/TradeModal.tsx` - Added MistakeType import, mistakeTypes/selectedMistakeIds state, fetch effect, toggle pills UI in reflection tab, diff-based save sync
- `components/TradeTable.tsx` - Added mistakes column to ALL_COLUMNS, mistakes case to getSortValue, mistake pills in symbol cell (desktop + mobile), dedicated mistakes column td

## Decisions Made
- TradeModal fetches `/api/mistakes` independently — the API returns `[]` for guests so no guest-checking branch needed
- Tag sync is best-effort: errors are caught and console.error'd but do not block `onSaved()`/`onClose()`
- Pills rendered in the symbol cell (always visible) as primary display; dedicated Mistakes column is opt-in via column picker

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run build` EPERM error on `.next/trace` due to Windows file locking from a concurrent background build process. Resolved by waiting for background build to complete, then running fresh build with cleared `.next`. Pre-existing environmental issue, not caused by code changes.

## Next Phase Readiness
- MIST-02 and MIST-03 complete — mistake tagging end-to-end is functional
- Mistake types defined in Settings flow from Phase 18 (database) through Phase 22 Plan 02 (UI)
- Future sidebar analytics can read mistake_tag_ids from trade objects (already GROUP_CONCAT'd by the trades API)

---
*Phase: 22-enhanced-trade-table-mistakes*
*Completed: 2026-03-21*
