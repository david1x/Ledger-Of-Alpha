# Phase 24: Trades Page UI Tightening - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** User description (inline)

<domain>
## Phase Boundary

Visual polish pass on the trades page: tighten spacing, reduce border radius, widen sidebar, relocate filters, and achieve a cohesive grid layout with minimal wasted space.

</domain>

<decisions>
## Implementation Decisions

### Sidebar
- Widen the analytics sidebar — current width is too narrow
- Sidebar border must extend full height (top to bottom) — currently it does not

### Cards & Spacing
- All cards should be less rounded (reduce border-radius)
- Less space between cards (reduce gaps)
- The 3 summary stat cards at the top should be slightly shorter in height
- Overall aesthetic: a well-assembled grid layout with tight spacing

### Buttons
- All buttons should be less rounded (reduce border-radius)

### Filter Relocation
- Filter options should be at the very top of the page
- Remove the "Trade Log" title — it wastes space
- The Columns button should be replaced with a cog/settings icon
- The cog icon should be positioned at the top-right of the trades table alongside the saved views buttons

### Claude's Discretion
- Exact border-radius values (suggest rounded-md → rounded-sm or rounded)
- Exact gap reduction values
- Exact sidebar width increase
- How to handle the cog menu (dropdown vs modal)

</decisions>

<specifics>
## Specific Ideas

- Grid layout feel: everything should look like a well-put-together grid — aligned edges, consistent gaps, no floating elements
- The cog icon groups with the saved views buttons as a toolbar row at top-right of the table

</specifics>

<deferred>
## Deferred Ideas

None — all items are in scope for this phase.

</deferred>

---

*Phase: 24-trades-page-ui-tightening*
*Context gathered: 2026-03-21 via user description*
