# Feature Landscape

**Domain:** Dashboard Redesign — Grid-Based Resizable Cards
**Researched:** 2026-03-22
**Milestone:** v3.1 Dashboard Redesign

---

## Existing Foundation (Do Not Re-Build)

The current dashboard already has:
- 38 widget definitions (25 visible by default, 8 hidden)
- Edit mode with drag-reorder via @dnd-kit (SortableContext + rectSortingStrategy)
- 3 size modes per widget: large (3 cols), medium (2 cols), compact (1 col) — cycled via button
- 6-column CSS grid (`grid-cols-1 md:grid-cols-6`)
- Layout persistence via settings API (`dashboard_layout` key: order, hidden, sizes)
- Per-account layout storage (scoped settings keys with legacy fallback)
- Layout templates: save/load/delete user presets + built-in defaults
- Time filter (30/60/90/All days)
- Privacy toggle (eye icon)
- TemplatePanel component for preset management

These are the **starting points** for the resize feature, not features to rebuild.

---

## Table Stakes

Features users expect from a resizable dashboard. Missing = resize feels broken or toy-like.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Snap-to-grid resize | Every professional dashboard (Grafana, Datadog, Metabase, Home Assistant) snaps widgets to grid cells. Free-form pixel resize creates alignment chaos. | Medium | Column-span + row-span snapping. react-grid-layout handles this natively. |
| Visual resize handle | Users need an affordance showing the card is resizable. Bottom-right corner handle is the universal convention (Grafana, Datadog, Metabase all use it). | Low | Small triangle or dots icon at SE corner, visible only in edit mode or on hover. |
| Minimum card dimensions | Cards must not shrink below their content minimum. A stat card needs at least 1x1, a chart needs at least 2x2, a table needs at least 2x3. | Low | Per-widget `minW`/`minH` constraints in layout config. |
| Cards push neighbors on resize | When a card grows, overlapping cards must shift down (vertical compaction). Grafana and Datadog both do this — no overlapping cards allowed. | Medium | react-grid-layout's built-in vertical compaction handles this automatically. |
| Persist resized dimensions | User resizes a card, refreshes page, it stays that size. Already have settings persistence — extend the layout format to include height. | Low | Add `h` (row span) to layout item alongside existing `w` (col span). |
| Resize in edit mode only | Resize handles showing at all times clutters the UI. Show only when user enters edit mode (pencil icon already exists). | Trivial | Conditional `isResizable` prop or CSS visibility toggle. |
| Responsive layout fallback | On mobile/tablet, grid-based resize must degrade to stacked single-column. Cannot expect phone users to resize cards. | Low | Already have `grid-cols-1` mobile breakpoint. react-grid-layout Responsive component handles this with breakpoint-specific layouts. |

---

## Differentiators

Features that elevate the dashboard beyond basic resize. Not expected, but valued by power users.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Row-span resize (height control) | Most trading dashboards only allow column-span changes. Adding row-span gives true 2D grid control — make the heatmap tall, the P&L chart wide-and-short. Currently out of scope per PROJECT.md but this milestone should lay groundwork. | Medium | react-grid-layout supports `h` natively. Need to define row height (e.g., 80px per row unit). |
| Size presets per widget type | Instead of only free resize, offer quick size buttons: "S / M / L / XL" that map to common aspect ratios per widget type. Bridges the gap between the current 3-size system and free resize. | Low | Extend current size cycle to include row-span presets. E.g., chart "L" = 3w x 4h, stat "L" = 2w x 1h. |
| Resize preview ghost | While dragging a resize handle, show a translucent blue overlay indicating the target grid cells. Grafana does this — makes snap behavior predictable. | Medium | react-grid-layout provides placeholder styling via CSS class `.react-grid-placeholder`. |
| Widget-aware minimum sizes | Different widgets have different content minimums. A stat number works at 1x1. A recharts area chart needs 2x2 minimum to be readable. A performance table needs 2x3. | Low | Define per-widget `minW`/`minH` map. Prevents users from creating illegible cards. |
| Lock individual cards | Power users arrange their dashboard and want to lock specific cards from being accidentally moved/resized while editing others. Datadog supports this. | Low | Per-item `static: true` in react-grid-layout. Add lock icon per card in edit mode. |
| Layout reset to default | After extensive customization, users need a "reset to factory defaults" escape hatch. | Trivial | Already exists in current template system (built-in presets). Ensure "Default" template restores the original layout including new height dimensions. |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Free-form pixel positioning | Leads to misaligned cards, gaps, and overlaps. Every serious dashboard uses grid snap. | Snap-to-grid only — column and row units, never pixels. |
| Resize from all 8 directions | Overwhelming UI, unnecessary for dashboard cards. NW/NE/SW handles cause confusing reflows. | SE corner handle only (industry standard). Optionally S and E edges for power users. |
| Different layouts per breakpoint with independent editing | Managing 4+ separate layouts (lg/md/sm/xs) is a UX nightmare for solo traders. | Single layout that auto-collapses at smaller breakpoints. The responsive component handles degradation automatically. |
| Inline card content editing while resizing | Mixing content editing with layout editing creates mode confusion. | Keep resize in edit mode only; card content remains view-only during layout changes. |
| Animation-heavy resize transitions | CSS transitions on grid items during resize cause jank, especially with recharts re-rendering. | Instant snap with optional subtle transition (100-150ms max) on the placeholder only. |
| Card overlap / z-index stacking | Overlapping cards with z-ordering is a Figma feature, not a dashboard feature. It breaks scanability. | Enforce non-overlapping grid with vertical compaction. |
| Undo/redo for layout changes | High complexity, low value for this milestone. Templates already serve as checkpoints. | Save layout as template before major changes. Rely on reset-to-default. |

---

## UX Patterns

### Resize Handle Design

**Recommendation: SE corner triangle, edit-mode only**

The industry standard is a small visual indicator at the bottom-right corner of each card:

- **Grafana**: Small dotted triangle at SE corner, subtle gray, visible in edit mode
- **Datadog**: Resize handle at bottom-left or bottom-right corners of widget groups
- **Metabase**: Click-and-drag handle at bottom-right corner, cards snap to grid
- **Home Assistant**: Drag handles appear in edit mode, grid overlay shown during drag

Implementation pattern:
```
.resize-handle {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  cursor: se-resize;
  opacity: 0;                    /* hidden by default */
}
.card:hover .resize-handle,
.edit-mode .resize-handle {
  opacity: 0.5;                  /* visible on hover or in edit mode */
}
```

react-grid-layout supports custom resize handle components via the `resizeHandle` prop, so the existing card styling (rounded-md, ring borders) can incorporate the handle naturally.

### Snap-to-Grid Behavior

**Recommendation: 12-column grid with fixed row height**

Current system uses 6 columns. Moving to 12 columns doubles the granularity without changing the visual layout (current "large" = 6 cols becomes 6/12, "medium" = 4/12, "compact" = 2/12).

Row height should be a fixed unit (e.g., 80px) so that:
- A stat card = 2 cols x 1 row (160px x 80px)
- A chart card = 6 cols x 3 rows (480px x 240px)
- A table card = 6 cols x 5 rows (480px x 400px)
- A full-width hero = 12 cols x 4 rows (960px x 320px)

react-grid-layout's `rowHeight` prop controls this globally.

### Minimum Card Sizes

**Recommendation: Per-widget-type minimums**

| Widget Type | Min Width (cols) | Min Height (rows) | Examples |
|-------------|-----------------|-------------------|----------|
| Single stat | 2 | 1 | Total Trades, Profit Factor, Win %, Total Fees |
| Comparison | 2 | 2 | Win vs Loss, Avg Win vs Avg Loss, Largest Gain vs Loss |
| Area/bar chart | 4 | 3 | Cumulative P&L, Drawdown, Win %, Daily Volume |
| Perf table | 4 | 4 | By Day of Week, By Symbol, By Month, Tag Breakdown |
| Heatmap | 4 | 3 | Trading Activity heatmap |
| Symbol P&L bar | 4 | 3 | P&L by Symbol horizontal bars |
| Distribution chart | 4 | 3 | P&L by Day of Week, P&L by Hour |
| Market widget | 2 | 2 | Fear & Greed, VIX, Market Overview |
| Complex (simulator/AI) | 6 | 5 | Monte Carlo, AI Insights, IBKR Positions |

### Responsive Breakpoints

**Recommendation: 3 breakpoints, not 5**

| Breakpoint | Width | Columns | Behavior |
|------------|-------|---------|----------|
| lg | >= 1200px | 12 | Full grid with user-defined layout |
| md | >= 768px | 6 | Cards auto-resize to fit 6 cols, maintain relative order |
| sm | < 768px | 1 | Single column stack, all cards full-width |

Do NOT create separate editable layouts per breakpoint. The lg layout is the "source of truth" and md/sm are automatic degradations.

### Edit Mode Indicators

When edit mode is active:
1. All cards get a subtle dashed border or blue tint to indicate editability
2. Drag handle (GripVertical icon) appears in card header — already exists
3. Resize handle appears at SE corner of each card
4. Grid lines or subtle background dots appear to show the snap grid
5. A floating "Done Editing" bar appears at top

### Card Design During Resize

- While actively dragging a resize handle, the card being resized should show its current dimensions as a tooltip (e.g., "6 x 3")
- The placeholder (target position) should be a semi-transparent blue rectangle
- Other cards should smoothly shift to accommodate the new size
- Card content (charts, tables) should NOT re-render during drag — only on drop (debounce)

---

## Complexity Notes

### Migration from @dnd-kit to react-grid-layout

The current codebase uses @dnd-kit for drag-reorder. react-grid-layout provides both drag AND resize natively. Key migration considerations:

1. **@dnd-kit does NOT support resize.** Building resize on top of @dnd-kit requires a custom implementation of hit detection, grid snapping, placeholder rendering, and compaction — essentially reimplementing react-grid-layout from scratch.

2. **react-grid-layout replaces @dnd-kit entirely** for this use case. It handles drag, resize, grid compaction, responsive breakpoints, and layout serialization.

3. **Layout format change**: Current layout is `{ order: string[], hidden: string[], sizes: Record<string, WidgetSize> }`. react-grid-layout uses `{ i: string, x: number, y: number, w: number, h: number, minW?, minH? }[]`. Need a migration path for existing saved layouts.

4. **SSR / hydration**: react-grid-layout measures container width at runtime. In Next.js App Router with "use client", use dynamic import with `{ ssr: false }` or the `useContainerWidth` hook to avoid hydration mismatches.

5. **Performance with 25+ widgets**: react-grid-layout handles this fine — Grafana dashboards regularly have 20-30 panels. However, re-rendering recharts on every resize event will cause jank. Debounce chart re-renders to `onResizeStop` only.

### Layout Data Migration

Old format:
```json
{
  "order": ["cumulative-pnl", "fear-greed", ...],
  "hidden": ["dist-weekday", ...],
  "sizes": { "cumulative-pnl": "large", "fear-greed": "compact" }
}
```

New format (react-grid-layout compatible):
```json
{
  "layout": [
    { "i": "cumulative-pnl", "x": 0, "y": 0, "w": 6, "h": 4, "minW": 4, "minH": 3 },
    { "i": "fear-greed", "x": 6, "y": 0, "w": 2, "h": 2, "minW": 2, "minH": 2 }
  ],
  "hidden": ["dist-weekday", ...]
}
```

Migration function needed: convert old `order` + `sizes` into explicit `x, y, w, h` positions by placing widgets sequentially in a 12-column grid.

### Chart Re-render Strategy

Recharts components re-render when their container size changes. During active resize:
- Use `onResize` to update a CSS-only container size (no React state update)
- Use `onResizeStop` to commit the final size and trigger chart re-render
- Wrap chart widgets in a `ResizeObserver`-aware container that debounces re-renders

### Template Compatibility

Existing `LayoutTemplate` and `BuiltInTemplate` interfaces store `DashboardLayout` (order/hidden/sizes). After migration:
- Built-in templates need new format with explicit x/y/w/h
- User-saved templates in old format need automatic migration on load
- Template save/load must use new layout format going forward

---

## Feature Dependencies

```
react-grid-layout integration (replaces @dnd-kit for dashboard)
  -> prerequisite for: Snap-to-grid resize
  -> prerequisite for: Row-span control (height)
  -> prerequisite for: Responsive breakpoints
  -> prerequisite for: Resize handles

Layout data migration
  -> prerequisite for: Persisting new layout format
  -> prerequisite for: Template compatibility
  -> depends on: react-grid-layout integration (need target format)

Per-widget minimum sizes
  -> depends on: react-grid-layout integration (minW/minH props)
  -> independent of: layout migration (can define minimums separately)

Navbar-style top bar (account stats + controls)
  -> independent of: grid resize (visual change only)
  -> parallel with: react-grid-layout integration

Card visual redesign (borders, bg, fonts)
  -> independent of: resize mechanics
  -> parallel with: react-grid-layout integration
```

---

## MVP Recommendation

Prioritize in this order:

1. **react-grid-layout integration** — Replace @dnd-kit with react-grid-layout for the dashboard grid. This is the foundation. Keep existing @dnd-kit usage for non-dashboard drag (trade table columns, etc.). Use dynamic import with `ssr: false` for Next.js compatibility.

2. **Layout data migration** — Write a migration function that converts old `order + sizes` format to explicit `x/y/w/h` grid positions. Run on first load, save back in new format. Maintain backward compatibility for old saved templates.

3. **Snap-to-grid resize with SE handle** — Enable resize on all cards in edit mode. SE corner handle only. Per-widget minimum sizes defined. Cards compact vertically on resize.

4. **Navbar-style top bar** — Move account stats and layout controls from current header into a trades-page-style sticky top bar. Independent of resize work.

5. **Card visual redesign** — Match trades page design language: `rounded-md`, `ring-1 ring-inset`, consistent padding, font sizing. Apply to all 38 widget card wrappers.

6. **Template migration** — Update built-in presets to use new layout format. Auto-migrate user templates on load.

**Defer:** Row-span height control is listed as out of scope in PROJECT.md ("Dashboard widget height adjustment — deferred to later milestone"). However, react-grid-layout supports it natively, so the data format should include `h` from day one even if the UI doesn't expose height resize handles yet. This avoids a second data migration later.

---

## Sources

- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) — v2.0+ API, resize handles, responsive breakpoints, layout format (HIGH confidence)
- [ilert: Why React-Grid-Layout Was Our Best Choice](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) — real-world integration rationale (MEDIUM confidence)
- [Datadog Dashboard Docs](https://docs.datadoghq.com/dashboards/) — grid snap behavior, widget resize, auto-alignment (HIGH confidence)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) — panel sizing, layout design (HIGH confidence)
- [PatternFly Dashboard Design Guidelines](https://www.patternfly.org/patterns/dashboard/design-guidelines/) — card grid patterns, spacing standards (MEDIUM confidence)
- [Baymard: Dashboard Cards Layout](https://baymard.com/blog/cards-dashboard-layout) — card consistency, spacing research (MEDIUM confidence)
- [Home Assistant Dashboard Chapter 2](https://www.home-assistant.io/blog/2024/07/26/dashboard-chapter-2/) — drag-and-drop grid, card resize UX (MEDIUM confidence)
- [dnd-kit Discussion #1560](https://github.com/clauderic/dnd-kit/discussions/1560) — confirms dnd-kit lacks grid resize; react-grid-layout recommended instead (HIGH confidence)
- [Metabase Dashboard Docs](https://www.metabase.com/docs/latest/dashboards/introduction) — resize handle at bottom-right, grid snap (MEDIUM confidence)
- [AntStack: Building Dashboard Widgets with React Grid Layout](https://www.antstack.com/blog/building-customizable-dashboard-widgets-using-react-grid-layout/) — implementation patterns (LOW confidence)
