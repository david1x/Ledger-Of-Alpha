# Domain Pitfalls

**Domain:** Grid-based resizable dashboard cards — adding column/row span resize to existing Next.js 15 dashboard with @dnd-kit drag reorder, 6-column CSS grid, Recharts widgets, and JSON layout persistence (v3.1 Dashboard Redesign)
**Researched:** 2026-03-22
**Confidence:** HIGH (direct codebase analysis + verified research against @dnd-kit issues and Recharts known bugs)

---

## Critical Pitfalls

### Pitfall 1: @dnd-kit rectSortingStrategy Breaks with Variable-Sized Grid Items

**What goes wrong:** The current dashboard uses `rectSortingStrategy` from @dnd-kit/sortable, which assumes all grid items are the same size. When widgets have different column spans (1, 2, or 3 cols) AND different row spans, @dnd-kit measures the first item and assumes all others match. Dragging a 3-col widget over a 1-col widget causes visual glitches: items overlap, sort animations jump to wrong positions, and the drop target calculation is incorrect.

**Why it happens:** `rectSortingStrategy` calculates expected positions using a uniform grid assumption. Variable `col-span` and `row-span` values break this assumption. The library author explicitly acknowledged this is a known limitation (GitHub issue #720, #77, #117).

**Consequences:** Widgets visually overlap during drag, drop in wrong positions, or cause layout to "explode" with items jumping unpredictably. Users see broken drag behavior and lose trust in the layout editor.

**Prevention:**
- Use a **null sorting strategy** (`strategy={() => null}`) and handle reordering manually in `onDragOver`/`onDragEnd`. This is the officially recommended workaround from the @dnd-kit maintainer.
- Maintain a separate layout model that tracks each widget's grid position (col, row, colSpan, rowSpan) independently of CSS grid auto-placement.
- Use a `DragOverlay` component to render the dragged item at the correct size rather than relying on in-place transforms.

**Detection:** Test by dragging a compact (1-col) widget over a large (3-col) widget and vice versa. If the widget being displaced jumps to the wrong row or overlaps, the sorting strategy is broken.

**Confidence:** HIGH -- verified against multiple @dnd-kit GitHub issues (#720, #77, #804) and maintainer responses.

---

### Pitfall 2: Resize Handles Intercepted by @dnd-kit Drag Sensors

**What goes wrong:** Adding resize handles (e.g., bottom-right corner grip) to cards that are also draggable creates an event conflict. The `PointerSensor` from @dnd-kit captures `pointerdown` events on the resize handle and initiates a drag instead of a resize. Users try to resize but the card starts moving.

**Why it happens:** @dnd-kit's `useSortable` attaches pointer listeners to the entire sortable element by default. Even with a separate drag handle (the `GripVertical` icon currently used in edit mode), the resize handle's mousedown/pointerdown events can bubble up to the sortable wrapper or conflict with the sensor's activation logic.

**Consequences:** Resize is impossible or triggers drag instead. Users cannot resize cards at all, or resize works only intermittently.

**Prevention:**
- **Separate interaction zones completely.** The drag handle (`GripVertical`) should be the ONLY element that triggers drag. Use `useSortable` with `{ id, ..., activators }` or configure the `PointerSensor` with `activationConstraint: { distance: 8 }` to require 8px of movement before drag starts.
- **Stop propagation on resize handles.** On the resize handle's `onPointerDown`, call `e.stopPropagation()` before initiating resize logic.
- Ensure resize handles have a higher `z-index` than the drag overlay and are rendered outside the drag handle's event scope.
- Consider restricting drag to edit mode only (current behavior) and allowing resize in both edit and normal modes, reducing the window for conflicts.

**Detection:** In edit mode, try to resize a card by its bottom-right handle. If the card lifts and starts dragging instead, the events are conflicting.

**Confidence:** HIGH -- this is a well-documented interaction pattern issue in drag-and-drop libraries.

---

### Pitfall 3: Recharts ResponsiveContainer Performance Collapse During Resize

**What goes wrong:** Recharts' `ResponsiveContainer` uses `ResizeObserver` to detect parent size changes and re-renders the entire SVG chart on every observation. When a user drags a resize handle, the container fires resize events continuously (potentially 60+ times per second), causing every visible chart to re-render simultaneously. With 24+ widgets on screen, this causes severe frame drops, UI freezing, and horizontal overflow artifacts.

**Why it happens:** `ResponsiveContainer` has no built-in debounce. Each resize observation triggers a full React re-render of the chart component, including all axes, grids, areas, and tooltips. Multiple charts resizing simultaneously compounds the problem. This is a known issue (recharts/recharts#1767, closed as "not planned").

**Consequences:** Dashboard becomes unresponsive during resize. Frame rate drops to single digits. Browser tab may become temporarily unresponsive. CSS overflow artifacts appear during the lag.

**Prevention:**
- **Debounce resize observations.** Wrap each chart widget in a container that debounces `ResizeObserver` callbacks (150-200ms). Only pass final dimensions to `ResponsiveContainer` after the user stops resizing.
- **Hide chart content during active resize.** Show a placeholder (skeleton or blurred snapshot) while the resize handle is being dragged. Re-render the chart only on `onResizeEnd`.
- **Use CSS `contain: layout style paint` on chart containers** to prevent layout thrashing from propagating to parent elements.
- **Set `width: 0` on flex-child containers** holding `ResponsiveContainer` as a CSS workaround for the shrink-direction bug.

**Detection:** Open the dashboard with 10+ chart widgets visible. Resize any card by dragging. If the UI stutters or freezes, the debounce is missing.

**Confidence:** HIGH -- verified against recharts GitHub issue #1767 and tested pattern.

---

### Pitfall 4: Layout Migration Breaks Saved User Layouts and Templates

**What goes wrong:** The current `DashboardLayout` schema stores `{ order: string[], hidden: string[], sizes: Record<string, WidgetSize> }` where `WidgetSize` is `"large" | "medium" | "compact"` mapping to fixed col-span values (3, 2, 1). Switching to grid-based resize requires storing `{ colSpan: number, rowSpan: number }` per widget. All existing saved layouts, per-account layouts, and user-created templates become incompatible.

**Why it happens:** The current schema has no concept of row span. Column sizes are semantic names ("large" = 3 cols) rather than numeric spans. The migration to `{ colSpan, rowSpan }` requires converting every saved layout. There are multiple storage keys: `dashboard_layout`, `dashboard_layout_{accountId}`, `dashboard_layout_all_accounts`, and `dashboard_layout_templates`.

**Consequences:** After deployment, users open their dashboard and see broken layouts, default layouts, or crashes from parsing errors. Per-account customizations are lost. Saved templates revert to defaults.

**Prevention:**
- **Write an explicit migration function** in the layout loading code (where the "normal" to "large" migration already exists at line ~419). Map `"compact"` to `{colSpan: 1, rowSpan: 1}`, `"medium"` to `{colSpan: 2, rowSpan: 1}`, `"large"` to `{colSpan: 3, rowSpan: 1}`.
- **Keep the migration backwards-compatible.** Check for both old schema (`sizes: Record<string, WidgetSize>`) and new schema (`sizes: Record<string, {colSpan, rowSpan}>`) in the layout parser. Accept both formats.
- **Migrate templates too.** Both user templates (`dashboard_layout_templates`) and built-in templates (`DEFAULT_BUILT_IN_TEMPLATES`) need schema updates.
- **Test with a real saved layout** from the current production system, not just default layouts.

**Detection:** Save a layout in the current system, deploy the new code, and verify the saved layout loads correctly with proper widget sizes.

**Confidence:** HIGH -- direct analysis of the existing codebase schema at DashboardShell.tsx lines 107-156 and 404-424.

---

## Integration Risks

### Risk 1: CSS Grid Auto-Placement vs Explicit Positioning Conflict

**What goes wrong:** The current dashboard uses CSS Grid with `grid-cols-6` and relies on auto-placement (items flow left-to-right, top-to-bottom based on their `col-span`). With variable row spans, auto-placement creates gaps. A widget with `row-span: 2` next to a `row-span: 1` widget leaves empty cells that CSS Grid cannot backfill by default.

**Why it happens:** CSS Grid's auto-placement algorithm places items sequentially. It does not backfill gaps unless `grid-auto-flow: dense` is enabled. Even with `dense`, the visual order may not match the logical order, breaking @dnd-kit's sort assumptions.

**Impact:** Dashboard has visible gaps between cards. Layout looks broken even though the CSS is technically correct. Users see "holes" in their dashboard.

**Mitigation:**
- Use `grid-auto-flow: dense` to backfill gaps, BUT be aware this changes visual order. The drag-and-drop order array must reflect the visual position, not the DOM order.
- Alternatively, use **explicit grid placement** (`grid-column` and `grid-row` CSS properties per widget) calculated from the layout model. This gives full control but requires computing positions in JavaScript.
- The explicit placement approach pairs better with the null sorting strategy recommended for Pitfall 1.

**Confidence:** HIGH -- standard CSS Grid behavior, well-documented in MDN.

---

### Risk 2: Responsive Breakpoints with Variable Sizes

**What goes wrong:** The current responsive strategy is simple: on mobile (`< md`), all widgets become `col-span-1` in a single-column layout. With row spans added, a widget that is 3 cols x 2 rows on desktop needs sensible mobile dimensions. Blindly setting `col-span-1` while keeping `row-span: 2` creates excessively tall single-column cards.

**Why it happens:** The current system maps sizes to Tailwind responsive classes (`col-span-1 md:col-span-2`). Row spans have no responsive equivalent in the current approach.

**Impact:** Mobile layout looks broken with some cards taking up excessive vertical space.

**Mitigation:**
- Reset row spans to 1 on mobile breakpoints. Only apply custom row spans at `md` and above.
- Define a mobile layout override that ignores row spans entirely and stacks all widgets as `1x1`.
- Use a `useMediaQuery` hook to switch between grid-placement mode (desktop) and simple stack mode (mobile).

**Confidence:** HIGH -- standard responsive design concern.

---

### Risk 3: Resize Handle Z-Index Stacking with Card Content

**What goes wrong:** Resize handles positioned at the bottom-right corner of a card overlap with card content: chart tooltips, table pagination buttons, "Show more" links, and heatmap click targets. The resize handle either covers interactive content or gets covered by it.

**Why it happens:** Cards contain diverse content types (charts, tables, buttons) with their own z-index stacking contexts. The resize handle must be above all card content but below the drag overlay and modal layers.

**Impact:** Users accidentally resize when clicking pagination buttons, or cannot reach the resize handle because a chart tooltip covers it.

**Mitigation:**
- Place resize handles at `z-10` within the card (above card content).
- Ensure card content (charts, tables) does not create higher stacking contexts.
- Make the resize handle visible only on card hover or in edit mode to reduce accidental activation.
- Use a distinct visual indicator (e.g., diagonal grip lines) and cursor (`cursor-se-resize`) so users can distinguish resize from content interaction.
- Size the handle at minimum 16x16px (touch-friendly: 24x24px) but keep it visually subtle.

**Confidence:** MEDIUM -- depends on specific content types and their z-index requirements.

---

### Risk 4: Template System Compatibility

**What goes wrong:** The existing template system (both user-saved and built-in `DEFAULT_BUILT_IN_TEMPLATES`) stores layouts in the old schema format. After the resize migration, loading an old template applies the old `WidgetSize` type instead of `{colSpan, rowSpan}`, causing type errors or visual bugs.

**Why it happens:** Templates are serialized to JSON and stored in the settings API. The built-in templates are hardcoded in `DashboardShell.tsx`. Both need simultaneous updates.

**Impact:** Loading a saved template crashes or produces a broken layout. Built-in "Performance Review" and "Daily Monitor" templates apply incorrect sizes.

**Mitigation:**
- Apply the same migration logic from Pitfall 4 when loading templates, not just the main layout.
- Update `DEFAULT_BUILT_IN_TEMPLATES` and `DEFAULT_SIZES` to use the new schema.
- The `handleLoadTemplate` function (line ~527) must handle both old and new formats.

**Confidence:** HIGH -- direct code analysis.

---

## Prevention Strategies

### Strategy 1: Use Explicit Grid Placement Instead of Auto-Flow

Rather than relying on CSS Grid auto-placement with `col-span` classes, compute explicit `grid-column` and `grid-row` values for each widget based on a layout algorithm. This approach:

- Eliminates gaps from mixed row spans
- Gives precise control over widget positions
- Pairs naturally with the null sorting strategy for @dnd-kit
- Makes the layout model the single source of truth

**Implementation:** Maintain a `positions: Record<string, {col: number, row: number, colSpan: number, rowSpan: number}>` in the layout state. On drag-end or resize-end, recalculate all positions using a packing algorithm (top-left gravity, similar to what react-grid-layout uses).

### Strategy 2: Debounce All Resize Observations

Create a `useResizeObserver` hook that wraps `ResizeObserver` with a 150ms debounce. Use this for all chart-containing widgets instead of relying on Recharts' built-in `ResponsiveContainer` resize detection.

```typescript
// Pattern: debounced resize for chart containers
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
const resizeTimer = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => {
  const observer = new ResizeObserver((entries) => {
    clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    }, 150);
  });
  if (containerRef.current) observer.observe(containerRef.current);
  return () => { observer.disconnect(); clearTimeout(resizeTimer.current); };
}, []);
```

### Strategy 3: Separate Resize and Drag into Distinct Modes

The current dashboard already has an "edit mode" toggle. Extend this:

- **Normal mode:** No drag, no resize. Cards are static.
- **Edit mode:** Drag handles appear AND resize handles appear. Both active.
- Use `e.stopPropagation()` on resize handles to prevent drag sensor activation.
- Configure `PointerSensor` with `activationConstraint: { distance: 8 }` so tiny accidental movements on resize handles do not trigger drag.

### Strategy 4: Snapshot-Based Resize Preview

During active resize (while the user is dragging the handle):

1. Hide the chart/table content
2. Show a lightweight placeholder (card title + target dimensions text)
3. On resize end, reveal content and let Recharts re-render once

This eliminates the performance problem entirely by avoiding continuous chart re-renders during resize.

---

## Migration Considerations

### Layout Schema Migration Path

**Current schema:**
```typescript
interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes: Record<string, "large" | "medium" | "compact">;
}
```

**Target schema:**
```typescript
interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes: Record<string, { colSpan: number; rowSpan: number }>;
}
```

**Migration function:**
```typescript
function migrateSize(size: string | { colSpan: number; rowSpan: number }): { colSpan: number; rowSpan: number } {
  if (typeof size === 'object' && 'colSpan' in size) return size; // already new format
  switch (size) {
    case 'large': case 'normal': return { colSpan: 3, rowSpan: 1 };
    case 'medium': return { colSpan: 2, rowSpan: 1 };
    case 'compact': default: return { colSpan: 1, rowSpan: 1 };
  }
}
```

**Migration points (all must be updated):**
1. Layout loading in `load()` function (~line 404)
2. Template loading in `handleLoadTemplate()` (~line 527)
3. Built-in templates in `DEFAULT_BUILT_IN_TEMPLATES` (~line 172)
4. Default sizes in `DEFAULT_SIZES` (~line 107)
5. `WidgetCard` component's `spanClass` calculation (~line 238)

### Settings Keys That Store Layouts

All of these contain layout JSON and need migration handling:
- `dashboard_layout` (legacy global key)
- `dashboard_layout_all_accounts` (aggregate view)
- `dashboard_layout_{accountId}` (per-account, one per account)
- `dashboard_layout_templates` (array of user templates)
- `admin_default_templates` (admin-customized built-in templates)

### Backwards Compatibility Window

Keep the migration code (accepting old string-based sizes) for at least one version cycle. Users may have layouts saved across multiple accounts and templates that get loaded lazily. The existing "normal" to "large" migration at line 419 proves this pattern works and should be extended rather than replaced.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Resize handle implementation | Event conflict with @dnd-kit drag sensors | stopPropagation on resize handle + PointerSensor distance constraint |
| Chart widget resize | ResponsiveContainer re-render storm | Debounce ResizeObserver + placeholder during active resize |
| Layout persistence | Breaking existing saved layouts | Migration function for old schema, test with real saved data |
| CSS Grid layout | Gaps from mixed row/col spans | Explicit grid placement or grid-auto-flow: dense |
| Mobile responsive | Row spans creating oversized mobile cards | Reset row spans to 1 below md breakpoint |
| Template system | Old templates incompatible with new schema | Apply migration logic in template load path too |
| Drag reorder | rectSortingStrategy fails with variable sizes | Null sorting strategy + manual reorder logic |
| Performance | 24+ widgets re-rendering on resize | CSS contain property + debounce + lazy render |

---

## Sources

- [@dnd-kit Issue #720: Handling differently sized grid items](https://github.com/clauderic/dnd-kit/issues/720) -- maintainer-confirmed limitation
- [@dnd-kit Issue #77: Sortable grid with different item sizes](https://github.com/clauderic/dnd-kit/issues/77)
- [@dnd-kit Issue #804: useSortable with variable size items](https://github.com/clauderic/dnd-kit/issues/804)
- [@dnd-kit Issue #117: Variable sized sortables stretched when dragged](https://github.com/clauderic/dnd-kit/issues/117)
- [Recharts Issue #1767: ResponsiveContainer very slow when resizing](https://github.com/recharts/recharts/issues/1767) -- closed as not planned
- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- reference architecture for grid dashboards
- [Building Customizable Dashboard Widgets Using React Grid Layout (AntStack)](https://www.antstack.com/blog/building-customizable-dashboard-widgets-using-react-grid-layout/)
- [Drag and Drop with dynamically changing sizes (Michael Chen, Medium)](https://medium.com/@michaelchen101/draft-drag-and-drop-with-dynamically-changing-sizes-cedb3f479038)
