# Project Research Summary

**Project:** Ledger Of Alpha v3.1 — Dashboard Redesign
**Domain:** Trading analytics dashboard — grid-based resizable card layout
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

The v3.1 dashboard redesign is primarily a UI restructure, not a systems overhaul. The existing DashboardShell.tsx already has a working 6-column CSS grid, @dnd-kit drag-reorder, three column-span sizes with layout persistence, and per-account settings. The work breaks into two distinct efforts: (1) visual redesign -- merging the header and account summary into a navbar-style top bar, updating card styling to match the trades page, and removing the open trades table -- and (2) resize enhancement -- replacing the 3-mode size-cycle button with drag-to-resize handles that snap to grid columns.

**The key recommendation is to keep @dnd-kit and CSS Grid, adding a custom ~200-line `useGridResize` hook for resize handles.** FEATURES.md and PITFALLS.md lean toward react-grid-layout, but STACK.md and ARCHITECTURE.md correctly identify that react-grid-layout uses absolute positioning (not CSS Grid), would replace the entire layout engine, require a full data format migration (`order + sizes` to `x/y/w/h`), and remove working @dnd-kit code. The migration cost is disproportionate to the gain. The custom approach extends the existing system with zero new dependencies, preserves backward compatibility, and keeps bundle size flat. The resize interaction (snap colSpan from 1-6 via corner drag handle) is simple enough that a library is overkill.

The top risks are: (1) @dnd-kit's `rectSortingStrategy` already has known issues with variable-sized items -- adding more size granularity will make this worse if not addressed; (2) Recharts `ResponsiveContainer` will cause performance collapse if chart re-renders are not debounced during resize; (3) layout schema migration must handle all storage keys (per-account, templates, built-in presets) or users lose their customizations. Row-span (height control) is explicitly out of scope per PROJECT.md and should stay deferred -- the data model should include `h` from day one but the UI should not expose height resize yet.

## Key Findings

### Recommended Stack

No new dependencies. Extend the existing stack with custom code.

**Core technologies (unchanged):**
- **@dnd-kit** (core/sortable/utilities): drag-reorder -- already integrated, keep as-is
- **CSS Grid** (6-column, `grid-cols-6`): layout engine -- native, performant, no replacement needed
- **Tailwind CSS v3**: styling -- switch from static `col-span-*` classes to inline `gridColumn` style for dynamic spans

**New custom code:**
- **`useGridResize` hook** (~150-200 lines): pointer event handling, grid-cell snapping, colSpan/rowSpan update
- **`ResizeHandle` component** (~50 lines): SE corner grip, edit-mode only, `stopPropagation` to prevent @dnd-kit conflicts

**What NOT to add:**
- react-grid-layout -- absolute positioning layout engine, replaces CSS Grid and @dnd-kit, high migration cost
- react-resizable -- pixel-based, still needs custom snap logic, adds dependency for no real gain
- gridstack.js -- jQuery-era, heavy (~50 kB)

### Expected Features

**Must have (table stakes):**
- Snap-to-grid resize via SE corner drag handle (edit mode only)
- Visual resize handle affordance (bottom-right corner, industry standard)
- Per-widget minimum column-span constraints (stat=1, chart=2, table=2)
- Persist resized dimensions via existing settings API
- Responsive fallback to single-column on mobile (already exists)
- Navbar-style top bar with inline account stats and controls

**Should have (differentiators):**
- Size presets per widget type (S/M/L quick buttons alongside free resize)
- Resize preview ghost showing target grid cells during drag
- Widget-aware minimum sizes (charts need 2+ cols, tables need 2+ cols)
- Lock individual cards from accidental resize/move

**Defer (v2+):**
- Row-span height control (explicitly out of scope per PROJECT.md -- include `h` in data model but do not expose UI)
- 12-column grid upgrade (6 columns is sufficient for current widget set)
- Per-breakpoint layout editing (single layout with auto-degradation is correct)
- Undo/redo for layout changes (templates serve as checkpoints)

### Architecture Approach

The architecture is an incremental extension, not a rewrite. DashboardShell.tsx stays as the single orchestrator file. The top bar replaces the title + account summary strip. Card styling updates are CSS-only. The resize feature adds a hook and component alongside existing @dnd-kit drag. No new database tables, API routes, or React contexts are needed. The layout data model extends `sizes: Record<string, WidgetSize>` from string-based (`"large"`) to object-based (`{ w: 3, h: 1 }`), with a backward-compatible migration function at load time.

**Major components:**
1. **DashboardShell.tsx** -- header restructure (remove title/summary, add top bar), card style update, resize handle integration
2. **`useGridResize` hook** (new) -- pointer event tracking, grid-cell calculation, colSpan update with clamping
3. **`ResizeHandle` component** (new) -- SE corner visual indicator, edit-mode visibility, event isolation from @dnd-kit
4. **WidgetCard** -- style update (rounded-md, borders, darker bg), dynamic `gridColumn` inline style replacing Tailwind classes

### Critical Pitfalls

1. **@dnd-kit rectSortingStrategy breaks with variable-sized items** -- the existing sorting strategy assumes uniform item sizes. More size granularity makes this worse. Mitigation: consider null sorting strategy with manual reorder, or accept current behavior since users are already accustomed to it with 3 sizes.

2. **Resize handles intercepted by @dnd-kit drag sensors** -- pointer events on the resize handle can trigger drag instead of resize. Mitigation: `e.stopPropagation()` on resize handle, increase PointerSensor activation distance to 8px, keep resize handle and drag handle spatially separated (bottom-right corner vs top header grip).

3. **Recharts ResponsiveContainer performance collapse** -- continuous resize events trigger 60+ chart re-renders per second across 24+ widgets. Mitigation: debounce ResizeObserver (150ms), show placeholder during active resize, re-render charts only on resize end.

4. **Layout migration breaks saved user layouts** -- switching from string sizes to `{ w, h }` objects invalidates all saved layouts, per-account layouts, and templates. Mitigation: backward-compatible migration function that accepts both formats, applied at every load point (main layout, templates, built-in presets).

5. **CSS Grid gaps with variable spans** -- auto-placement creates holes when mixing different col-span values. Mitigation: use `grid-auto-flow: dense` or keep the current 3-size system where gaps are less pronounced. Explicit grid placement is only needed if row-spans are added later.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Top Bar and Layout Restructure
**Rationale:** Highest visual impact, lowest risk. Pure UI restructure with no data model or interaction changes. Establishes the viewport-locked layout pattern used by the trades page.
**Delivers:** Navbar-style top bar with inline account stats, time filter pills, and control buttons. Scrollable content area below. Removes page title and separate account summary strip.
**Addresses:** Trades-page design consistency, dashboard header consolidation
**Avoids:** No data model changes means zero risk of breaking saved layouts

### Phase 2: Card Design Update
**Rationale:** CSS-only changes that can be verified visually. Independent of resize mechanics. Sets the visual foundation before adding interactive features.
**Delivers:** Updated card styling (rounded-md, explicit borders, darker bg), uniform minimum row height via `grid-auto-rows`, removal of open trades section.
**Addresses:** Visual consistency with trades page design language
**Avoids:** No interaction changes, no risk of event conflicts

### Phase 3: Resize Handle Implementation
**Rationale:** Depends on Phase 2 (card styling must be finalized before adding interactive elements). This is the core feature delivery.
**Delivers:** SE corner resize handles in edit mode, snap-to-grid column resize, layout persistence with new `{ w, h }` format, backward-compatible migration for saved layouts and templates.
**Addresses:** Grid-based resizable cards (the milestone's primary feature)
**Avoids:** Recharts re-render storm (debounce strategy), @dnd-kit event conflict (stopPropagation + spatial separation), layout migration breakage (dual-format support)

### Phase 4: Polish and Edge Cases
**Rationale:** After core resize works, handle the long tail of UX details.
**Delivers:** Resize preview ghost, per-widget minimum size constraints, template migration verification, mobile responsive adjustments, performance optimization for 24+ widget resize.
**Addresses:** Size presets, widget-aware minimums, template compatibility
**Avoids:** Scope creep into row-span or 12-column grid (explicitly deferred)

### Phase Ordering Rationale

- Phases 1-2 are visual-only and can be shipped independently, giving immediate value without any risk to the resize feature.
- Phase 3 is the core feature and benefits from stable card styling (Phase 2) being in place first.
- Phase 4 is polish that should not block shipping Phase 3. It can be trimmed if the milestone runs long.
- Row-span support is not in any phase. The data model includes `h` from Phase 3 onward, but no UI exposes it. This is intentional per PROJECT.md.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** The resize handle implementation needs careful attention to @dnd-kit event isolation and Recharts debouncing. Research during planning should produce exact pointer event handling code and test the stopPropagation approach against the current PointerSensor configuration.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Viewport-locked layout with sticky top bar -- identical pattern to the existing trades page. Copy the approach directly.
- **Phase 2:** CSS class updates -- no research needed, just systematic find-and-replace of card styling.
- **Phase 4:** Polish items are all well-documented patterns (min-size constraints, template migration, resize preview).

## Researcher Disagreement Resolution

FEATURES.md and PITFALLS.md lean toward react-grid-layout. STACK.md and ARCHITECTURE.md recommend extending @dnd-kit with custom resize. The resolution:

**Keep @dnd-kit + custom resize. Do not adopt react-grid-layout.**

The disagreement stems from different frames of reference. FEATURES.md evaluated dashboard products (Grafana, Datadog) that use react-grid-layout-like systems and correctly noted its capabilities. PITFALLS.md identified real risks with @dnd-kit's variable-size handling and noted that react-grid-layout solves them natively. However, both underweighted the migration cost.

STACK.md and ARCHITECTURE.md analyzed the actual codebase and found:
- react-grid-layout uses absolute positioning, not CSS Grid -- it is a fundamentally different layout engine
- Adopting it requires removing all @dnd-kit code from the dashboard AND rewriting the layout data model
- The existing 3-size system already works with @dnd-kit's limitations -- users are accustomed to the behavior
- The resize feature needed is discrete column-span snapping (1-6 values), not arbitrary pixel resize with auto-compaction
- A custom hook (~200 lines) achieves the same result with zero migration risk

The FEATURES.md recommendation for 12-column grid is also deferred. Six columns provides sufficient granularity for the current 24-widget set. Moving to 12 columns can happen in a future milestone if finer control is needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase analysis, verified against @dnd-kit GitHub issues, bundle size confirmed |
| Features | HIGH | Cross-referenced with Grafana, Datadog, Metabase, Home Assistant patterns |
| Architecture | HIGH | Full read of DashboardShell.tsx (~770 lines), integration points verified against existing code |
| Pitfalls | HIGH | All critical pitfalls verified against library GitHub issues with maintainer responses |

**Overall confidence:** HIGH

### Gaps to Address

- **@dnd-kit null sorting strategy:** PITFALLS.md recommends switching to a null sorting strategy for variable-sized items, but this is a significant change to drag behavior. Needs validation during Phase 3 planning -- test whether the current rectSortingStrategy is "good enough" with the new size granularity before committing to the null strategy rewrite.
- **Exact row height for `grid-auto-rows`:** ARCHITECTURE.md suggests `minmax(200px, auto)` but the exact value needs visual testing with all 24 widget types. Determine during Phase 2 execution.
- **Resize handle size and hit target:** PITFALLS.md recommends 16x16px minimum (24x24px touch-friendly). Exact dimensions need UX testing to balance visibility vs visual noise.

## Sources

### Primary (HIGH confidence)
- Codebase: `DashboardShell.tsx` -- full layout system, @dnd-kit integration, settings persistence
- Codebase: `PersistentChart.tsx` -- resize overlay pattern (transparent div during drag)
- [@dnd-kit Issue #720](https://github.com/clauderic/dnd-kit/issues/720) -- variable-sized grid items limitation
- [Recharts Issue #1767](https://github.com/recharts/recharts/issues/1767) -- ResponsiveContainer resize performance
- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- evaluated and rejected

### Secondary (MEDIUM confidence)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) -- panel sizing patterns
- [Datadog Dashboard Docs](https://docs.datadoghq.com/dashboards/) -- grid snap behavior reference
- [Home Assistant Dashboard Chapter 2](https://www.home-assistant.io/blog/2024/07/26/dashboard-chapter-2/) -- drag-and-drop grid UX
- [PatternFly Dashboard Design Guidelines](https://www.patternfly.org/patterns/dashboard/design-guidelines/) -- card grid spacing

### Tertiary (LOW confidence)
- [AntStack: React Grid Layout blog post](https://www.antstack.com/blog/building-customizable-dashboard-widgets-using-react-grid-layout/) -- implementation patterns (blog post, not official docs)

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
