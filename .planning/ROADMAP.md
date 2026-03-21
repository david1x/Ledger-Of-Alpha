# Ledger Of Alpha Roadmap

## Milestones

- [v1.0.0 (SHIPPED)](.planning/milestones/v1.0.0-ROADMAP.md) — Core Architecture, Journaling, & Analytics (2026-03-14)
- [v2.0 (SHIPPED)](.planning/milestones/v2.0-ROADMAP.md) — Intelligence & Automation (2026-03-19)
- [v2.1 (SHIPPED)](.planning/milestones/v2.1-ROADMAP.md) — Settings & Polish (2026-03-21)
- **v2.3 (SHIPPED)** — Verify URL Hotfix (2026-03-21)
- **v3.0 (In Progress)** — Trades Page Overhaul (Phases 18-23)

## Phases

<details>
<summary>v1.0.0 Core Architecture, Journaling, & Analytics (Phases 1-7) — SHIPPED 2026-03-14</summary>

See [v1.0.0 Roadmap Archive](.planning/milestones/v1.0.0-ROADMAP.md) for details.

</details>

<details>
<summary>v2.0 Intelligence & Automation (Phases 8-11) — SHIPPED 2026-03-19</summary>

See [v2.0 Roadmap Archive](.planning/milestones/v2.0-ROADMAP.md) for details.

</details>

<details>
<summary>v2.1 Settings & Polish (Phases 12-17) — SHIPPED 2026-03-21</summary>

- [x] Phase 12: Email URL Auto-Detection (1/1 plans) — completed 2026-03-19
- [x] Phase 13: Settings Page Overhaul (2/2 plans) — completed 2026-03-20
- [x] Phase 14: Admin Configuration Expansion (2/2 plans) — completed 2026-03-20
- [x] Phase 15: Dashboard Layout Templates (2/2 plans) — completed 2026-03-20
- [x] Phase 16: Strategy & Checklist Enhancements (2/2 plans) — completed 2026-03-20
- [x] Phase 17: Cleanup (1/1 plan) — completed 2026-03-20

See [v2.1 Roadmap Archive](.planning/milestones/v2.1-ROADMAP.md) for details.

</details>

### v3.0 Trades Page Overhaul (In Progress)

**Milestone Goal:** Transform the trades page into a powerful, filterable analytical workspace with a mistakes system, saved views, summary analytics, and sidebar breakdowns.

- [x] **Phase 18: DB & API Foundation** - Mistakes tables, CRUD API routes, extended trades query params (completed 2026-03-21)
- [x] **Phase 19: TradesShell Refactor** - Extract trades page into component tree; define unified filter state type (completed 2026-03-21)
- [x] **Phase 20: Filter System & Saved Views** - All filter controls, active chips, quick presets, named saved views (completed 2026-03-21)
- [x] **Phase 21: Summary Stats Bar** - Cumulative return, P/L ratio, win % with sparklines scoped to filtered trades (completed 2026-03-21)
- [x] **Phase 22: Enhanced Trade Table & Mistakes** - Badges, new columns, column reorder, mistakes tagging (completed 2026-03-21)
- [ ] **Phase 23: Sidebar Analytics & Mobile Polish** - Right sidebar panels, collapse toggle, responsive layouts

## Phase Details

### Phase 18: DB & API Foundation
**Goal**: The database schema and API routes that the entire mistakes system depends on are in place and verifiable before any UI is built
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: MIST-01
**Success Criteria** (what must be TRUE):
  1. A GET request to /api/mistakes returns an empty array for a new user (table exists)
  2. User can create a mistake type via POST /api/mistakes and retrieve it via GET (CRUD works end-to-end)
  3. A DELETE of a mistake type cascades cleanly — no orphaned trade_mistake_tags rows remain
  4. GET /api/trades?date_from=X&date_to=Y returns only trades within that range
**Plans:** 2/2 plans complete
Plans:
- [ ] 18-01-PLAN.md — DB migrations (mistake_types, trade_mistake_tags), TypeScript interfaces, mistake type CRUD routes
- [ ] 18-02-PLAN.md — Trade-mistake tagging API, date range filter on GET /api/trades

### Phase 19: TradesShell Refactor
**Goal**: The trades page is restructured into a clean component tree with a unified TradeFilterState type, enabling all subsequent feature phases to build into known extension points
**Depends on**: Phase 18
**Requirements**: FILT-05, FILT-06
**Success Criteria** (what must be TRUE):
  1. The trades page loads and all existing behavior works exactly as before the refactor
  2. Switching accounts reloads trade data without resetting any active filter state
  3. The TradeFilterState type exists in lib/types.ts and is consumed by TradesShell
**Plans:** 2/2 plans complete
Plans:
- [ ] 19-01-PLAN.md — PrivacyContext provider creation + migrate DashboardShell and journal page
- [ ] 19-02-PLAN.md — TradesShell orchestrator, TradeImportExport extraction, TradeFilterChips (FILT-05/06)

### Phase 20: Filter System & Saved Views
**Goal**: Users can slice the trades list by any combination of date, setup, side, mistake, and account — and save those combinations as named views for one-click recall
**Depends on**: Phase 19
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, FILT-05, FILT-06, FILT-07, FILT-08, FILT-09
**Success Criteria** (what must be TRUE):
  1. User can set a date range and see only trades within that period; clearing the date filter restores all trades
  2. User can select multiple setups from a dropdown and see only matching trades; active filters appear as dismissible chips
  3. User can apply a "Winners" quick filter and see only profitable trades; "This Week" shows only trades from the current week
  4. User can save the current filter state as "FOMO Review", load it later, and the same filters are re-applied
  5. User can clear all active filters at once with a single button and the full trade list returns
**Plans:** 2/2 plans complete
Plans:
- [ ] 20-01-PLAN.md — TradeFilterBar extraction with date range, tags, account, mistake, quick presets; applyFilter completion
- [ ] 20-02-PLAN.md — SavedViewsDropdown for save/load/delete named filter views

### Phase 21: Summary Stats Bar
**Goal**: Users see a live summary of cumulative return, P/L ratio, and win rate — with sparkline trend charts — scoped to whatever trades are currently visible
**Depends on**: Phase 20
**Requirements**: STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. User can see three stat cards (Cumulative Return, P/L Ratio, Win %) at the top of the trades page
  2. Each stat card displays a small sparkline chart showing the trend over time
  3. When a date filter is active, all three stats reflect only the filtered date range; removing the filter updates stats to show all trades
**Plans:** 1/1 plans complete
Plans:
- [ ] 21-01-PLAN.md — SummaryStatsBar component with sparklines, replaces AccountBanner on trades page

### Phase 22: Enhanced Trade Table & Mistakes
**Goal**: The trade table surfaces richer per-trade data including badges, return metrics, cost basis, and user-applied mistake tags — with column order persisted between sessions
**Depends on**: Phase 19
**Requirements**: MIST-02, MIST-03, TABL-01, TABL-02, TABL-03, TABL-04, TABL-05, TABL-06
**Success Criteria** (what must be TRUE):
  1. Each table row shows a color-coded Win/Loss/Open badge and a Long/Short badge visible at a glance
  2. User can see net return $ and net return % columns alongside cost basis (entry price x size) for each trade
  3. User can tag a trade with one or more mistake types in TradeModal; the tags appear as colored pills in the table row
  4. User can drag table columns into a custom order and that order persists on page refresh
  5. The table footer shows the count of filtered vs. total trades and the total return for the visible set
**Plans:** 2/2 plans complete
Plans:
- [ ] 22-01-PLAN.md — TradeTable badges, computed columns, drag-to-reorder headers, footer row
- [ ] 22-02-PLAN.md — Mistake tagging in TradeModal, mistake pills in TradeTable rows

### Phase 23: Sidebar Analytics & Mobile Polish
**Goal**: Users can open a right sidebar showing performance, setup, and mistake breakdowns derived from the current filtered trades — and the full page is usable on small screens
**Depends on**: Phase 22
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, MOBI-01, MOBI-02, MOBI-03
**Success Criteria** (what must be TRUE):
  1. User can open the right sidebar and see account performance (avg return, win %) with a cumulative return chart
  2. User can see a ranked list of setups by total P&L with trade count and win rate per setup
  3. User can see a ranked list of mistake types by total P&L impact, quantifying the cost of each recurring error
  4. User can collapse the sidebar to a slim toggle; the preference persists on refresh and the sidebar is hidden by default on mobile
  5. On a small screen the trade table scrolls horizontally with the Symbol column remaining sticky, and filter chips scroll without wrapping the layout
**Plans**: TBD

## Progress

**Execution Order:** 18 → 19 → 20 → 21 → 22 → 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7   | v1.0.0    | 11/11          | Complete | 2026-03-14 |
| 8-11  | v2.0      | 12/12          | Complete | 2026-03-19 |
| 12-17 | v2.1      | 10/10          | Complete | 2026-03-21 |
| 18. DB & API Foundation | 2/2 | Complete    | 2026-03-21 | - |
| 19. TradesShell Refactor | 2/2 | Complete    | 2026-03-21 | - |
| 20. Filter System & Saved Views | 2/2 | Complete    | 2026-03-21 | - |
| 21. Summary Stats Bar | 1/1 | Complete    | 2026-03-21 | - |
| 22. Enhanced Trade Table & Mistakes | 2/2 | Complete   | 2026-03-21 | - |
| 23. Sidebar Analytics & Mobile Polish | v3.0 | 0/TBD | Not started | - |

---
*Phase numbering continues across milestones. Next phase after v3.0: 24.*
