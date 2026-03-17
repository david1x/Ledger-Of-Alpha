---
phase: 08-trading-tools-hub
plan: 04
subsystem: ui
tags: [react, typescript, symbol-search, correlation-matrix]

# Dependency graph
requires:
  - phase: 08-trading-tools-hub
    provides: CorrelationMatrix component and SymbolSearch component
provides:
  - onEnter prop on SymbolSearch fires with trimmed uppercase string on Enter keydown
  - CorrelationMatrix wires onEnter={addSymbol} so manual symbol entry works without autocomplete
affects: [any future consumers of SymbolSearch that need Enter-to-confirm behavior]

# Tech tracking
tech-stack:
  added: []
  patterns: [onEnter callback prop pattern for input components that need Enter-key submission independent of dropdown selection]

key-files:
  created: []
  modified:
    - components/SymbolSearch.tsx
    - components/tools/CorrelationMatrix.tsx

key-decisions:
  - "onEnter fires only for the typed-but-not-clicked flow; onSelectFull path for autocomplete clicks is unchanged"
  - "Input is cleared after Enter to allow immediate next symbol entry"

patterns-established:
  - "onEnter prop pattern: input component accepts optional onEnter callback, fires with trimmed uppercase on Enter keydown, clears self"

requirements-completed: [TOOLS-07]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 8 Plan 04: Manual Symbol Entry for Correlation Matrix Summary

**SymbolSearch gains onEnter prop so typing any ticker (e.g. futures "ES") and pressing Enter adds it as a chip in CorrelationMatrix without needing FMP autocomplete results**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T15:22:00Z
- **Completed:** 2026-03-17T15:27:27Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `onEnter?: (value: string) => void` to SymbolSearch Props interface
- Added `onKeyDown` handler on input: Enter closes dropdown, fires `onEnter` with trimmed uppercase value, clears input
- Wired `onEnter={addSymbol}` in CorrelationMatrix so futures, ETFs, and unlisted tickers can be added by typing + Enter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onEnter prop to SymbolSearch and wire in CorrelationMatrix** - `922c40f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `components/SymbolSearch.tsx` - Added onEnter prop to interface, destructured in signature, onKeyDown handler on input
- `components/tools/CorrelationMatrix.tsx` - Added `onEnter={addSymbol}` to SymbolSearch usage

## Decisions Made
- onEnter fires only for the typed-but-not-clicked flow (Enter key); clicking an autocomplete result still routes through onSelectFull — the two paths are independent
- Input is cleared after Enter fires so the user can type the next symbol immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - `.next/trace` file was locked by a stale node process; killed process, cleared `.next`, rebuild succeeded.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT gap for TOOLS-07 is now closed: manual symbol entry via Enter key works for any ticker string
- Phase 8 gap closure complete; ready to proceed to Phase 9 (Monte Carlo Entry Integration)

---
*Phase: 08-trading-tools-hub*
*Completed: 2026-03-17*
