# Ledger Of Alpha Roadmap

## Milestones

- [v1.0.0 (SHIPPED)](.planning/milestones/v1.0.0-ROADMAP.md) — Core Architecture, Journaling, & Analytics (2026-03-14)
- [v2.0 (SHIPPED)](.planning/milestones/v2.0-ROADMAP.md) — Intelligence & Automation (2026-03-19)
- [v2.1 (SHIPPED)](.planning/milestones/v2.1-ROADMAP.md) — Settings & Polish (2026-03-21)
- **v2.3 (SHIPPED)** — Verify URL Hotfix (2026-03-21)
- [v3.0 (SHIPPED)](.planning/milestones/v3.0-ROADMAP.md) — Trades Page Overhaul (2026-03-22)
- **v3.1 (IN PROGRESS)** — Dashboard Redesign (Phases 26-28)

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

See [v2.1 Roadmap Archive](.planning/milestones/v2.1-ROADMAP.md) for details.

</details>

<details>
<summary>v3.0 Trades Page Overhaul (Phases 18-25) — SHIPPED 2026-03-22</summary>

- [x] Phase 18: DB & API Foundation (2/2 plans) — completed 2026-03-21
- [x] Phase 19: TradesShell Refactor (2/2 plans) — completed 2026-03-21
- [x] Phase 20: Filter System & Saved Views (2/2 plans) — completed 2026-03-21
- [x] Phase 21: Summary Stats Bar (1/1 plan) — completed 2026-03-21
- [x] Phase 22: Enhanced Trade Table & Mistakes (2/2 plans) — completed 2026-03-21
- [x] Phase 23: Sidebar Analytics & Mobile Polish (2/2 plans) — completed 2026-03-21
- [x] Phase 24: Trades Page UI Tightening (2/2 plans) — completed 2026-03-21
- [x] Phase 25: Navbar Collapse Lock & Filter Bar Redesign (2/2 plans) — completed 2026-03-22

See [v3.0 Roadmap Archive](.planning/milestones/v3.0-ROADMAP.md) for details.

</details>

### v3.1 Dashboard Redesign

- [ ] **Phase 26: Top Bar and Card Redesign** - Navbar-style header with account stats, viewport-locked layout, unified card styling
- [ ] **Phase 27: Grid Resize System** - Drag-to-resize handles with column and row span snapping
- [ ] **Phase 28: Layout Persistence and Migration** - Save resized layouts and migrate templates to new schema

## Phase Details

### Phase 26: Top Bar and Card Redesign
**Goal**: Dashboard matches the trades page design language with a navbar-style top bar and unified card styling
**Depends on**: Nothing (first phase of v3.1)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, CARD-01, CARD-02, CARD-03
**Success Criteria** (what must be TRUE):
  1. Dashboard has a fixed h-16 top bar showing account balance, P&L, and win rate inline (no separate account summary strip)
  2. Layout controls (edit mode toggle, save/load templates, time filter, privacy toggle, refresh) are all accessible from the top bar
  3. Dashboard content area scrolls independently below the top bar with no page-level scrollbar
  4. All widget cards use rounded-md borders, matching background colors, and font sizing consistent with the trades page
  5. The page title, subtitle, and recent trades table widget are gone
**Plans:** 2 plans
Plans:
- [x] 26-01-PLAN.md — Top bar with inline account stats and viewport-locked layout
- [ ] 26-02-PLAN.md — Unified card styling (rounded-md borders, no shadows)

### Phase 27: Grid Resize System
**Goal**: Users can resize any dashboard card by dragging to set column and row span
**Depends on**: Phase 26
**Requirements**: RESIZE-01, RESIZE-02, RESIZE-03, RESIZE-04
**Success Criteria** (what must be TRUE):
  1. User can drag the SE corner handle of any card to change its column span (1-6 columns) with snap-to-grid behavior
  2. User can drag to change card row span with grid-row snapping
  3. Resize handles are visible only when edit mode is active and hidden during normal viewing
  4. Layout data uses `{ w, h }` object format internally, and any saved layout in the old string format loads correctly without data loss
**Plans**: TBD

### Phase 28: Layout Persistence and Migration
**Goal**: Resized layouts persist across sessions and existing templates work with the new format
**Depends on**: Phase 27
**Requirements**: PERSIST-01, PERSIST-02
**Success Criteria** (what must be TRUE):
  1. User resizes cards, refreshes the page, and sees the same layout they left
  2. Previously saved layout templates load correctly with card sizes converted to the new schema
  3. Built-in default templates render correctly in the new format
**Plans**: TBD

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0.0 | 1-7 | 11 | Complete | 2026-03-14 |
| v2.0 | 8-11 | 12 | Complete | 2026-03-19 |
| v2.1 | 12-17 | 10 | Complete | 2026-03-21 |
| v2.3 | — | — | Complete | 2026-03-21 |
| v3.0 | 18-25 | 15 | Complete | 2026-03-22 |
| v3.1 | 26-28 | 2 | In progress | - |

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 26. Top Bar and Card Redesign | 1/2 | In progress | - |
| 27. Grid Resize System | 0/TBD | Not started | - |
| 28. Layout Persistence and Migration | 0/TBD | Not started | - |

---
*Phase numbering continues across milestones. Next phase: 26.*
