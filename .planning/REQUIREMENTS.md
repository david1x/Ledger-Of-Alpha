# Requirements: Ledger Of Alpha

**Defined:** 2026-03-21
**Core Value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics

## v3.0 Requirements

Requirements for Trades Page Overhaul. Each maps to roadmap phases.

### Filtering

- [ ] **FILT-01**: User can filter trades by date range (from/to)
- [ ] **FILT-02**: User can filter trades by setup/tag via multi-select dropdown
- [ ] **FILT-03**: User can filter trades by mistake type via multi-select dropdown
- [ ] **FILT-04**: User can filter trades by account via dropdown
- [x] **FILT-05**: User can see active filters as dismissible chips with individual clear
- [x] **FILT-06**: User can clear all active filters at once
- [ ] **FILT-07**: User can apply quick filter presets (Winners, Losers, This Week, This Month)
- [ ] **FILT-08**: User can save current filter state as a named view
- [ ] **FILT-09**: User can load and delete saved filter views

### Mistakes

- [x] **MIST-01**: User can create, edit, and delete custom mistake types (name + color)
- [ ] **MIST-02**: User can tag trades with one or more mistake types in TradeModal
- [ ] **MIST-03**: User can see mistake tags as pills in the trade table

### Summary Stats

- [ ] **STAT-01**: User can see cumulative return, P/L ratio, and win % in a summary stats bar
- [ ] **STAT-02**: User can see sparkline charts in each summary stat card
- [ ] **STAT-03**: Summary stats reflect all trades unless a date filter is active (then scoped to date range)

### Trade Table

- [ ] **TABL-01**: User can see color-coded status badges (Win/Loss/Open) on each row
- [ ] **TABL-02**: User can see color-coded side badges (Long/Short) on each row
- [ ] **TABL-03**: User can see net return $ and net return % columns
- [ ] **TABL-04**: User can see cost basis column (entry price x size)
- [ ] **TABL-05**: User can drag-to-reorder table columns with order persisted
- [ ] **TABL-06**: User can see footer with filtered count / total count and total return

### Sidebar Analytics

- [ ] **SIDE-01**: User can see account performance panel (avg return, avg return %, win %) with cumulative chart
- [ ] **SIDE-02**: User can see setups P&L breakdown (ranked list with trade count, win rate, total P&L per setup)
- [ ] **SIDE-03**: User can see mistakes P&L breakdown (ranked list with count, total P&L impact per mistake type)
- [ ] **SIDE-04**: User can collapse/expand sidebar; hidden by default on mobile

### Mobile

- [ ] **MOBI-01**: Trade table scrolls horizontally with sticky symbol column on small viewports
- [ ] **MOBI-02**: Filter bar wraps responsively; filter chips scroll horizontally
- [ ] **MOBI-03**: Summary stats bar uses 2-column grid on small screens

## Future Requirements

### Advanced Mobile
- **MOBI-04**: Mobile card stacked view as alternative to horizontal scroll table

### Strategy Analytics
- **STRT-01**: Per-strategy performance breakdown (by strategy_id)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Inline trade editing in table rows | TradeModal works well; avoid complex inline state |
| Drag-reorder sidebar panels | Static ordered sections sufficient; natural hierarchy exists |
| Saved view sharing/export | No multi-user sharing infrastructure |
| Full pivot grid | Massive scope; simple ranked breakdowns are sufficient |
| Real-time filter updates via WebSocket | Trades data is static between manual refreshes |
| Infinite scroll / virtualization | Trade counts in hundreds, not millions |
| Server-side pagination | Client-side filtering is fast enough for realistic trade counts |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILT-01 | Phase 20 | Pending |
| FILT-02 | Phase 20 | Pending |
| FILT-03 | Phase 20 | Pending |
| FILT-04 | Phase 20 | Pending |
| FILT-05 | Phase 19 | Complete |
| FILT-06 | Phase 19 | Complete |
| FILT-07 | Phase 20 | Pending |
| FILT-08 | Phase 20 | Pending |
| FILT-09 | Phase 20 | Pending |
| MIST-01 | Phase 18 | Complete |
| MIST-02 | Phase 22 | Pending |
| MIST-03 | Phase 22 | Pending |
| STAT-01 | Phase 21 | Pending |
| STAT-02 | Phase 21 | Pending |
| STAT-03 | Phase 21 | Pending |
| TABL-01 | Phase 22 | Pending |
| TABL-02 | Phase 22 | Pending |
| TABL-03 | Phase 22 | Pending |
| TABL-04 | Phase 22 | Pending |
| TABL-05 | Phase 22 | Pending |
| TABL-06 | Phase 22 | Pending |
| SIDE-01 | Phase 23 | Pending |
| SIDE-02 | Phase 23 | Pending |
| SIDE-03 | Phase 23 | Pending |
| SIDE-04 | Phase 23 | Pending |
| MOBI-01 | Phase 23 | Pending |
| MOBI-02 | Phase 23 | Pending |
| MOBI-03 | Phase 23 | Pending |

**Coverage:**
- v3.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation (v3.0 Phases 18-23)*
