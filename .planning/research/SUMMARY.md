# Project Research Summary

**Project:** Ledger Of Alpha v3.0 — Trades Page Overhaul
**Domain:** Advanced Trade Journal — Filters, Saved Views, Mistakes System, Sidebar Analytics
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

The v3.0 milestone transforms the existing trades page from a basic symbol/status/direction filter with an inline table into a full-featured analytical workspace. The work is additive to an already well-structured Next.js 15 + SQLite codebase — no existing architecture is dismantled. The recommended approach is: introduce two new DB tables for a proper mistakes tagging system, extract the trades page into a `TradesShell` orchestrator component, build a unified `TradeFilterState` object before touching any UI, and keep all sidebar analytics as client-side derivations from the already-loaded trades array. Zero new npm dependencies are required for the base implementation.

The headline risk is architectural: client-side filtering is already the pattern in use, but extending it naively to include mistakes (stored as a JSON column) will cause measurable render stalls at realistic trade counts (500+). The correct approach diverges from the existing pattern — filtering for date range and mistake type should be pushed server-side, while symbol, status, direction, and outcome remain client-side. This split must be designed before any UI is built. A second major risk is the data integrity of the existing `trades.mistakes` TEXT column, which may contain free-text notes rather than structured JSON; a `json_valid()` audit must precede the migration.

The feature dependency chain is clear and sequenced: DB migrations and API routes must land first, followed by the TradesShell structural refactor, then unified filter state. Saved views, the summary stats bar, enhanced table columns, and the right sidebar analytics are all independent once the filter state model is established.

## Key Findings

### Recommended Stack

The existing stack handles every v3.0 feature without additions. Recharts (v2.15.0, already installed) provides sparklines via stripped-down `<LineChart>` instances. `@dnd-kit/sortable` (already installed) handles column drag-to-reorder. `clsx` (already installed) handles conditional styling. The settings API key-value store absorbs saved views and column order without schema changes. The only optional addition is `react-day-picker@9` for a polished two-month date range calendar — the recommendation is to start with native `<input type="date">` fields and upgrade only if trader feedback identifies friction.

**Core technologies:**
- Recharts `<LineChart>` stripped to no axes/grid/tooltip: sparklines — no new dependency, established pattern from existing dashboard charts
- `@dnd-kit/sortable`: column drag-to-reorder — already in use for dashboard widget DnD, same pattern applies directly
- `/api/settings` key-value store: saved views + column order persistence — identical to `dashboard_layout_presets` and strategies patterns
- `mistake_types` + `trade_mistake_tags` DB tables (migrations 023/024): proper FK-backed mistakes system — required for filtering and cascade delete
- `clsx` + Tailwind responsive modifiers: filter chips, mobile layout — no new dependency
- Optional: `react-day-picker@9` — defer until user feedback confirms native date input UX is insufficient; brings `date-fns` as transitive dep (~13 kB gzipped estimate)

### Expected Features

**Must have (table stakes):**
- Unified filter state object (`TradeFilterState`) replacing the three separate `useState` calls — prerequisite for everything else
- Active filter chips with individual X dismiss — every modern data tool expects this
- Quick filter presets (Winners / Losers / This Week / This Month) — highest-frequency trader workflows, zero schema changes
- Date range filter (From/To) — without this, traders cannot answer "what did I do last month?"
- Setup/Tag filter dropdown — traders build setups and need to isolate them; derive unique values from `tags` field
- Account filter dropdown — multi-account users need cross-account filtering without switching global context
- Mistakes filter dropdown — core to the mistake review workflow; derives from user's `mistake_types` list
- Summary stats bar extension (P/L Ratio + sparkline) — extends the already-present `FilteredSummary` component
- Status and side badges in table rows — visual at-a-glance trade classification; `STATUS_STYLE` map already exists
- User-defined mistake types with per-trade tagging — structured taxonomy replaces ad-hoc free text
- Column configuration with order persistence — already partially built; extend to include new columns and drag-to-reorder

**Should have (competitive differentiators):**
- Saved named filter views — "My FOMO Review" recalled in one click; TradeZella lists this as "coming soon"
- Right sidebar analytics — Setup P&L breakdown + Mistakes P&L breakdown driven by filtered trades; TradesViz implements this as a key differentiator
- Net return $ / % and cost basis columns — more meaningful than raw P&L; uncommon in basic journals
- Mistake P&L impact per type — "cost of your bad habits" view; rarely found outside professional tools
- Sparklines in summary stats bar — visual trajectory signal, not just a snapshot number

**Defer (post-v3.0):**
- Mobile card stacked view — horizontal scroll with sticky Symbol column is the pragmatic v3.0 choice per research
- Per-strategy analytics (strategy_id) — deferred per PROJECT.md; use tags field for setup grouping for now
- Saved view sharing or export — no multi-user infrastructure in scope
- Inline trade row editing — TradeModal works well; avoid the added state complexity
- Drag-reorder of sidebar analytics panels — static ordered sections are sufficient; natural hierarchy exists

### Architecture Approach

The structural pattern is a `TradesShell` orchestrator component that owns all filter state, loads trades and mistake types in parallel on mount, derives `filteredTrades` via `useMemo`, and passes data down to four child components: `FilterBar`, `SummaryStatsBar`, `TradeTable` (modified), and `TradesSidebar`. The current `app/trades/page.tsx` becomes a thin shell. A new `components/trades/` directory houses all new components. No existing API routes are removed; `GET /api/trades` gains `date_from`, `date_to`, `mistake_id`, and `include_mistakes` params. All sidebar analytics are client-side `useMemo` derivations from the already-loaded `filteredTrades` array — no sidebar-specific API calls.

**Major components:**
1. `TradesShell.tsx` (NEW) — orchestrator; owns `TradeFilterState`, loads trades + mistake types, computes `filteredTrades`, manages sidebar collapse
2. `FilterBar.tsx` (NEW) — all filter controls (symbol search, dropdowns, quick chips, date range, active chips, saved views menu)
3. `SummaryStatsBar.tsx` (NEW) — 3 stat cards (Cumulative P&L, Win Rate, P/L Ratio) + Recharts sparklines; scoped to `filteredTrades`
4. `TradesSidebar.tsx` (NEW) — collapsible right panel; Account Performance, Setups P&L, Mistakes P&L; pure `useMemo` over `filteredTrades`
5. `MistakesPill.tsx` (NEW) — inline mistake tag pills in table rows with inline add/remove interaction
6. `SavedViewsMenu.tsx` (NEW) — dropdown for save/load/delete named filter views
7. `TradeTable.tsx` (MODIFY) — add net_return, cost, mistakes columns; column drag-to-reorder via @dnd-kit
8. `lib/db.ts` (MODIFY) — migrations 023 (`mistake_types` table) and 024 (`trade_mistake_tags` junction table)
9. `app/api/mistakes/` (NEW routes) — CRUD for mistake types (GET, POST, PUT [id], DELETE [id])
10. `app/api/trades/[id]/mistakes/` (NEW routes) — POST to tag, DELETE [mid] to untag trade-mistake associations

### Critical Pitfalls

1. **Client-side mistakes filtering will stall the main thread** — `JSON.parse()` inside a hot `.filter()` loop across 500+ trades causes 200-400ms stalls on every filter change. Move date range and mistake filtering server-side via `GET /api/trades` params; use SQLite `json_each()` with parameterised queries for the JSON column.

2. **`trades.mistakes` TEXT column may contain free text, not JSON** — calling `json_each()` on a row containing plain text causes silent data loss or SQLite errors. Audit actual column values before writing any migration; use `json_valid()` guard; write new tagging to the `trade_mistake_tags` junction table and leave the old column for freeform notes.

3. **Saved views auto-applying on page load breaks user expectations** — three distinct storage mechanisms: DB (`trades_saved_views` settings key) for the named views catalogue, `localStorage` for ephemeral session filter state, never auto-apply a saved view on mount.

4. **Sparklines recompute on every filter keystroke, blocking the main thread** — use `useMemo` for all sparkline data derivations; debounce symbol search input at 150-300ms; consider raw SVG `<polyline>` instead of full Recharts instances for the 80x32px sparklines.

5. **`load()` resets filter state on account switch** — the existing `load()` mixes data fetching with state initialisation. Separate filter state lifecycle from data-fetch lifecycle; `load()` accepts the current filter as a parameter and must not reset it.

6. **SQL injection via tag/mistake name strings** — use `?` placeholders even with `json_each()`; filter by `mistake_type_id` (an integer) rather than by the name string.

## Implications for Roadmap

The build order is driven by two hard constraints: (1) the mistakes API must exist before any mistakes UI can be built, and (2) a unified `TradeFilterState` type must be defined before any filter UI is built. Both are foundational, zero-user-visible phases that unlock all downstream work.

### Phase 1: DB Migrations + API Foundation
**Rationale:** All feature work is blocked until the `mistake_types` and `trade_mistake_tags` tables exist and their API routes are testable. This is pure backend foundation with no UI. Can be verified independently via API calls before any UI exists.
**Delivers:** Migrations 023 and 024, CRUD API routes for `/api/mistakes` and `/api/trades/[id]/mistakes`, updated `GET /api/trades` with `date_from`/`date_to`/`mistake_id`/`include_mistakes` params, `MistakeType` / `SavedView` / `TradeFilterState` types added to `lib/types.ts`.
**Addresses:** Foundation for all mistakes system features from FEATURES.md.
**Avoids:** Pitfall 2 (data migration corruption) — audit `trades.mistakes` column values before writing migration and use `json_valid()` guard; Pitfall 5 (SQL injection) — parameterised queries from day one.

### Phase 2: TradesShell Structural Refactor
**Rationale:** The current `app/trades/page.tsx` is a ~590-line monolith. Before adding features, extract it into `components/trades/TradesShell.tsx`. This is a pure refactor — no new features, no behavior changes. Doing this now means Phases 3-6 have a clean component tree to build into, and the refactor can be verified in isolation.
**Delivers:** `components/trades/` directory, `TradesShell.tsx` containing all state and logic from the current page, `app/trades/page.tsx` reduced to a thin wrapper. All existing behavior verified unchanged.
**Avoids:** Pitfall 10 (filter state reset on account switch) — the refactor is the moment to separate filter state from the `load()` function.

### Phase 3: Unified Filter System + Saved Views
**Rationale:** The most user-visible feature and the foundation for every downstream feature. Sidebar analytics, summary stats bar, and mistakes filter all depend on `filteredTrades` derived from a unified `TradeFilterState`. Define the type, build `FilterBar`, implement quick chips, active chips, and saved views persistence in one phase to avoid partial filter state living in two places.
**Delivers:** `TradeFilterState` type, `FilterBar.tsx` with symbol/status/direction/date/setup/mistakes/account filters, quick filter presets (Winners/Losers/This Week/This Month), active filter chips with individual clear, `SavedViewsMenu.tsx` with save/load/delete wired to `/api/settings`.
**Addresses:** All filter-related table stakes from FEATURES.md; Saved Views differentiator.
**Avoids:** Pitfall 1 (client-side filter stall) — server-side date/mistake params used; Pitfall 3 (saved view auto-apply) — never auto-apply on mount; Pitfall 9 (quick chip/saved view interaction semantics) — define `applyQuickFilter()` merge logic before building any UI; Pitfall 13 (symbol search debounce + AbortController).

### Phase 4: Summary Stats Bar
**Rationale:** Independent of Phase 3's saved views work but depends on `filteredTrades` existing. Short phase that extends the existing `FilteredSummary` component with two new metrics and sparklines.
**Delivers:** `SummaryStatsBar.tsx` with Cumulative P&L, Win Rate, P/L Ratio stats plus Recharts sparklines; all stats scoped to `filteredTrades`.
**Addresses:** Summary stats bar table stake; sparklines differentiator.
**Avoids:** Pitfall 4 (sparkline recompute on keystroke) — `useMemo` on sparkline data, debounce text inputs; Pitfall 12 (stats bar showing unfiltered data) — wire exclusively to `filteredTrades`.

### Phase 5: Enhanced Trade Table + Mistakes Column
**Rationale:** The table enhancements are independent of the sidebar. Building the table before the sidebar means the mistakes tagging UX (MistakesPill) can be tested inline before the sidebar's breakdown charts reference the same data.
**Delivers:** `MistakesPill.tsx` with inline tag add/remove, new columns in `ALL_COLUMNS` (net_return, cost, mistakes), column drag-to-reorder via @dnd-kit/sortable in the column config dropdown, column order persisted to `trade_table_columns` settings key.
**Addresses:** Enhanced trade table table stakes; net return / cost basis differentiators.
**Avoids:** Pitfall 6 (sticky column inside overflow-x wrapper) — use `table-layout: fixed` + `position: sticky; left: 0` specifically; Pitfall 7 (column key rename breaks saved configs) — validate saved keys against `ALL_COLUMNS` on load, never rename existing keys.

### Phase 6: Right Sidebar Analytics
**Rationale:** Final phase because it depends on `filteredTrades` (Phase 3), `mistakeTypes` (Phase 1), and the `mistakeTagMap` (Phases 1+5). All sidebar content is client-side derived — no new API calls. This is the highest-complexity UI component but has zero architectural unknowns by the time it is built.
**Delivers:** `TradesSidebar.tsx` with three collapsible panels (Account Performance, Setups P&L breakdown, Mistakes P&L breakdown), sidebar toggle with localStorage persistence, hidden below `md` breakpoint.
**Addresses:** Right sidebar analytics differentiator; Setup P&L breakdown; Mistakes P&L impact.
**Avoids:** Pitfall 8 (sidebar waterfall API fetches) — all content is `useMemo` over props, zero `useEffect` fetches in the sidebar; Pitfall 6 (sidebar too wide on 1280px) — default-collapsed below 1400px, persist preference in localStorage.

### Phase Ordering Rationale

- Phases 1-2 are mandatory scaffolding. No feature work is possible without them.
- Phase 3 (filter system) is the single highest-value delivery and unlocks Phases 4-6 simultaneously.
- Phases 4, 5, and 6 are technically parallelisable once Phase 3 is done, but Phase 5 should precede Phase 6 so the `mistakeTagMap` tagging infrastructure is proven before the sidebar's breakdown charts reference it.
- The dependency chain from FEATURES.md is respected: Mistake Types API (Phase 1) before Mistakes filter (Phase 3) before Mistakes sidebar breakdown (Phase 6).
- All pitfall mitigations are front-loaded to the phase where they are introduced, not deferred.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1** (if `trades.mistakes` audit reveals non-JSON data): migration strategy will need case-by-case handling; surface to user for re-tagging. The specific stored format is unknown and must be confirmed before the migration is written.
- **Phase 3** (URL params vs React state tension): ARCHITECTURE.md recommends React state only; PITFALLS.md recommends URL params as the authoritative filter state for shareability. This is a product decision that needs resolution before FilterBar is designed.

Phases with standard patterns (skip research-phase):
- **Phase 2** (structural refactor): pure component extraction, no new patterns, risk is execution discipline only.
- **Phase 4** (summary stats bar): Recharts sparkline pattern is well-documented and already in use in the dashboard.
- **Phase 5** (table enhancements): @dnd-kit/sortable pattern already working in DashboardShell; column key validation is a standard runtime guard; `SymbolPnlWidget.tsx` is a direct reference implementation.
- **Phase 6** (sidebar analytics): client-side `useMemo` groupBy is a trivial pattern; `SymbolPnlWidget.tsx` is the reference implementation for horizontal Recharts bar charts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions derived directly from `package.json` and existing codebase patterns; only optional addition is react-day-picker with MEDIUM confidence on exact bundle size estimate |
| Features | HIGH | Benchmarked against TradeZella, TradesViz, TraderSync; feature dependency chain validated against existing codebase; anti-features are explicit and well-reasoned |
| Architecture | HIGH | All patterns derived from full codebase read of `app/trades/page.tsx`, `lib/db.ts`, `app/api/trades/route.ts`, and working precedents in DashboardShell and PersistentChart |
| Pitfalls | HIGH | 13 pitfalls identified with specific code locations, detection strategies, and phase assignments; critical pitfalls backed by SQLite and React performance documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **`trades.mistakes` column format in production**: Research confirms the pitfall exists but the actual stored data format is unknown. Must audit with `SELECT mistakes FROM trades WHERE mistakes IS NOT NULL LIMIT 20` before writing migration 023. Add an explicit pre-migration check step to Phase 1 planning.
- **URL params vs React state for filter persistence**: ARCHITECTURE.md recommends React state + localStorage (simpler); PITFALLS.md recommends URL params (shareable). This is a product decision. Resolve before Phase 3 is planned — the answer determines how `FilterBar` and `TradesShell` are wired.
- **Stats bar scope (filtered vs unfiltered)**: PITFALLS.md flags ambiguity in whether the summary stats bar reflects filtered or unfiltered trades. Competitor pattern is filtered. Confirm with project owner before Phase 4 to avoid a rework.
- **react-day-picker bundle size**: MEDIUM confidence estimate of ~13 kB gzipped could not be verified via Bundlephobia directly. Validate before committing to the optional upgrade.

## Sources

### Primary (HIGH confidence)
- Codebase: `app/trades/page.tsx` (589 lines, full read) — existing filter state, `load()` function, column config
- Codebase: `lib/db.ts` (full read through migration 022) — migration patterns, existing table definitions
- Codebase: `app/api/trades/route.ts` (149 lines, full read) — parameterised query builder pattern
- Codebase: `components/TradeTable.tsx`, `lib/types.ts`, `app/api/settings/route.ts` — integration points
- Recharts official API docs — `hide` prop on XAxis/YAxis sparkline pattern confirmed
- SQLite JSON Functions documentation — `json_each()`, `json_valid()` query patterns
- @dnd-kit / TanStack Table column ordering guide — DnD column reorder pattern
- `.planning/PROJECT.md` — v3.0 feature list and scope constraints

### Secondary (MEDIUM confidence)
- TradeZella Features Page + Help docs — filter types, saved filters UX patterns, tag analysis patterns
- TradesViz blog — saved filter combinations, sidebar analytics, Nov 2024 updates
- Best Trading Journal 2026 comparisons (TradesViz blog, StockBrokers.com) — market expectations for table stakes
- LogRocket — Advanced React state management using URL parameters — filter state persistence tradeoffs
- Recharts Performance Guide — memoization recommendations
- Mobile table responsive patterns (UXmatters, NN/g) — sticky column, horizontal scroll pattern

### Tertiary (LOW confidence — validate during execution)
- react-day-picker bundle size (~13 kB estimate) — GitHub discussions, not Bundlephobia direct verification
- Client-side filter render stall timings (200-400ms at 500 trades) — derived from general React performance guidance, not measured against this specific codebase

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
