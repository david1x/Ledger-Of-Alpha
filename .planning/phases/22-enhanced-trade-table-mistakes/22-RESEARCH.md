# Phase 22: Enhanced Trade Table & Mistakes - Research

**Researched:** 2026-03-21
**Domain:** React table enhancement, @dnd-kit column drag, mistake tagging UI, computed columns, table footer
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TABL-01 | Color-coded Win/Loss/Open status badges on each row | STATUS_STYLE map already exists in TradeTable.tsx; needs Win/Loss distinction for closed trades (pnl-based) and redesign as colored pill |
| TABL-02 | Color-coded Long/Short side badges on each row | Direction rendering already exists; needs promotion to badge format matching TABL-01 style |
| TABL-03 | Net return $ and net return % columns | `calcPercentReturn` in lib/trade-utils.ts computes % return; net $ is `pnl` (already a column); a new combined or separate column is needed alongside cost_basis |
| TABL-04 | Cost basis column (entry price x size) | Pure client-side computation: `entry_price * shares`; no API changes needed |
| TABL-05 | Drag-to-reorder table columns with persisted order | @dnd-kit/sortable already used in DashboardShell; column order persisted via `/api/settings` key `trade_table_columns` (already saves visible columns); extend to also save order |
| TABL-06 | Table footer with filtered count, total count, and total return | TradesShell has all data; footer lives inside TradeTable as a `<tfoot>` row |
| MIST-02 | Tag trades with mistake types in TradeModal | API ready (`POST /api/trades/[id]/mistakes`); TradeModal needs a MistakeSelector UI section; save is POST/DELETE to junction table after trade save |
| MIST-03 | Mistake tags as pills in trade table row | `trade.mistake_tag_ids` already returned by GET /api/trades; TradeTable needs to receive `mistakeTypes` prop and render colored pills |
</phase_requirements>

---

## Summary

Phase 22 is a pure frontend phase. All the backend infrastructure — the `trade_mistake_tags` junction table, the `/api/mistakes` CRUD routes, the `/api/trades/[id]/mistakes` tagging routes, and the `mistake_tag_ids` field on the `Trade` type — was built in Phase 18 and is confirmed fully operational in the codebase. The `applyFilter` function in TradesShell already handles `filter.mistakeId` using `trade.mistake_tag_ids`. No database or API changes are required.

The work falls into two components. First, `TradeTable.tsx` (~690 lines) needs six enhancements: TABL-01 badge redesign (Win/Loss split for closed trades), TABL-02 side badges, three new data columns (net return $, net return %, cost basis), a drag-to-reorder header system using @dnd-kit, and a `<tfoot>` footer. Second, `TradeModal.tsx` needs a new Mistakes section in the Psychology & Reflection tab that fetches mistake types and POSTs/DELETEs to the junction table API.

The project already uses @dnd-kit 6.x/10.x (`DndContext`, `SortableContext`, `useSortable`, `arrayMove`) in DashboardShell.tsx with the exact pattern needed for column drag. Column order must be stored alongside visible columns — the existing `trade_table_columns` settings key already saves the `ColumnKey[]` array in order, so extending it to also encode column order is trivial.

**Primary recommendation:** Enhance TradeTable and TradeModal in two plans. Plan 01: TradeTable visual and structural changes (TABL-01 through TABL-06). Plan 02: Mistake tagging in TradeModal and pills in TradeTable (MIST-02, MIST-03). Both plans can be delivered independently but MIST-03 requires TradeTable to already accept a `mistakeTypes` prop that can be scaffolded in Plan 01.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 (installed) | DragEndEvent, DndContext, sensors | Already in package.json; used in DashboardShell |
| @dnd-kit/sortable | ^10.0.0 (installed) | useSortable, SortableContext, arrayMove, horizontalListSortingStrategy | Already in package.json; used in DashboardShell and StrategiesTab |
| @dnd-kit/utilities | ^3.2.2 (installed) | CSS.Transform.toString | Already in package.json; used in DashboardShell |
| clsx | existing | Conditional class joining | Already used extensively in TradeTable and TradeModal |
| lucide-react | existing | GripVertical drag handle icon | Already used in DashboardShell for drag handles |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/trade-utils` — `calcPercentReturn`, `calcRRAchieved` | existing | Compute % return and R:R for table cells | Already imported in TradeTable.tsx line 7 |
| `@/lib/privacy-context` — `usePrivacy` | existing | Mask financial values in privacy mode | SummaryStatsBar uses `const { hidden } = usePrivacy()` — follow same pattern in TradeTable for new monetary columns |
| `@/lib/types` — `MistakeType`, `Trade.mistake_tag_ids` | existing | Type definitions for mistake system | `MistakeType` interface at lib/types.ts:157; `mistake_tag_ids` field at Trade interface:86 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/sortable for column headers | HTML5 draggable attribute | @dnd-kit handles pointer/keyboard/touch events, provides accessible drag; HTML5 drag has poor mobile support and no animation |
| horizontalListSortingStrategy | rectSortingStrategy | horizontalListSortingStrategy is semantically correct for a horizontal header row; rectSortingStrategy is for 2D grids |
| `<tfoot>` element | Div below the table | `<tfoot>` is semantically correct, inherits column widths automatically |

**Installation:** No new packages needed — all @dnd-kit packages already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
components/
  TradeTable.tsx      MODIFY — badges, new columns, drag headers, tfoot, mistakeTypes prop
  TradeModal.tsx      MODIFY — add Mistakes section to reflection tab
  trades/
    TradesShell.tsx   MODIFY — pass mistakeTypes to TradeTable; fetch mistake types
```

### Pattern 1: @dnd-kit Column Drag (from DashboardShell)

**What:** Wrap `<thead>` with `DndContext` + `SortableContext`, make each `<th>` a sortable node with `useSortable`, apply CSS transform, handle `DragEndEvent` with `arrayMove`.

**When to use:** TABL-05 drag-to-reorder column headers.

**Key insight:** The existing `visibleColumns: ColumnKey[]` array in TradesShell already encodes both visibility AND order when saved to `/api/settings` as `trade_table_columns`. The planner only needs to ensure that when order is changed via drag, the new ordered array replaces the old one via `saveColumns()`. This is already wired — `saveColumns` persists to settings.

**Example (verified from DashboardShell.tsx lines 28-35, 230-236, 267-270, 833-838):**
```typescript
// Source: components/dashboard/DashboardShell.tsx
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// In <thead> component:
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor)
);

const handleColumnDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = visibleColumns.indexOf(active.id as ColumnKey);
    const newIndex = visibleColumns.indexOf(over.id as ColumnKey);
    const newOrder = arrayMove(visibleColumns, oldIndex, newIndex);
    saveColumns(newOrder);  // persists via /api/settings
  }
};

// useSortable in each sortable <th>:
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};
```

**DndContext wraps only the `<thead>` row — not the whole table — to limit drag scope to headers.**

### Pattern 2: Win/Loss/Open Badge (TABL-01)

**What:** The existing `STATUS_STYLE` map in TradeTable uses three states: `planned`, `open`, `closed`. For TABL-01, closed trades need to show Win or Loss based on `pnl`. The current "closed" badge becomes context-dependent.

**When to use:** Every table row badge render.

**Example:**
```typescript
// Derived badge from existing STATUS_STYLE pattern
function getStatusBadge(t: Trade): { label: string; className: string } {
  if (t.status === "open") return { label: "Open", className: "bg-yellow-500/20 text-yellow-400" };
  if (t.status === "planned") return { label: "Planned", className: "bg-blue-500/20 text-blue-400" };
  // closed — determine Win vs Loss
  if ((t.pnl ?? 0) > 0) return { label: "Win", className: "bg-emerald-500/20 text-emerald-400" };
  if ((t.pnl ?? 0) < 0) return { label: "Loss", className: "bg-red-500/20 text-red-400" };
  return { label: "BE", className: "bg-slate-500/20 dark:text-slate-400 text-slate-500" };
}
```

### Pattern 3: Mistake Pills in Table Row (MIST-03)

**What:** `trade.mistake_tag_ids` is a comma-separated string of UUIDs (returned by the GROUP_CONCAT in GET /api/trades). To render colored pills, the table needs access to `MistakeType[]` so it can look up `name` and `color` by ID.

**When to use:** Each table row that has `mistake_tag_ids`.

**Example:**
```typescript
// TradeTable receives: mistakeTypes?: MistakeType[]
// In each row:
{mistakeTypes && t.mistake_tag_ids && (
  <div className="flex flex-wrap gap-1 mt-1">
    {t.mistake_tag_ids.split(",").map(id => {
      const mt = mistakeTypes.find(m => m.id === id);
      if (!mt) return null;
      return (
        <span
          key={id}
          className="px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{ backgroundColor: mt.color + "33", color: mt.color }}
        >
          {mt.name}
        </span>
      );
    })}
  </div>
)}
```

**Data flow:** TradesShell fetches mistake types and passes them to TradeTable as a prop. TradesShell already fetches mistake types in TradeFilterBar (via a separate useEffect), but for Phase 22 TradesShell itself should fetch them once and pass down to both TradeTable and TradeFilterBar.

### Pattern 4: Mistake Tagging in TradeModal (MIST-02)

**What:** After a trade is saved (onSaved path), the modal needs to sync the mistake tags: compare the selected mistake IDs to the existing ones and POST/DELETE the diff. The trade ID is only known after save for new trades.

**When to use:** TradeModal save flow.

**Key consideration:** Trade ID is available in `trade?.id` for edits, and from the POST response for new trades. The save function currently calls `onSaved(); onClose();` — the mistake tag sync must happen before `onClose()` to avoid the modal unmounting mid-fetch. However, since the mistake tag API calls are fire-and-forget (they don't affect the displayed trade data until reload), they can happen concurrently with `onSaved()`.

**Example flow:**
```typescript
// In TradeModal.tsx save():
const res = await fetch(url, { method, ... });
if (res.ok) {
  const savedTrade = await res.json();
  const tradeId = savedTrade.id;
  // Sync mistake tags — diff selected vs original
  const originalIds = new Set((trade?.mistake_tag_ids ?? "").split(",").filter(Boolean));
  const selectedIds = new Set(selectedMistakeIds); // new state in TradeModal
  // POST new tags
  for (const id of selectedIds) {
    if (!originalIds.has(id)) {
      await fetch(`/api/trades/${tradeId}/mistakes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistake_id: id }),
      });
    }
  }
  // DELETE removed tags
  for (const id of originalIds) {
    if (!selectedIds.has(id)) {
      await fetch(`/api/trades/${tradeId}/mistakes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistake_id: id }),
      });
    }
  }
  onSaved();
  onClose();
}
```

**UI placement:** A new "Mistakes" section in the `reflection` tab of TradeModal, after the Tags section. Render checkboxes for each mistake type with its color dot — same toggle pill pattern used by the EmotionsInput component.

**Fetching mistake types in TradeModal:** Add a `useEffect` to fetch `/api/mistakes` alongside the existing settings fetch. Store in `const [mistakeTypes, setMistakeTypes] = useState<MistakeType[]>([])`.

**Initializing selected mistake IDs from trade prop:** `useState<Set<string>>(() => new Set((trade?.mistake_tag_ids ?? "").split(",").filter(Boolean)))` — initialize from the trade's existing tags.

### Pattern 5: Cost Basis Column (TABL-04)

**What:** Cost basis = `entry_price * shares`. Show `—` when either is null.

**When to use:** New column in TradeTable (disabled by default, user must toggle it on — follow existing `default: false` pattern).

**Example:**
```typescript
// Add to ALL_COLUMNS in TradeTable.tsx:
{ key: "cost_basis", label: "Cost Basis", default: false }

// In row render:
{show("cost_basis") && (
  <td className="px-4 py-3 dark:text-slate-300 text-slate-700 font-medium text-xs">
    {t.entry_price != null && t.shares != null
      ? `$${(t.entry_price * t.shares).toFixed(2)}`
      : "—"}
  </td>
)}
```

**Note:** Cost basis does not need to be added to `getSortValue` unless sorting is desired; if added, it follows the same numeric pattern as other computed columns.

### Pattern 6: Net Return Columns (TABL-03)

**What:** Net return $ is `t.pnl` (already exists as "P&L" column — do not duplicate, just ensure it's clearly named). Net return % is `calcPercentReturn(t, accountSize)` from `lib/trade-utils.ts` (already exists as "% Return" column). The requirement is these two exist as visible columns alongside cost basis. Both already exist in `ALL_COLUMNS` — they just need to be enabled by default.

**Recommendation for TABL-03:** Change `pct_return` `default` from `false` to `true`. The `pnl` column is already default. Cost basis is a new column with `default: false`. This satisfies "net return $ and net return % columns alongside cost basis."

### Pattern 7: Table Footer (TABL-06)

**What:** A `<tfoot>` row showing: filtered count / total count, and sum of `pnl` for visible filtered trades.

**When to use:** Always visible at the bottom of the table when there are rows.

**Data needed:** TradeTable already receives `trades` prop (which is `filteredTrades`). To show total count, TradeTable needs a `totalCount` prop from TradesShell.

**Example:**
```typescript
// Props addition:
interface Props {
  // ... existing props
  totalCount?: number;  // allTrades.length, passed from TradesShell
}

// In <tfoot>:
<tfoot>
  <tr className="border-t dark:border-slate-700/50 border-slate-100">
    <td colSpan={headers.length + 2} className="px-4 py-3 text-xs dark:text-slate-500 text-slate-400">
      <div className="flex items-center justify-between">
        <span>
          {rows.length} trade{rows.length !== 1 ? "s" : ""}
          {totalCount !== undefined && totalCount !== rows.length
            ? ` (filtered from ${totalCount})`
            : ""}
        </span>
        <span className={clsx("font-semibold", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
          Total: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
        </span>
      </div>
    </td>
  </tr>
</tfoot>
```

### Anti-Patterns to Avoid

- **Fetching mistake types inside TradeTable:** TradeTable is a pure display component — it should receive `mistakeTypes` as a prop from TradesShell, not fetch them internally. Keeps concerns separated and avoids duplicate API calls.
- **Blocking `onSaved()` on mistake tag sync:** Tag sync should be best-effort; if it fails, the trade save already succeeded. A failed tag call should `console.error` but not surface an error to the user (the trade reload will show accurate state).
- **Storing column order separately from column visibility:** The existing `trade_table_columns` setting already stores `ColumnKey[]` which encodes both. Do not add a second settings key. The `saveColumns` function in TradesShell handles both.
- **Wrapping the full table in DndContext:** Only wrap the `<thead>` row in DndContext to avoid the drag sensor intercepting row clicks.
- **Adding `horizontalListSortingStrategy` to the full table body:** DndContext with sortable only applies to the header row items (`visibleColumns`).
- **Putting drag listeners on sort buttons:** The `<th>` already has a sort-click handler. Use a separate `<span>` with a GripVertical icon that carries the `{...listeners}` from `useSortable`, not the entire `<th>`. This preserves sort-on-click behavior.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column drag-to-reorder | Custom mousedown/mousemove tracking | @dnd-kit/sortable useSortable + DndContext | Already installed; handles pointer, keyboard, touch, and accessibility; used identically in DashboardShell |
| Mistake tag diff sync | Full replace (delete all, insert all) | POST/DELETE diff on save | DELETE ALL then re-insert creates race condition; diff is correct approach |
| Color computation for mistake pills | Manual hex darkening | Inline `style={{ backgroundColor: color + "33", color }}` | Simple alpha append creates a tinted background; no external library needed |

**Key insight:** @dnd-kit is already wired in this codebase with a fully working pattern in DashboardShell.tsx. The column drag implementation is a direct adaptation of lines 28-35, 230-236, and 833-838 of that file.

---

## Common Pitfalls

### Pitfall 1: DndContext Around Full Table Intercepts Row Clicks
**What goes wrong:** If `DndContext` wraps the entire `<table>` or `<tbody>`, the PointerSensor may intercept click events on row cells (edit, delete, sort).
**Why it happens:** PointerSensor uses `pointerdown` event — the default activation constraint is `activationConstraint: { distance: 8 }` which prevents false activations on clicks, but still captures the initial pointer event.
**How to avoid:** Wrap only the `<thead>` row's children inside `SortableContext`. Keep `DndContext` scoped to the header rendering. The existing DashboardShell pattern wraps only the widget grid, not the entire page.
**Warning signs:** Clicking a table cell opens the drag state instead of triggering the intended action.

### Pitfall 2: Drag Handle vs Sort Click Conflict
**What goes wrong:** Each `<th>` contains both a sort-click button AND needs to be a drag handle. Spreading `{...listeners}` on the `<th>` will intercept sort clicks.
**Why it happens:** `listeners` contains `onPointerDown` which fires before `onClick`.
**How to avoid:** Put `{...attributes} {...listeners}` only on a separate child `<span>` containing the GripVertical icon (visible on hover). The sort `<button>` remains a sibling without drag listeners. This is the same pattern used for the drag handle in DashboardShell's `SortableWidget` (line 267-270).
**Warning signs:** Clicking the column header label triggers a drag instead of sorting.

### Pitfall 3: `mistake_tag_ids` May Be null for Trades With No Tags
**What goes wrong:** `GROUP_CONCAT` in SQLite returns `NULL` (not `""`) when there are no matching rows. Calling `.split(",")` on `null` throws a TypeError.
**Why it happens:** The GET /api/trades query uses `GROUP_CONCAT(tmt.mistake_id)` which returns NULL for trades with no tags.
**How to avoid:** Always guard with `t.mistake_tag_ids?.split(",").filter(Boolean)`. The `?` handles null, and `.filter(Boolean)` removes empty strings from the split of a null coercion.
**Warning signs:** TypeErrors in the table when a trade has no mistake tags.

### Pitfall 4: TradeModal Initializes Selected Mistake IDs Once, But `trade` Prop Can Change
**What goes wrong:** `useState` initializer only runs once. If `TradeModal` is reused for different trades without unmounting (e.g., opening edit for trade A, then trade B), `selectedMistakeIds` keeps trade A's values.
**Why it happens:** React state initializer is ignored after initial mount.
**How to avoid:** Add a `useEffect(() => { setSelectedMistakeIds(new Set(...)); }, [trade])` to re-initialize when `trade` changes — same pattern used for `setForm(trade ?? EMPTY)` at TradeModal.tsx line 125.
**Warning signs:** Wrong mistake tags pre-selected when editing a different trade.

### Pitfall 5: `colSpan` in `<tfoot>` Must Account for Checkbox Column
**What goes wrong:** If `selectable` mode is active, an extra checkbox `<td>` is prepended to each row. The `<tfoot>` `colSpan` must include it.
**Why it happens:** The selectable column is conditional.
**How to avoid:** Compute `colSpan = headers.length + 1 (Actions) + (selectable ? 1 : 0)`.
**Warning signs:** Footer row is misaligned or truncated.

### Pitfall 6: `horizontalListSortingStrategy` vs `rectSortingStrategy` for Headers
**What goes wrong:** `rectSortingStrategy` is designed for 2D grids and may produce incorrect insertion indices for a single horizontal row of headers.
**Why it happens:** rectSortingStrategy computes position in 2D space; columns only have horizontal position.
**How to avoid:** Use `horizontalListSortingStrategy` from @dnd-kit/sortable for column headers. DashboardShell uses `rectSortingStrategy` because it has a multi-column 2D grid; the trade table header is a single horizontal row.
**Warning signs:** Dragging a column to the right results in incorrect placement.

---

## Code Examples

Verified patterns from codebase source:

### useSortable Integration (from DashboardShell.tsx lines 228-236, 267-270)
```typescript
// Source: components/dashboard/DashboardShell.tsx
const {
  attributes, listeners, setNodeRef, transform, transition, isDragging,
} = useSortable({ id });   // id must match an item in SortableContext items array

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};
// ...
// Drag handle (separate from clickable sort button):
<span {...attributes} {...listeners}
  className="p-1 rounded cursor-grab active:cursor-grabbing hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
>
  <GripVertical className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400" />
</span>
```

### arrayMove on DragEnd (from DashboardShell.tsx lines 833-838)
```typescript
// Source: components/dashboard/DashboardShell.tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = visibleColumns.indexOf(active.id as ColumnKey);
    const newIndex = visibleColumns.indexOf(over.id as ColumnKey);
    saveColumns(arrayMove(visibleColumns, oldIndex, newIndex));
  }
};
```

### Column Order Persistence (from TradesShell.tsx lines 160-169)
```typescript
// Source: components/trades/TradesShell.tsx — saveColumns already handles persistence
const saveColumns = async (cols: ColumnKey[]) => {
  setVisibleColumns(cols);
  if (me && !me.guest) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_table_columns: JSON.stringify(cols) }),
    });
  }
};
```

### Privacy Masking Pattern (from SummaryStatsBar.tsx)
```typescript
// Source: components/trades/SummaryStatsBar.tsx
import { usePrivacy } from "@/lib/privacy-context";
const { hidden } = usePrivacy();
// Usage:
{hidden ? "••••" : `$${value.toFixed(2)}`}
```

### mistake_tag_ids Safe Split
```typescript
// Safe null-guard for GROUP_CONCAT result
const mistakeIds = t.mistake_tag_ids?.split(",").filter(Boolean) ?? [];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `trades.mistakes` TEXT freeform notes | `trade_mistake_tags` junction table | Phase 18 | FK cascade, filterable, colorable — this phase consumes it |
| Closed trades show generic "closed" badge | Win / Loss / BE / Open badges | Phase 22 | Faster at-a-glance scanning of trade outcomes |
| Column order fixed (ALL_COLUMNS declaration order) | User-draggable column order persisted to settings | Phase 22 | Power user workflow |

**Not applicable to this phase:**
- No new migrations or API routes needed

---

## Open Questions

1. **Where to place the Mistakes section in TradeModal — which tab?**
   - What we know: TradeModal has three tabs: Setup & Strategy, Market Execution, Psychology & Reflection. The Reflection tab already has Tags and Emotions.
   - What's unclear: Whether Mistakes belong in Reflection or warrant their own section. The requirements say "in TradeModal" without tab specification.
   - Recommendation: Place in the Reflection tab after the Tags/Emotions section. Mistakes are reflective metadata, not execution data. This groups it naturally with Tags and Psychology content.

2. **Should new columns (cost_basis, net return %) be on by default?**
   - What we know: TABL-03 says "user can see" which implies they should be visible. TABL-04 same. But `ALL_COLUMNS` uses `default: false` for non-essential columns to avoid clutter.
   - Recommendation: Set `cost_basis` to `default: false` (dense data, not always relevant). The `pnl` column (net return $) is already `default: true`. Set `pct_return` to `default: true` to satisfy TABL-03 requiring both visible alongside cost_basis. Users can toggle cost_basis on from the Columns menu.

3. **Mistake tag sync: fire-and-forget or await?**
   - What we know: Tag sync is a secondary operation after trade save succeeds. Failures should not block the save confirmation.
   - Recommendation: Use Promise.all for parallel tag sync, then call onSaved()/onClose(). If tag sync fails, log the error but proceed — the next page load will re-fetch accurate state from the database.

---

## Validation Architecture

> `nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is skipped per configuration.

---

## File Change Map

| File | Change | Notes |
|------|--------|-------|
| `components/TradeTable.tsx` | MODIFY | Add: TABL-01 badge redesign, TABL-02 side badges, cost_basis column, pct_return default:true, drag header with @dnd-kit, `<tfoot>`, `mistakeTypes` prop + MIST-03 pills, `totalCount` prop |
| `components/TradeModal.tsx` | MODIFY | Add: Mistakes section in reflection tab, `selectedMistakeIds` state, mistake type fetch, tag sync on save |
| `components/trades/TradesShell.tsx` | MODIFY | Add: fetch mistake types and pass as prop to TradeTable; pass `totalCount={allTrades.length}` to TradeTable |

**Untouched:** All API routes (already complete from Phase 18). `lib/types.ts` (already has MistakeType, Trade.mistake_tag_ids). `lib/trade-utils.ts`. Filter components.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `components/TradeTable.tsx` (full read, 691 lines) — existing column definitions, STATUS_STYLE map, row render patterns, props interface
- Codebase: `components/TradeModal.tsx` (full read, 832 lines) — tab structure, save flow, existing state management, reflection tab layout
- Codebase: `components/trades/TradesShell.tsx` (full read, 340 lines) — saveColumns, visibleColumns state, TradeTable props, mistake filter logic in applyFilter
- Codebase: `components/dashboard/DashboardShell.tsx` (lines 1-100, 220-280, 833-838, 1249-1265) — verified @dnd-kit pattern: DndContext, SortableContext, useSortable, arrayMove, drag handle pattern
- Codebase: `app/api/trades/route.ts` (full read) — confirmed mistake_tag_ids via GROUP_CONCAT in GET query (line 40)
- Codebase: `app/api/trades/[id]/mistakes/route.ts` (full read) — POST/DELETE for tagging; confirmed ownership checks
- Codebase: `app/api/mistakes/route.ts` (full read) — GET returns [] for guests
- Codebase: `lib/types.ts` (full read) — MistakeType interface, Trade.mistake_tag_ids field, ColumnKey type
- Codebase: `lib/trade-utils.ts` (full read) — calcPercentReturn, calcRRAchieved signatures
- Codebase: `lib/privacy-context.tsx` (full read) — `usePrivacy` hook, `hidden` boolean pattern
- Codebase: `package.json` — confirmed @dnd-kit/core ^6.3.1, @dnd-kit/sortable ^10.0.0, @dnd-kit/utilities ^3.2.2
- Codebase: `.planning/STATE.md` — decision: "Mistake type dropdown sets filter.mistakeId but applyFilter logic deferred to Phase 22 (trade-mistake junction data not in trades fetch yet)" — now confirmed fully implemented in Phase 20's applyFilter

### Secondary (MEDIUM confidence)
- @dnd-kit/sortable documentation: `horizontalListSortingStrategy` is the correct strategy for a single-row horizontal list (vs rectSortingStrategy for 2D grids)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified via package.json
- Architecture: HIGH — all patterns derived directly from existing codebase files, no new dependencies
- Pitfalls: HIGH — identified from direct code inspection of TradeTable, TradeModal, and DashboardShell

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable — no fast-moving external dependencies)
