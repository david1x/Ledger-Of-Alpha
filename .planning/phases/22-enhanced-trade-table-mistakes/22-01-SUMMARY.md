---
phase: 22-enhanced-trade-table-mistakes
plan: 01
subsystem: ui
tags: [react, dnd-kit, trade-table, badges, privacy]

# Dependency graph
requires:
  - phase: 21-summary-stats-bar
    provides: SummaryStatsBar, TradesShell, PrivacyProvider
  - phase: 18-db-api-foundation
    provides: MistakeType interface, /api/mistakes endpoint

provides:
  - TradeTable with Win/Loss/BE/Open/Planned status badges
  - Long/Short colored pill badges on direction column
  - pct_return column enabled by default
  - cost_basis column (entry_price x shares) available in column toggles
  - Drag-to-reorder column headers via @dnd-kit SortableHeader
  - tfoot with trade count, filtered-from count, and total P&L
  - totalCount and mistakeTypes props scaffolded for Plan 02
  - TradesShell fetches /api/mistakes and passes new props

affects:
  - 22-02 (mistakeTypes prop scaffold ready for mistake tag display)
  - Any component using TradeTable (new props are optional/backward-compat)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SortableHeader inner component: grip handle gets dnd listeners, sort button gets click handler — prevents drag from stealing sort clicks"
    - "DndContext wraps only thead tr content, not the full table — avoids tbody drag conflicts"
    - "getStatusBadge() function replaces STATUS_STYLE map — returns label+className for semantic Win/Loss/BE display"
    - "headers array built from visibleColumns order (not ALL_COLUMNS order) to reflect drag-reordered layout"

key-files:
  created: []
  modified:
    - components/TradeTable.tsx
    - components/trades/TradesShell.tsx

key-decisions:
  - "Separation of grip handle and sort button: GripVertical gets dnd listeners, button onClick gets sort handler — avoids 5px threshold from blocking sort clicks"
  - "headers array respects visibleColumns order (not ALL_COLUMNS order) so drag reorder is reflected immediately in the DOM"
  - "footerColSpan covers all header columns + 1 actions + checkbox column if selectable"
  - "mistakeTypes fetch in TradesShell is gated on me && !me.guest (non-guests only) to avoid 403 error path"

patterns-established:
  - "SortableHeader pattern: useSortable id matches ColumnKey, grip handle gets attributes+listeners, sort button gets onClick"
  - "Privacy masking: hidden ? '••••' : value applied to pnl, unrealized, cost_basis, and footer total"

requirements-completed: [TABL-01, TABL-02, TABL-03, TABL-04, TABL-05, TABL-06]

# Metrics
duration: 25min
completed: 2026-03-21
---

# Phase 22 Plan 01: Enhanced Trade Table Summary

**TradeTable rewritten with Win/Loss/BE status badges, Long/Short pills, cost basis column, drag-to-reorder headers via @dnd-kit, and a summary footer showing filtered count and total P&L**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-21T16:31:14Z
- **Completed:** 2026-03-21T16:56:00Z
- **Tasks:** 2 (combined into single commit — both tasks modified same files)
- **Files modified:** 2

## Accomplishments
- Status column now shows semantic Win (emerald), Loss (red), BE (gray), Open (yellow), Planned (blue) badges via `getStatusBadge()` replacing the generic "closed" label
- Direction column shows colored Long/Short pill badges instead of icon+text
- pct_return column enabled by default, cost_basis column added to column toggles
- Column headers support drag-to-reorder via @dnd-kit `SortableHeader` component with grip handle; reorder persists via `saveColumns -> /api/settings`
- Footer row shows trade count, "(filtered from N)" when filtered, and total P&L with privacy masking
- TradesShell now fetches `/api/mistakes` and passes `totalCount`, `mistakeTypes`, `onReorderColumns` to TradeTable

## Task Commits

1. **Tasks 1+2: Badges, columns, DnD headers, footer, TradesShell wiring** - `cad8390` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `components/TradeTable.tsx` - All TABL-01 through TABL-06 changes: new Props fields, getStatusBadge(), SortableHeader, DndContext wrap, tfoot, cost_basis column, privacy masking
- `components/trades/TradesShell.tsx` - Added MistakeType import, mistakeTypes state+fetch, totalCount/mistakeTypes/onReorderColumns props on TradeTable

## Decisions Made
- Grip handle gets `{...attributes} {...listeners}` (not the th or sort button) to prevent drag from intercepting sort clicks
- `headers` array built from `visibleColumns` order (not `ALL_COLUMNS` order) so drag reorder is reflected immediately without waiting for settings round-trip
- DndContext wraps only the `<tr>` inside `<thead>` — not the full `<table>` — to avoid tbody conflicts
- mistakeTypes fetch is gated on `me && !me.guest` to avoid 403 for guest users

## Deviations from Plan

None - plan executed exactly as written. Both tasks were implemented together in a single file rewrite since they touched the same files and the DnD imports were naturally included from the start.

## Issues Encountered

Build produced an EPERM error on `.next/trace` (dev server was running and holding the file lock). TypeScript type-check (`npx tsc --noEmit`) passed cleanly with zero errors. The "Compiled successfully in 12.0s" output confirmed the code compiled, and the subsequent build errors (`PageNotFoundError` for auth routes, bcryptjs edge runtime warnings) are pre-existing issues unrelated to these changes.

## Next Phase Readiness
- Plan 02 can immediately use `mistakeTypes` prop (already passed from TradesShell)
- `mistake_tag_ids` field is already read from trades in `applyFilter` for mistakeId filtering
- Column reorder infrastructure is complete and persisted

---
*Phase: 22-enhanced-trade-table-mistakes*
*Completed: 2026-03-21*
