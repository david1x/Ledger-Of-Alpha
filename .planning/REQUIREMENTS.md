# Requirements: Ledger Of Alpha

**Defined:** 2026-03-22
**Core Value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics.

## v3.1 Requirements

Requirements for Dashboard Redesign milestone. Each maps to roadmap phases.

### Layout

- [x] **LAYOUT-01**: Dashboard has navbar-style top bar (h-16) with account balance, P&L, and win rate
- [x] **LAYOUT-02**: Layout controls (edit mode, save/load templates, time filter, privacy, refresh) in top navbar
- [x] **LAYOUT-03**: Page title and subtitle removed
- [x] **LAYOUT-04**: Dashboard is viewport-locked (no page scroll, grid scrolls independently)

### Cards

- [x] **CARD-01**: Card design matches trades page style (rounded-md, borders, bg, font sizing)
- [x] **CARD-02**: Recent trades table widget removed
- [x] **CARD-03**: All widgets use unified card container component

### Resize

- [x] **RESIZE-01**: User can resize cards by dragging SE corner handle (column span, 1-6 cols)
- [x] **RESIZE-02**: User can resize card height by dragging (row span snapping)
- [x] **RESIZE-03**: Resize handles visible only in edit mode
- [x] **RESIZE-04**: Layout schema migrated from string sizes to {w, h} with backward compatibility

### Persistence

- [x] **PERSIST-01**: Resized layouts saved to settings API (same dashboard_layout key pattern)
- [x] **PERSIST-02**: Saved layout templates migrated to new schema format

## Future Requirements

### Resize Enhancements

- **RESIZE-05**: Per-widget minimum sizes (e.g. chart min 2 cols, stat min 1 col)
- **RESIZE-06**: Resize preview ghost/outline while dragging
- **RESIZE-07**: Keyboard-accessible resize (arrow keys in edit mode)

## Out of Scope

| Feature | Reason |
|---------|--------|
| react-grid-layout adoption | Uses absolute positioning, incompatible with existing CSS Grid layout engine |
| Drag from any edge (8 handles) | SE corner only — matches Grafana/Datadog convention, simpler interaction |
| Mobile resize | Reset all spans to 1 col below md breakpoint — resize is desktop-only |
| Widget height adjustment (free pixel) | Grid row-snap only, not free-pixel height |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 26 | Complete (26-01) |
| LAYOUT-02 | Phase 26 | Complete (26-01) |
| LAYOUT-03 | Phase 26 | Complete (26-01) |
| LAYOUT-04 | Phase 26 | Complete (26-01) |
| CARD-01 | Phase 26 | Complete |
| CARD-02 | Phase 26 | Complete |
| CARD-03 | Phase 26 | Complete |
| RESIZE-01 | Phase 27 | Complete (27-01) |
| RESIZE-02 | Phase 27 | Complete |
| RESIZE-03 | Phase 27 | Complete (27-01) |
| RESIZE-04 | Phase 27 | Complete (27-01) |
| PERSIST-01 | Phase 28 | Complete |
| PERSIST-02 | Phase 28 | Complete |

**Coverage:**
- v3.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
