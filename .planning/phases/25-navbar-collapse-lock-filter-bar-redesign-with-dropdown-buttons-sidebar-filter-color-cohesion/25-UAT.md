---
status: complete
phase: 25-navbar-collapse-lock-filter-bar-redesign
source: 25-01-SUMMARY.md, 25-02-SUMMARY.md
started: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar Locked to Icon-Only
expected: On desktop, the sidebar shows only icons (64px wide). There is no expand/collapse toggle button. All nav items display as centered icons without text labels.
result: pass

### 2. Sidebar Hover Tooltips
expected: Hovering any sidebar icon shows a tooltip to the right with the label. Tooltip appears quickly (~100ms) with a subtle scale-in animation, dark background, and ring border.
result: pass

### 3. Mobile Sidebar Still Works
expected: On mobile, tapping the hamburger menu opens the full-width sidebar with text labels. Tapping again or the overlay closes it.
result: skipped
reason: User deferred mobile testing for now

### 4. Filter Bar — Dropdown Buttons
expected: Uniform compact dropdown buttons for all filters. Same height. Clicking one closes the other.
result: pass

### 5. Symbol Multi-Select Checklist
expected: Search input + checklist of symbols. Multi-select with count badge. X clears. Stays open while selecting.
result: pass

### 6. Status/Direction/P&L Dropdowns
expected: Radio-style options. Selecting closes dropdown and highlights button.
result: pass

### 7. Date Dropdown with Presets
expected: From/To inputs plus This Week/This Month presets. Clear dates link when active.
result: pass

### 8. Filter Bar as Sticky Navbar
expected: Bottom border only, stays visible on scroll. Export/Import icon-only with custom tooltips.
result: pass

### 9. Clear Filters Button
expected: X + Clear button appears when any filter active. Resets all filters.
result: pass

### 10. Trade Table Scrolls Independently
expected: Table and sidebar scroll independently. No page scroll.
result: pass

### 11. Stats Sidebar Aligned with Table
expected: Performance card top aligned with trade table frame. ~430px wide, no collapse toggle.
result: pass
note: "User recommends reducing gap between stats cards and trade table — widen cards slightly without breaking framing/borders"

### 12. Sidebar Color Matches Filter Bar
expected: Nav sidebar and filter bar share same background color for visual cohesion.
result: pass

## Summary

total: 12
passed: 11
issues: 0
pending: 0
skipped: 1

## Gaps

- truth: "Mobile sidebar opens full-width with text labels on hamburger tap"
  status: skipped
  reason: "User deferred mobile testing"
  severity: minor
  test: 3
