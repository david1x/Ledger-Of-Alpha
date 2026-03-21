# Phase 19: TradesShell Refactor - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the trades page (~588-line monolith) into a clean component tree with a unified TradeFilterState type. No new features — existing behavior preserved. Creates extension points for Phases 20-23.

</domain>

<decisions>
## Implementation Decisions

### Component Split
- Extract import/export logic (~140 lines) into a dedicated TradeImportExport component. Shell passes an onTradesChanged callback.
- Remove FilteredSummary entirely (P&L/win rate strip below table). Phase 21 will build a proper Summary Stats Bar to replace it.
- Filter controls (symbol search, status buttons, direction buttons, column toggle) — Claude's discretion on whether to extract now or leave a slot for Phase 20
- Header area (title + action buttons) — Claude's discretion on extraction vs inline

### Filter State Wiring
- Wire the full TradeFilterState type from lib/types.ts from the start, including fields without UI controls yet (mistakeId, tags, dateFrom, dateTo, pnlFilter). Unused fields use DEFAULT_FILTER values. Phase 20 just adds UI controls.
- Filter persistence: per-session (survives page navigation, resets on browser close). Claude picks the cleanest mechanism (sessionStorage, React state, etc.)
- Account switching behavior: Claude decides based on success criteria ("switching accounts reloads trade data without resetting any active filter state")
- Filter application logic (where the .filter() chain lives) — Claude's discretion

### Data Flow
- Centralized fetch vs component-level fetch — Claude's discretion
- Trade mutation strategy (re-fetch vs optimistic update) — Claude's discretion
- Custom hook (useTradesData) vs inline state management — Claude's discretion
- Privacy mode: centralize in a context provider (not per-page localStorage). All pages that use privacy mode should consume from context.

### Extension Points
- Sidebar slot for Phase 23 — Claude's discretion on whether to pre-create the layout slot
- New components directory — Claude's discretion (components/trades/ vs flat)
- Page wrapper pattern (thin page.tsx importing TradesShell vs all-in-one) — Claude's discretion

### Claude's Discretion
- Filter bar extraction timing (now vs Phase 20)
- Header extraction vs inline
- Data fetching architecture (centralized vs distributed)
- Re-fetch vs optimistic updates
- Custom hook vs inline state
- Sidebar slot pre-creation
- Component file organization
- Page wrapper pattern

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TradeFilterState` + `DEFAULT_FILTER` already in lib/types.ts (lines 165-187) — wire directly
- `SavedView` interface in lib/types.ts (lines 189-194) — ready for Phase 20
- `TradeTable` component with `ALL_COLUMNS`, `DEFAULT_COLUMNS`, `ColumnKey` exports — already extracted
- `TradeModal` component — already extracted, receives `onSaved` callback
- `AccountBanner` component — already extracted
- `AlertModal` component — already extracted
- `useAccounts` hook from lib/account-context.tsx — provides account state

### Established Patterns
- DashboardShell pattern: app/page.tsx is a thin wrapper importing DashboardShell from components/dashboard/
- 6-column grid layout with responsive breakpoints in DashboardShell
- Settings persistence via /api/settings as JSON strings
- Privacy mode via localStorage with StorageEvent sync across tabs

### Integration Points
- app/trades/page.tsx — the file being refactored
- lib/types.ts — TradeFilterState type (already defined)
- lib/account-context.tsx — account switching triggers data reload
- /api/trades — trade CRUD with ?account_id= scoping
- /api/settings — column visibility persistence (trade_table_columns key)
- /api/quotes — live price quotes for open trades

</code_context>

<specifics>
## Specific Ideas

- User wants filter state to persist per session — not reset on page navigation, but does reset when browser closes
- User wants privacy mode centralized in context rather than per-page localStorage pattern
- User explicitly chose to remove FilteredSummary now (clean break) rather than keeping it as stopgap — accepts temporary loss of below-table stats until Phase 21

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-tradesshell-refactor*
*Context gathered: 2026-03-21*
