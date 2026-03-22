# Architecture: Dashboard Redesign with Grid-Based Resizable Cards

**Domain:** Trade journaling analytics dashboard redesign
**Researched:** 2026-03-22
**Milestone:** v3.1 Dashboard Redesign
**Confidence:** HIGH (derived from full codebase analysis of DashboardShell.tsx, existing patterns)

---

## Executive Context

The v3.1 milestone redesigns the analytics dashboard to match the trades page design language. The current DashboardShell.tsx (~770 lines) already has a working drag-reorder system via @dnd-kit, a 6-column CSS grid, three column-span sizes (large=3, medium=2, compact=1), and layout persistence per account via the settings API. The work is primarily a UI restructure: merging the header and account summary into a navbar-style top bar, updating card styling, and potentially adding edge-drag resize handles. No new database tables or API routes are needed.

The critical architectural constraint: the existing `DashboardLayout` data model (`{ order, hidden, sizes }`) already encodes everything needed for column-span resize. Row span (height adjustment) is explicitly deferred per PROJECT.md. This means the "grid-based resize" feature is an interaction improvement on the existing size system, not a data model change.

---

## Integration Points

### 1. DashboardLayout Data Model -- NO SCHEMA CHANGE

**Current model** (DashboardShell.tsx, lines 152-156):

```typescript
type WidgetSize = "large" | "medium" | "compact";

interface DashboardLayout {
  order: string[];                    // widget ID ordering
  hidden: string[];                   // hidden widget IDs
  sizes: Record<string, WidgetSize>;  // per-widget column span
}
```

Column span mapping (WidgetCard, lines 238-242):
- `"large"` = `col-span-1 md:col-span-3` (half of 6-column grid)
- `"medium"` = `col-span-1 md:col-span-2` (one-third)
- `"compact"` = `col-span-1` (one-sixth)

**No changes needed.** The existing sizes field IS the resize data. Existing saved layouts, templates, and built-in presets all remain valid. No migration. No API changes.

**Row span consideration:** PROJECT.md explicitly lists "Dashboard widget height adjustment" as out of scope. Do NOT add a `rowSpans` field. Use `grid-auto-rows` with a minmax for uniform minimum card heights instead.

### 2. Settings Persistence -- NO CHANGES NEEDED

The layout save path is already correct:

```typescript
// Per-account layout key (line 214-216)
function getLayoutKey(accountId: string | null): string {
  return accountId ? `dashboard_layout_${accountId}` : 'dashboard_layout_all_accounts';
}

// Debounced save (lines 481-495)
const saveLayout = useCallback((newLayout: DashboardLayout, immediate = false) => {
  setLayout(newLayout);
  if (saveTimer.current) clearTimeout(saveTimer.current);
  const doSave = () => {
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [getLayoutKey(activeAccountId)]: JSON.stringify(newLayout) }),
    });
  };
  if (immediate) doSave();
  else saveTimer.current = setTimeout(doSave, 1000);
}, [me, activeAccountId]);
```

Resize interactions call the existing `saveLayout()` with updated sizes. No new persistence logic.

### 3. @dnd-kit Integration -- MINIMAL CHANGES

**Current DnD setup** (lines 28-35, 828-841):
- `DndContext` + `SortableContext` with `rectSortingStrategy`
- `useSortable` hook per `WidgetCard`
- `PointerSensor` with 5px activation distance
- `handleDragEnd` reorders the `layout.order` array via `arrayMove`

**Known limitation:** @dnd-kit's `rectSortingStrategy` handles variable column spans imperfectly -- items can visually overlap during drag when sizes differ. This is a [known issue](https://github.com/clauderic/dnd-kit/issues/720). The current codebase already ships with 3 different column spans and this exact setup, so the behavior is accepted and users are accustomed to it.

**No changes to DnD setup.** The drag-reorder operates on the `order` array regardless of visual sizes. If edge-drag resize handles are added, they must NOT use @dnd-kit -- use native mouse events on dedicated handle elements to avoid conflicts with reorder drag.

### 4. Template Compatibility -- AUTOMATIC

`LayoutTemplate` and `BuiltInTemplate` (lines 158-170) both store `DashboardLayout` directly. Since the interface is unchanged, all existing saved templates and built-in presets remain valid without migration. The `DEFAULT_BUILT_IN_TEMPLATES` array should be reviewed to ensure preset sizes still make visual sense with the new card styling.

### 5. Widget Component Contracts -- UNCHANGED

All widget components (ChartWidgets, StatWidget, ComparisonWidget, PerfTableWidget, HeatmapWidget, SymbolPnlWidget, WeeklyCalendar, etc.) receive data as props and render inside WidgetCard's `flex-1 min-h-0` container. They use `h-full w-full` or `min-h-[140px]` internally. No widget component needs logic changes -- only CSS class updates if card container styling changes.

---

## Data Model Changes

**None.** The existing `DashboardLayout` interface, settings keys, and API routes are sufficient.

| Aspect | Change | Rationale |
|--------|--------|-----------|
| `DashboardLayout` interface | None | `sizes` already stores column spans |
| Settings API | None | `saveLayout()` already handles per-account JSON |
| Database | None | No new tables or migrations |
| Templates | None | Store `DashboardLayout` which is unchanged |
| `DEFAULT_SIZES` | Review only | Some defaults may need adjustment for new card design |

---

## Component Changes

### 1. DashboardShell.tsx -- Header Restructure

**Remove:**
- Lines 1070-1074: `<h1>Dashboard</h1>` title block and subtitle
- Lines 1166-1217: Separate account summary strip card (the rounded card with Balance, P&L, Today, Trades, Win Rate)
- The `space-y-6` top-level wrapper class

**Add:**
- Navbar-style top bar combining account stats + controls in a single fixed-height row
- Viewport-locked layout (flex column with scrollable content area)

**Target structure:**

```tsx
<div className="flex flex-col h-[calc(100vh-64px)]">
  {/* Top bar -- fixed height, matches trades page filter bar */}
  <div className="px-6 flex items-center h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100">
    {/* Left: Account stats inline */}
    <div className="flex items-center gap-4 mr-auto">
      {/* Balance | P&L | Today | Trades | Win Rate -- inline with dividers */}
    </div>

    {/* Right: Controls */}
    <div className="flex items-center gap-2">
      {/* Time filter pills (30d/60d/90d/All) */}
      {/* Edit/Reset/Templates/Refresh/Export/Privacy buttons */}
      {/* New Trade button */}
    </div>
  </div>

  {/* Scrollable content area */}
  <div className="flex-1 overflow-y-auto p-6 space-y-4">
    {/* Daily loss warning */}
    {/* Weekly calendar */}
    {/* Widget grid (DndContext + SortableContext) */}
    {/* Hidden widgets panel (edit mode) */}
    {/* Open trades section */}
  </div>
</div>
```

**Why `h-[calc(100vh-64px)]`:** The 64px accounts for the Navbar sidebar logo area height alignment. This is the same pattern used by the trades page.

### 2. WidgetCard -- Styling Update + Optional Resize Handle

**Current card style** (line 246):
```
rounded-2xl dark:bg-slate-800/50 bg-white p-3 flex flex-col shadow-sm
```

**Target card style** (matching trades page design language):
```
rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-900/50 bg-white p-3 flex flex-col
```

Changes:
- `rounded-2xl` to `rounded-md` (sharper corners)
- Add explicit `border dark:border-slate-800 border-slate-200`
- Remove `shadow-sm` (borders replace shadows)
- Background: `dark:bg-slate-800/50` to `dark:bg-slate-900/50` (slightly darker, matching trades page cards)

**Resize interaction -- two approaches:**

**Option A (Recommended): Keep cycle button.** The current edit-mode size toggle button (L -> M -> C -> L) already provides column-span resize. This is the simplest approach and already works. The "grid-based resize" from the project spec is satisfied because the grid snaps to column widths.

**Option B (If drag-to-resize required): Add edge handle.**
- Small handle element at right edge of card (only in edit mode)
- Native mousedown/mousemove/mouseup (NOT @dnd-kit -- avoids conflict)
- Track horizontal movement, snap to nearest column boundary (1/2/3 cols)
- Call existing `saveLayout()` with updated sizes on mouseup
- Risk: Medium. Mouse events near DnD handles can conflict. Mitigated by separate DOM elements and the 5px activation distance on PointerSensor.

### 3. Grid Container -- Add grid-auto-rows

**Current grid** (line 1251):
```
grid grid-cols-1 md:grid-cols-6 gap-3
```

**Updated grid:**
```
grid grid-cols-1 md:grid-cols-6 gap-3 auto-rows-[minmax(200px,auto)]
```

The `auto-rows-[minmax(200px,auto)]` Tailwind class ensures all grid rows have a minimum 200px height while allowing content to expand. This provides visual consistency across cards of different content heights without explicit row spans.

### 4. Elements to Remove

**"Recent Trades" / "Open Trades" table** (lines 1285-1303): Per project spec ("Remove recent trades table"), this section should be removed. Open/planned trades are accessible from the trades page.

**Page title** (line 1072): `<h1>Dashboard</h1>` and subtitle removed. The account stats in the top bar serve as the page identifier.

### 5. Hidden Widgets Panel -- Style Update

**Current** (lines 1269-1283):
```
rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-3 shadow-sm
```

**Updated** (matching new card style):
```
rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-900/30 bg-slate-50 p-3
```

### 6. Daily Loss Warning Banner -- Style Update

The existing banner (lines 1221-1236) uses `rounded-2xl`. Update to `rounded-md` to match new design language. Keep the red color scheme.

---

## Build Order

Build in this order to minimize risk and allow incremental verification at each step.

### Phase 1: Top Bar Extraction (Highest Impact, Lowest Risk)

**What:** Replace the title header + account summary strip with a single navbar-style top bar. Make the content area below scrollable.

**Changes:**
1. Remove `<h1>Dashboard</h1>` and subtitle
2. Remove the separate account summary strip card
3. Add a `h-16 border-b dark:bg-slate-900 bg-slate-100` top bar
4. Move account stats (Balance, P&L, Today, Trades, Win Rate) into the top bar left side, inline
5. Move time filter pills into the top bar center-right
6. Move utility buttons (edit, reset, templates, refresh, export, privacy) + New Trade button into the top bar right side
7. Wrap remaining content in a scrollable container (`flex-1 overflow-y-auto`)
8. Change root wrapper to `flex flex-col h-[calc(100vh-64px)]`

**Risk:** Low. Pure UI restructure. No data model or logic changes. All state variables remain in DashboardShell.

**Verification:** Page loads, stats display correctly, time filter works, edit mode works, layout saves persist.

### Phase 2: Card Design Update (Visual Alignment)

**What:** Update WidgetCard and related panel styling to match trades page design language.

**Changes:**
1. WidgetCard: `rounded-2xl` to `rounded-md`, add border, remove shadow, adjust bg
2. Hidden widgets panel: same style updates
3. Daily loss warning: `rounded-2xl` to `rounded-md`
4. Weekly calendar card: align styling if it uses `rounded-2xl`
5. Empty state card: align styling
6. Grid container: add `auto-rows-[minmax(200px,auto)]` for uniform row heights

**Risk:** Low. CSS-only changes. No interaction or data changes.

**Verification:** Visual inspection. Cards match trades page style. No content overflow issues.

### Phase 3: Remove Open Trades Section + Cleanup

**What:** Remove the "Open Trades" table from the dashboard, clean up any remaining style inconsistencies.

**Changes:**
1. Remove lines 1285-1303 (open trades section)
2. Remove `TradeTable` import if no longer used in DashboardShell
3. Remove related state (`openTrades` memo, `handleEdit`, `handleDelete` if only used for open trades table)
4. Review `DEFAULT_SIZES` -- adjust defaults if any widgets look wrong at current sizes with new card design
5. Review built-in templates (`DEFAULT_BUILT_IN_TEMPLATES`) for sensible defaults

**Risk:** Low. Removal of self-contained section. May need to keep `handleEdit`/`handleDelete` and `TradeModal` if they serve the widget click-through interactions.

**Verification:** Dashboard loads without open trades section. No broken references. Modal still works for "New Trade" button.

### Phase 4: Resize Enhancement (Optional, Medium Risk)

**Only build if the cycle button is insufficient for the "grid-based resize" requirement.**

**What:** Add edge-drag resize handles to cards in edit mode.

**Changes:**
1. Add a resize handle div to WidgetCard right edge (edit mode only)
2. Implement mousedown/mousemove/mouseup resize logic
3. Calculate target column count based on mouse X position relative to grid
4. Snap to 1/2/3 columns, call `saveLayout()` with updated size
5. Add `pointer-events-none` overlay during resize to prevent iframe widgets from stealing events

**Risk:** Medium. Mouse event handling alongside @dnd-kit drag. Mitigations:
- Resize handle is a separate DOM element from the drag handle (bottom-right corner vs top-right grip icon)
- PointerSensor has 5px activation distance, so micro-movements don't trigger DnD
- Add `e.stopPropagation()` on the resize handle to prevent DnD pickup

**Verification:** Resize works in edit mode. DnD reorder still works. Layout persists after resize. No conflict between resize and drag.

---

## Patterns to Follow

### Pattern 1: Viewport-Locked Layout (from Trades Page)

The trades page uses `h-16` fixed top bar + scrollable content. Apply the same:

```tsx
<div className="flex flex-col h-[calc(100vh-64px)]">
  <div className="h-16 shrink-0 border-b dark:border-slate-800 dark:bg-slate-900 bg-slate-100">
    {/* fixed top bar */}
  </div>
  <div className="flex-1 overflow-y-auto p-6">
    {/* scrollable content */}
  </div>
</div>
```

### Pattern 2: Debounced Layout Save (Already Implemented)

Keep the existing 1-second debounce for resize changes. Immediate save on edit mode exit (`finishEdit` calls `saveLayout(layout, true)`). This prevents API spam during rapid size cycling or drag-to-resize.

### Pattern 3: CSS Grid Auto Rows

```
grid grid-cols-1 md:grid-cols-6 gap-3 auto-rows-[minmax(200px,auto)]
```

Provides uniform minimum card heights without row spans. The `auto` upper bound lets widgets with more content (tables, charts) grow naturally. Stat widgets and comparison widgets render comfortably at 200px minimum.

### Pattern 4: Top Bar Stat Layout

Use the same inline stat pattern as the current account summary strip, but compressed:

```tsx
<div className="flex items-center gap-3 text-sm">
  <span className="text-xs font-medium dark:text-slate-400 uppercase">Balance</span>
  <span className="font-bold text-emerald-400">$12,345.67</span>
  <div className="w-px h-4 dark:bg-slate-700" />
  {/* ... more stats with dividers */}
</div>
```

On smaller screens (`< sm`), hide less critical stats (Today, Trades) using `hidden sm:flex`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Replacing @dnd-kit with react-grid-layout

**Why tempting:** react-grid-layout has built-in drag-to-resize with grid snapping.
**Why bad:** Introduces a new dependency (~40KB), requires rewriting all drag-reorder logic, breaks existing layout templates (different data format), and the current @dnd-kit setup already handles variable column spans. The migration cost is not justified when the existing system works.
**Instead:** Keep @dnd-kit. If drag-to-resize is needed, implement it with native mouse events alongside the existing DnD.

### Anti-Pattern 2: Adding Row Spans in v3.1

**Why tempting:** "Full grid control" sounds better.
**Why bad:** PROJECT.md explicitly defers "Dashboard widget height adjustment" to a later milestone. Adding row spans changes how every widget renders (some widgets hardcode min-heights). It also changes the layout data model, breaking existing saved layouts and templates.
**Instead:** Use `grid-auto-rows` with a minmax for visual consistency. Defer row spans to the dedicated future milestone.

### Anti-Pattern 3: Extracting DashboardTopBar to a Separate File

**Why tempting:** Smaller files.
**Why bad:** The top bar needs access to 15+ state variables (currentBalance, totalPnl, todayPnl, closed.length, winRate, timeFilter, editMode, hidden, loading, templates, plus all callbacks). Extracting it means either prop-drilling all of these or creating a context. Both add complexity for ~50 lines of JSX.
**Instead:** Keep inline in DashboardShell.tsx. The file will stay under ~750 lines after removing the open trades section and header.

### Anti-Pattern 4: Freeform Pixel-Based Resize

**Why tempting:** More flexible dragging.
**Why bad:** Breaks the 6-column grid system. Creates unpredictable layouts. Layout persistence becomes pixel coordinates instead of semantic sizes. Responsive behavior breaks. Column-fill behavior of CSS grid no longer works.
**Instead:** Snap to 1/2/3 column units. Keep the semantic size names (compact/medium/large).

### Anti-Pattern 5: Moving DndContext Outside the Scrollable Area

**Why tempting:** Might seem cleaner to wrap the entire page.
**Why bad:** DndContext should wrap only the sortable items. Wrapping the top bar too means the top bar elements participate in collision detection, which wastes CPU and can cause visual glitches.
**Instead:** Keep DndContext exactly where it is -- wrapping only the widget grid.

---

## Sources

- Codebase: `DashboardShell.tsx` (lines 1-1320, full read)
- Codebase: `TradesShell.tsx` line 245 (trades page filter bar pattern)
- Codebase: `PROJECT.md` (v3.1 milestone spec, out-of-scope items)
- [dnd-kit issue #720: Handling differently sized grid items](https://github.com/clauderic/dnd-kit/issues/720) -- confirms known limitation with variable-sized sortables
- [dnd-kit issue #77: Sortable grid with different item sizes](https://github.com/clauderic/dnd-kit/issues/77) -- community workarounds
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) -- evaluated and rejected (unnecessary dependency swap)
- [@dnd-grid/react](https://www.npmjs.com/package/@dnd-grid/react) -- evaluated and rejected (same reason)
- Confidence: HIGH -- all integration patterns derived directly from existing codebase with working precedents
