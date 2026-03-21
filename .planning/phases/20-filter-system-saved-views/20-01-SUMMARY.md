---
phase: 20-filter-system-saved-views
plan: "01"
subsystem: trades-filter
tags: [filter, trades, components, ux]
dependency_graph:
  requires: [19-02]
  provides: [TradeFilterBar, enhanced-applyFilter, account-chips]
  affects: [components/trades/TradesShell.tsx, components/trades/TradeFilterChips.tsx]
tech_stack:
  added: []
  patterns: [controlled-dropdown, outside-click-useEffect, useMemo-derived-data]
key_files:
  created:
    - components/trades/TradeFilterBar.tsx
  modified:
    - components/trades/TradesShell.tsx
    - components/trades/TradeFilterChips.tsx
decisions:
  - "Tags multi-select uses OR semantics (trade matches if it has ANY selected tag)"
  - "Mistake type dropdown is fully wired to filter state but applyFilter logic deferred to Phase 22 (trade-mistake junction data not yet in trades fetch)"
  - "Account filter only renders when activeAccountId === null (All Accounts mode) and accounts.length > 1"
  - "Columns toggle kept in TradesShell, not in TradeFilterBar, as it is a display setting not a filter"
  - "Quick preset Winners/Losers toggle the pnlFilter (clicking again when active reverts to all)"
  - "settingsData state added to TradesShell as prep for Plan 02 SavedViewsDropdown"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 20 Plan 01: TradeFilterBar Component Summary

TradeFilterBar extracted from inline JSX into dedicated component with date range, tags multi-select, account dropdown, mistake type dropdown, and quick preset buttons (Winners/Losers/This Week/This Month).

## What Was Built

### TradeFilterBar component (`components/trades/TradeFilterBar.tsx`)

A dedicated "use client" component (357 lines) receiving `filter`, `onFilterChange`, `allTrades`, `accounts`, `activeAccountId`, and `isGuest` props. Renders the full filter bar including:

- Symbol search input (moved from TradesShell)
- Status buttons: All/Planned/Open/Closed (moved)
- Direction buttons: All/Long/Short (moved)
- Date range: two native `<input type="date">` with `dark:[color-scheme:dark]` for Chrome dark calendar
- Tags multi-select: derives distinct tags via `useMemo` from `allTrades.tags` (comma-split), outside-click close, count badge when tags selected
- Mistake type dropdown: fetches `/api/mistakes` on mount, sets `filter.mistakeId` (filtering logic deferred to Phase 22)
- Account filter: only rendered in All Accounts mode with 2+ accounts, outside-click close
- Quick presets: Winners (toggle pnlFilter), Losers (toggle pnlFilter), This Week (Monday-Sunday), This Month (first-last day)

### TradesShell.tsx changes

- Import and render `<TradeFilterBar>` replacing ~70 lines of inline filter JSX
- Columns toggle moved below TradeFilterBar as a separate display setting
- `applyFilter()` extended with tags OR-semantics check and accountId equality check
- `settingsData` state added (prep for Plan 02 SavedViewsDropdown)
- Renamed internal `settingsData` local variable to `loadedSettings` to avoid shadowing

### TradeFilterChips.tsx changes

- Added optional `accounts` prop for resolving account names
- Account chip: `Account: {name}` when `filter.accountId` is set
- Tags chip: shows tag names for 1-3 selected (`Tags: momentum, breakout`), count for 4+ (`Tags: 5 selected`)

## Decisions Made

1. Tags OR semantics: trade matches if it has ANY selected tag (most intuitive for traders scanning setups)
2. Mistake filtering deferred to Phase 22 — the dropdown sets state but `applyFilter` does not act on `mistakeId` yet, since the trades API does not yet return trade-mistake junction data
3. Account filter hidden when user is in single-account mode (renders only with `activeAccountId === null` and `accounts.length > 1`)
4. Winners/Losers presets toggle (clicking active preset reverts to "all") for better UX
5. Columns toggle intentionally excluded from TradeFilterBar — it controls display, not data filtering

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files created:
- `components/trades/TradeFilterBar.tsx` — FOUND
- `components/trades/TradesShell.tsx` — FOUND (modified)
- `components/trades/TradeFilterChips.tsx` — FOUND (modified)

### Commits:
- b1f66c6: feat(20-01): create TradeFilterBar component with all filter controls
- 4e5f281: feat(20-01): wire TradeFilterBar into TradesShell and complete applyFilter

## Self-Check: PASSED
