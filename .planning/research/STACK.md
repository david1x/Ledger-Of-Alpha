# Technology Stack: Dashboard Redesign (Grid-Based Resizable Cards)

**Project:** Ledger Of Alpha v3.1
**Researched:** 2026-03-22
**Scope:** Stack additions/changes needed for grid-based resizable card layout. Existing stack unchanged.

---

## Executive Finding

**No new dependencies needed. Extend existing @dnd-kit + CSS Grid with a custom resize hook.**

The project already has the right stack: @dnd-kit for drag-reorder, CSS Grid for layout, Tailwind for styling. The missing piece -- user-resizable cards with column/row span snapping -- is best implemented as a ~200-line custom hook rather than introducing react-grid-layout (which would replace the entire layout engine).

---

## Options Compared

### Option A: react-grid-layout v2.2.2

**What it is:** Purpose-built library for draggable + resizable grid layouts. v2 is a full TypeScript rewrite with hooks-based API. Provides drag-reorder and resize out of the box.

| Attribute | Detail |
|-----------|--------|
| Version | 2.2.2 (released Dec 2025) |
| Bundle size | ~16 kB min+gzip (core + react-draggable + react-resizable transitive deps) |
| TypeScript | First-class (v2 is full TS rewrite, no @types needed) |
| React 19 | Compatible -- beta key-prop issue (#2045) resolved in React 19 RC |
| Peer deps | `react >= 16.3.0` |
| Layout model | x, y, w, h per item on a configurable column grid |
| Resize | Built-in with configurable handle positions (se, sw, ne, nw, etc.) |
| Drag | Built-in with grid snapping and auto-compaction |
| npm downloads | ~1.2M/week |

**Strengths:**
- Solves drag AND resize in one library
- Battle-tested, actively maintained
- Layout compaction prevents gaps automatically
- Responsive breakpoints built in
- `onLayoutChange` callback for persistence

**Weaknesses:**
- **Uses absolute positioning, NOT CSS Grid.** Items are `position: absolute` with `transform` -- fundamentally different layout engine from the current `grid-cols-6` approach. Adopting it means rewriting all card rendering.
- **Replaces @dnd-kit for dashboard.** Running two drag systems on the same page creates event conflicts. Must remove @dnd-kit from DashboardShell entirely.
- **Brings its own dependency tree.** react-draggable + react-resizable are bundled as transitive deps (~16 kB total).
- **Migration cost is high.** Current layout persistence (order array + sizes record) must be converted to RGL's `{i, x, y, w, h}[]` format. All saved layouts and built-in templates need migration.
- **Over-engineered for the need.** The dashboard wants discrete grid-cell snapping (colSpan 1-6, rowSpan 1-4), not arbitrary pixel resizing with auto-compaction.

### Option B: Extend @dnd-kit with Custom Resize Handles (RECOMMENDED)

**What it is:** Keep existing @dnd-kit for drag-reorder. Add custom resize handles using pointer events that snap colSpan/rowSpan values within the existing CSS Grid.

| Attribute | Detail |
|-----------|--------|
| New dependencies | None (0 kB additional) |
| TypeScript | Already integrated |
| React 19 | Already working |
| Layout model | Extend existing `sizes` record: `Record<string, { w: number; h: number }>` |
| Resize | Custom: corner drag handle with pointer events, snap to grid cells |
| Drag | Existing @dnd-kit (unchanged) |
| Implementation | ~150-200 lines: `useGridResize` hook + `ResizeHandle` component |

**Strengths:**
- Zero new dependencies, zero bundle increase
- Preserves all existing drag-reorder code unchanged
- CSS Grid remains the layout engine (browser-native, performant)
- Full control over resize UX (snap behavior, allowed min/max sizes per widget)
- Layout persistence model extends naturally from current `sizes` record
- Discrete snapping (1-6 cols, 1-4 rows) is simpler to implement than arbitrary pixel resize

**Weaknesses:**
- Must implement resize logic from scratch (~150-200 lines)
- No automatic compaction (user arranges; gaps possible)
- Must handle edge cases: resize beyond grid bounds, mobile (disable resize)

### Option C: CSS Grid + react-resizable Standalone

**What it is:** Keep @dnd-kit for drag, add only `react-resizable` (~4 kB) for resize handle rendering, keep CSS Grid.

| Attribute | Detail |
|-----------|--------|
| New dependency | react-resizable ~4 kB min+gzip |
| Resize model | Pixel-based dimensions with handle rendering |

**Why not:** react-resizable works with pixel dimensions and absolute positioning. Using it with CSS Grid requires a translation layer (pixels to grid spans) that is more complex than just implementing grid-span resize directly. The hard part (snapping to grid cells) is still custom code. This option gains almost nothing over Option B while adding a dependency.

---

## Recommendation

**Option B: Extend @dnd-kit with Custom Resize Handles**

### Why

1. **The current system is 80% there.** The existing layout already has a 6-column CSS grid, @dnd-kit drag-reorder, and a `sizes` record per widget. The only gap: allow arbitrary colSpan/rowSpan instead of 3 fixed modes, via resize handles instead of button-cycling.

2. **react-grid-layout would be a rewrite, not an extension.** It uses absolute positioning with transforms, not CSS Grid. Adopting it means throwing away the current layout engine, re-implementing all widget rendering in RGL's model, removing @dnd-kit, and migrating all saved layouts. The migration risk outweighs the convenience.

3. **Custom resize is straightforward for discrete-snap grids.** The resize handle only needs to:
   - Track pointer delta from pointerdown
   - Calculate target grid cell from pointer position (`containerWidth / 6 = cellWidth`)
   - Update `colSpan`/`rowSpan` in state with clamping
   - Persist via existing settings API

   This is ~150-200 lines of a `useGridResize` hook + a `ResizeHandle` component.

4. **Zero bundle cost.** No new packages. The custom code compiles to <2 kB in the bundle.

5. **Layout persistence extends naturally.** Current `"large" | "medium" | "compact"` becomes `{ w: number, h: number }`. Backward-compatible migration at load time.

---

## Integration Notes

### Layout Model Change

```typescript
// Before (v3.0)
type WidgetSize = "large" | "medium" | "compact";
interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes: Record<string, WidgetSize>;
}

// After (v3.1)
interface WidgetSpan { w: number; h: number }  // colSpan 1-6, rowSpan 1-4
interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes: Record<string, WidgetSpan>;
}
```

### Backward-Compatible Migration

```typescript
function migrateSizes(sizes: Record<string, string | WidgetSpan>): Record<string, WidgetSpan> {
  const map: Record<string, WidgetSpan> = {
    large:   { w: 3, h: 1 },
    medium:  { w: 2, h: 1 },
    compact: { w: 1, h: 1 },
  };
  return Object.fromEntries(
    Object.entries(sizes).map(([id, v]) =>
      [id, typeof v === "string" ? (map[v] ?? { w: 1, h: 1 }) : v]
    )
  );
}
```

This migration runs at layout load time (in the `useEffect` that fetches `dashboard_layout` from settings). Old string-format layouts auto-convert. New saves write `{ w, h }` format.

### CSS Grid Rendering

Switch from Tailwind `col-span-*` classes to inline `style` for dynamic spans:

```tsx
// Before: static Tailwind classes
const spanClass = size === "compact" ? "col-span-1"
  : size === "medium" ? "col-span-1 md:col-span-2"
  : "col-span-1 md:col-span-3";

// After: dynamic inline styles
<div style={{
  gridColumn: `span ${Math.min(span.w, 6)}`,
  gridRow: `span ${span.h}`,
}}>
```

Tailwind classes cannot be dynamic (`col-span-${n}` does not work -- Tailwind strips unused classes at build time). Inline `style` with `gridColumn` / `gridRow` is the correct approach for runtime-determined spans.

### Resize Handle Component

A small draggable corner element (bottom-right of each card). Implementation pattern:

```tsx
function ResizeHandle({ onResize }: { onResize: (dw: number, dh: number) => void }) {
  return (
    <div
      onPointerDown={startResize}
      className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize
                 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {/* Diagonal lines or grip dots */}
    </div>
  );
}
```

Key implementation details:
- Use a **transparent overlay** during resize (same pattern as `PersistentChart.tsx` sidebar resize) to prevent chart iframes from stealing pointer events
- Call `e.stopPropagation()` on pointerdown to prevent triggering @dnd-kit drag
- The drag handle (GripVertical icon, top area) and resize handle (corner, bottom-right) are spatially separated -- no conflict
- Only visible in edit mode and on hover

### @dnd-kit Coexistence

No changes to @dnd-kit setup. The resize handle prevents event propagation to the drag system. Drag uses `GripVertical` in the card header; resize uses the bottom-right corner. These never overlap.

### Template Backward Compatibility

Saved layout templates and built-in presets store `sizes` in the old string format. The migration function runs at load time for all layouts. Built-in template constants in `DashboardShell.tsx` updated to use `{ w, h }` format directly.

### Row Height

Current cards have no explicit row height -- CSS Grid `auto` rows size to content. For row-span support, switch to explicit row heights:

```css
grid-template-rows: repeat(auto-fill, minmax(200px, auto));
/* or a fixed row height for predictable spanning */
grid-auto-rows: 200px;
```

The exact row height (180-220px) should be tuned to match current card content heights. Cards with `rowSpan > 1` get proportionally more height.

---

## Bundle Impact

| Change | Size Impact |
|--------|-------------|
| New npm dependencies | **0 kB** (none added) |
| `useGridResize` hook | ~200 lines source (~2 kB, negligible after minification) |
| `ResizeHandle` component | ~50 lines source |
| Layout model type changes | Net neutral |
| **Total additional bundle** | **~0 kB new package weight** |

For comparison:
- react-grid-layout v2.2.2 would add ~16 kB min+gzip
- react-resizable standalone would add ~4 kB min+gzip

---

## What NOT to Add

| Temptation | Why to Avoid |
|------------|-------------|
| `react-grid-layout` | Replaces working CSS Grid + @dnd-kit with absolute-positioned layout. High migration cost for a feature achievable in 200 lines. |
| `react-resizable` | Pixel-based, not grid-span-based. Still need custom snap logic. Adds dependency for minimal gain. |
| `gridstack.js` | jQuery-era library with React wrapper. Heavy (~50 kB), not React-native. |
| `react-mosaic` | Designed for IDE-style window tiling, not dashboard card grids. Different interaction model. |
| `@dnd-grid/react` | Low adoption (<100 weekly npm downloads). Not battle-tested. |

---

## Sources

- [react-grid-layout npm](https://www.npmjs.com/package/react-grid-layout) -- v2.2.2, 1.2M weekly downloads, TypeScript rewrite
- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- peerDeps: `react >= 16.3.0`
- [React 19 key prop issue #2045](https://github.com/react-grid-layout/react-grid-layout/issues/2045) -- resolved in React 19 RC (beta-only issue)
- [React 18 resize bug #2176](https://github.com/react-grid-layout/react-grid-layout/issues/2176) -- resize updates lost on limited CPU
- [@dnd-kit resize issue #1127](https://github.com/clauderic/dnd-kit/issues/1127) -- confirmed: resize not built-in, custom implementation recommended
- [@dnd-kit grid resize discussion #1605](https://github.com/clauderic/dnd-kit/discussions/1605) -- community examples of grid + resize
- [react-grid-layout bundlephobia](https://bundlephobia.com/package/react-grid-layout) -- bundle size reference
- Existing codebase: `DashboardShell.tsx` layout system, `PersistentChart.tsx` resize overlay pattern -- HIGH confidence (direct code inspection)
