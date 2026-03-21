---
phase: 25-navbar-collapse-lock-filter-bar-redesign
plan: 02
subsystem: trades-filter-bar
tags: [filter-bar, dropdown, multi-select, ui-redesign]
dependency_graph:
  requires: []
  provides: [uniform-dropdown-filter-bar, multi-symbol-filter]
  affects: [components/trades/TradeFilterBar.tsx, components/trades/TradesShell.tsx, components/trades/TradeFilterChips.tsx, lib/types.ts]
tech_stack:
  added: []
  patterns: [unified-dropdown-state, outside-click-handler-per-open-dropdown, useMemo-derived-symbols]
key_files:
  created: []
  modified:
    - lib/types.ts
    - components/trades/TradesShell.tsx
    - components/trades/TradeFilterChips.tsx
    - components/trades/TradeFilterBar.tsx
decisions:
  - symbols array (multi-select) takes priority over legacy symbol string; when symbols.length > 0 the legacy string is ignored
  - Single openDropdown state key replaces 3 separate boolean showXxxMenu states
  - Symbol X clear button uses role=button span (not nested button) to avoid invalid HTML
  - filteredSymbols derived in component from allTrades via useMemo — no API call needed
metrics:
  duration: 8 minutes
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 4
---

# Phase 25 Plan 02: Filter Bar Dropdown Redesign Summary

**One-liner:** Uniform h-9 dropdown buttons with framed wrapper and multi-symbol checklist replacing mixed inline controls.

## What Was Built

Rewrote `TradeFilterBar.tsx` from a mixed layout (inline button groups, raw text input, raw date inputs) into a uniform row of compact dropdown buttons. All filter controls now share the same `DROPDOWN_BTN` style with `h-9` height. A single `openDropdown: string | null` state manages mutual exclusivity. The component is wrapped in a framed background panel (`dark:bg-slate-900/80 bg-slate-100`) with a border.

Key changes:
- **Symbol** — raw text input replaced by multi-select checklist dropdown with search, checkboxes, and count badge
- **Status** — inline button group (4 separate buttons) replaced by a single dropdown with radio-style options
- **Direction** — inline button group (3 buttons) replaced by a single dropdown
- **P&L (Winners/Losers)** — separate toggle buttons replaced by a single dropdown
- **Date** — raw side-by-side date inputs replaced by a dropdown panel containing labeled From/To inputs plus This Week/This Month presets
- **Tags, Mistakes, Account** — existing dropdowns preserved with unified `DROPDOWN_BTN` style

`TradeFilterState` in `lib/types.ts` gained a `symbols: string[]` field (multi-select) alongside the kept `symbol: string` (backward compat for saved views). `applyFilter` in `TradesShell.tsx` handles both: multi-select symbols array takes priority when non-empty, legacy string substring match used otherwise. `TradeFilterChips.tsx` shows a combined `Symbols: X, Y` chip for the array.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update TradeFilterState type and applyFilter for multi-symbol | 61b091e | lib/types.ts, TradesShell.tsx, TradeFilterChips.tsx |
| 2 | Rewrite TradeFilterBar as uniform dropdown buttons with framed wrapper | e5aa417 | TradeFilterBar.tsx |

## Verification

- `npm run build` compiled successfully with no TypeScript errors (both tasks)
- No inline button groups remain (Status/Direction/P&L are each a single dropdown button)
- No raw text input for symbol (replaced by dropdown checklist)
- No raw date inputs outside a dropdown panel
- All buttons use `DROPDOWN_BTN` style with `h-9`
- Root div has `dark:bg-slate-900/80 bg-slate-100` framed background
- `openDropdown` single state replaces multiple boolean states
- `filter.symbols` array works with `applyFilter` for multi-select

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: components/trades/TradeFilterBar.tsx
- FOUND: lib/types.ts
- FOUND: components/trades/TradesShell.tsx
- FOUND: components/trades/TradeFilterChips.tsx

Commits verified:
- FOUND: 61b091e (feat(25-02): add symbols[] multi-select to TradeFilterState and applyFilter)
- FOUND: e5aa417 (feat(25-02): rewrite TradeFilterBar as uniform h-9 dropdown buttons with framed wrapper)
