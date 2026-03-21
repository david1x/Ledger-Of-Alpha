# Phase 25: Navbar Collapse Lock & Filter Bar Redesign - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** User description (inline)

<domain>
## Phase Boundary

Lock the main sidebar to collapsed (icon-only) state permanently, add hover tooltips on nav icons, redesign the trades filter bar as compact dropdown buttons that visually blend with the sidebar's color scheme.

</domain>

<decisions>
## Implementation Decisions

### Navbar / Sidebar
- Remove the expand/collapse toggle — sidebar is permanently collapsed (icon-only mode)
- Add hover tooltips on each nav icon showing what it is (e.g., "Dashboard", "Trades", "Journal", etc.)
- Adjust sidebar background color slightly so it visually connects with the filter bar

### Filter Bar Redesign
- The filter bar should visually blend with the main sidebar — same or similar background color
- The filter bar should be "framed" (have a defined background/border) — currently it floats and looks misaligned
- All filter buttons/options must be the same height — currently inconsistent
- The free text search field should become a "Symbol" button that expands into a search field + symbol checklist dropdown
- All other filter options should follow the same pattern: compact button that expands to show options (dropdown pattern)
- Goal: minimize the filter bar footprint — everything starts as a compact button row

### Color Cohesion
- The sidebar and filter bar should share a color family so they look like one cohesive UI frame
- The filter bar at the top of the trades page should have a background color that connects it to the sidebar

### Claude's Discretion
- Exact background colors for sidebar and filter bar (should be dark, cohesive)
- Tooltip implementation (CSS vs component)
- Dropdown animation/behavior
- How the symbol checklist works (multi-select with checkboxes)
- Whether the account switcher in the sidebar needs adjustment for always-collapsed mode

</decisions>

<specifics>
## Specific Ideas

- Symbol button: click → dropdown with search input at top + scrollable symbol checklist below (multi-select)
- Other filters (Direction, Status, Setup, etc.): same dropdown button pattern
- All dropdown buttons should be uniform height and style
- The filter bar row should have a subtle background that connects it to the sidebar's left edge

</specifics>

<deferred>
## Deferred Ideas

None — all items are in scope for this phase.

</deferred>

---

*Phase: 25-navbar-collapse-lock-filter-bar-redesign*
*Context gathered: 2026-03-21 via user description*
