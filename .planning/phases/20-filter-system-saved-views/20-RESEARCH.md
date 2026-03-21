# Phase 20: Filter System & Saved Views - Research

**Researched:** 2026-03-21
**Domain:** React filter UI, date range selection, multi-select dropdowns, localStorage-persisted saved views
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | User can filter trades by date range (from/to) | `TradeFilterState.dateFrom` / `dateTo` already typed; `applyFilter()` already handles them; need to add date picker inputs to the filter bar |
| FILT-02 | User can filter trades by setup/tag via multi-select dropdown | `Trade.tags` is comma-separated string; need to extract distinct tags across trades, render multi-select, filter via `filter.tags[]` array; `applyFilter()` stub for tags exists |
| FILT-03 | User can filter trades by mistake type via multi-select dropdown | `filter.mistakeId` in `TradeFilterState` stores a single ID; Phase 22 adds `trade_mistake_tags` query; for Phase 20 this is deferred (mistakeId field is in types but mistake-tag-joins not yet populated) |
| FILT-04 | User can filter trades by account via dropdown | `TradeFilterState.accountId` field exists; `useAccounts()` provides account list; filtering by accountId means the user wants a subset *within* the "All Accounts" view |
| FILT-05 | User can see active filters as dismissible chips with individual clear | ALREADY IMPLEMENTED in Phase 19 (`TradeFilterChips.tsx`) — just needs new filter fields added to chip generation logic |
| FILT-06 | User can clear all active filters at once | ALREADY IMPLEMENTED in Phase 19 (`TradesShell.tsx` `clearAllFilters()`) |
| FILT-07 | User can apply quick filter presets (Winners, Losers, This Week, This Month) | `pnlFilter: "winners"/"losers"` already wired in `applyFilter()`; "This Week"/"This Month" set `dateFrom`/`dateTo` to computed ISO strings |
| FILT-08 | User can save current filter state as a named view | `SavedView` type already in `lib/types.ts`; persist `SavedView[]` as `saved_filter_views` key via `/api/settings`; guests use localStorage only |
| FILT-09 | User can load and delete saved filter views | Load: `setFilter(view.filter)`; Delete: filter array and re-persist to `/api/settings` |
</phase_requirements>

## Summary

Phase 20 adds UI controls for the filter fields that `TradeFilterState` already declares but has no inputs for: date range (dateFrom/dateTo), tags/setup multi-select, quick presets (Winners/Losers/This Week/This Month), and saved named views. The data plumbing — `TradeFilterState`, `DEFAULT_FILTER`, `applyFilter()`, `TradeFilterChips`, sessionStorage persistence — was fully built in Phase 19. This phase is **UI controls and saved views storage only**.

The biggest design decision is where to put the new filter controls. The current `TradesShell` filter bar already has symbol search, status buttons, direction buttons, and column toggle. Adding date pickers, a tags multi-select, and a views dropdown inline would overflow it. The clean approach is a `TradeFilterBar` component extracted into `components/trades/` that contains all filter inputs, with an optional "More filters" expand section for date range and tags.

Saved views persist via `/api/settings` with key `saved_filter_views` (JSON-stringified `SavedView[]`). This is identical to how `dashboard_layout`, `watchlists`, and `chart_tabs` are persisted — no new API needed.

**Primary recommendation:** Extract filter bar into `TradeFilterBar` component; add date range inputs (native `<input type="date">`), tags multi-select (custom dropdown from `Trade.tags` values in `allTrades`), quick preset buttons; wire saved views to `/api/settings` key `saved_filter_views`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (built-in) | 18 via Next.js 15 | useState, useRef for dropdown state | Already in use everywhere |
| TypeScript | project | `TradeFilterState`, `SavedView` already typed | All components are typed |
| Native browser `<input type="date">` | N/A | Date range from/to pickers | No dependency, good enough for trading journal; no need for a calendar library |
| `/api/settings` PUT | N/A | Persist `SavedView[]` | Identical pattern to chart_tabs, watchlists, dashboard_layout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | project | Bookmark, ChevronDown, Check, X icons for filter UI | Project standard for all icons |
| sessionStorage | browser | Filter state persistence (already wired from Phase 19) | Already working — no changes needed |
| `useAccounts()` | project hook | Provide account list for account filter dropdown | Already imported in TradesShell |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<input type="date">` | react-datepicker, react-day-picker | Library has better UX but adds a dependency; trading journal dates are simple YYYY-MM-DD; native input is sufficient |
| Custom tags dropdown | react-select, downshift | Libraries add kb; tags list is short (derived from existing trades); custom 20-line dropdown is fine |
| `/api/settings` for saved views | Separate DB table | Settings KV is already wired; no schema migration needed; views are user-scoped and small |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
components/trades/
├── TradesShell.tsx           # Owns all state; passes filter + setFilter to children
├── TradeFilterBar.tsx        # NEW: all filter inputs (extracted from TradesShell inline section)
├── TradeFilterChips.tsx      # EXISTING: already handles all chip fields
├── TradeImportExport.tsx     # EXISTING: unchanged
└── SavedViewsDropdown.tsx    # NEW: load/save/delete named views
```

### Pattern 1: TradeFilterBar Component
**What:** Extract the entire filter row (currently inline in TradesShell JSX lines 220-290) into `TradeFilterBar.tsx`, then add the new controls to it.
**When to use:** Keeps TradesShell JSX clean; all filter input rendering is co-located.
**Props interface:**
```typescript
interface TradeFilterBarProps {
  filter: TradeFilterState;
  onFilterChange: (partial: Partial<TradeFilterState>) => void;
  allTrades: Trade[];          // for deriving distinct tags
  accounts: Account[];         // for account filter dropdown
}
```

### Pattern 2: Tags Multi-Select Dropdown
**What:** Derive distinct tags from `allTrades` (split comma-separated `Trade.tags`), render a custom dropdown with checkboxes.
**When to use:** When user clicks "Setup / Tags" button.
**Key detail:** `Trade.tags` is stored as `"momentum,breakout,ai"` (comma-separated string). The filter's `filter.tags` is a `string[]` array.

```typescript
// Derive distinct tags from all trades
const allTags = useMemo(() => {
  const tagSet = new Set<string>();
  allTrades.forEach(t => {
    if (t.tags) t.tags.split(",").map(s => s.trim()).filter(Boolean).forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}, [allTrades]);

// In applyFilter — complete the stub from Phase 19:
if (filter.tags.length > 0) {
  const tradeTags = t.tags ? t.tags.split(",").map(s => s.trim()) : [];
  if (!filter.tags.some(ft => tradeTags.includes(ft))) return false;
}
```

### Pattern 3: Quick Preset Buttons
**What:** Buttons that set multiple filter fields at once via `updateFilter()`.
**When to use:** "This Week", "This Month", "Winners", "Losers" buttons.
**Key detail:** Dates use ISO `YYYY-MM-DD` format to match `Trade.exit_date` comparison in `applyFilter()`.

```typescript
function getThisWeekRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7)); // Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(monday), dateTo: fmt(sunday) };
}

function getThisMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(first), dateTo: fmt(last) };
}

// Usage in TradeFilterBar:
<button onClick={() => onFilterChange({ pnlFilter: "winners" })}>Winners</button>
<button onClick={() => onFilterChange({ pnlFilter: "losers" })}>Losers</button>
<button onClick={() => onFilterChange(getThisWeekRange())}>This Week</button>
<button onClick={() => onFilterChange(getThisMonthRange())}>This Month</button>
```

### Pattern 4: Saved Views
**What:** `SavedView[]` persisted to `/api/settings` key `saved_filter_views` as a JSON string. Load/save/delete via `SavedViewsDropdown` component.
**When to use:** User clicks "Save view" to capture current filter state.
**Props interface:**
```typescript
interface SavedViewsDropdownProps {
  currentFilter: TradeFilterState;
  onLoadView: (filter: TradeFilterState) => void;
  isGuest: boolean;
}
```
**State owned internally:** `views: SavedView[]`, `showDropdown`, `showNameInput`, `viewName`.
**Persistence pattern (identical to chart_tabs):**
```typescript
// Load on mount (from /api/settings or localStorage for guests)
const raw = settingsData.saved_filter_views;
if (raw) {
  try { setViews(JSON.parse(raw)); } catch { /* ignore */ }
}

// Save after mutation
const persistViews = async (updated: SavedView[]) => {
  setViews(updated);
  if (!isGuest) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved_filter_views: JSON.stringify(updated) }),
    });
  }
  // Guests: views are ephemeral (in-memory only) or localStorage
};

// Create new view
const saveView = (name: string) => {
  const view: SavedView = {
    id: crypto.randomUUID(),
    name,
    filter: currentFilter,
    created_at: new Date().toISOString(),
  };
  persistViews([...views, view]);
};

// Delete view
const deleteView = (id: string) => {
  persistViews(views.filter(v => v.id !== id));
};
```

### Pattern 5: Account Filter Dropdown
**What:** Dropdown to filter trades within "All Accounts" view to a single account.
**Key design decision (from STATE.md):** `filter.accountId` is separate from `activeAccountId` in `useAccounts()`. The data fetch uses `activeAccountId` (from context); `filter.accountId` is a secondary client-side filter applied by `applyFilter()`. This means:
- When `activeAccountId = null` (All Accounts), `filter.accountId` can narrow to a single account.
- When `activeAccountId = "some-id"` (specific account selected), `filter.accountId` could further filter — but this is confusing UX. Recommendation: only show the account filter dropdown when `activeAccountId === null` (All Accounts mode).

**applyFilter addition:**
```typescript
if (filter.accountId && t.account_id !== filter.accountId) return false;
```

### Pattern 6: Date Range Inputs
**What:** Two `<input type="date">` inputs for `dateFrom` and `dateTo`.
**When to use:** Inline in the filter bar (possibly behind a "Date range" toggle to keep the bar compact).
**Key detail:** Native date inputs return `YYYY-MM-DD` format — matches `Trade.exit_date` format exactly. No conversion needed.

```typescript
<input
  type="date"
  value={filter.dateFrom ?? ""}
  onChange={(e) => onFilterChange({ dateFrom: e.target.value || null })}
  className="h-9 px-3 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white"
/>
<input
  type="date"
  value={filter.dateTo ?? ""}
  onChange={(e) => onFilterChange({ dateTo: e.target.value || null })}
  className="h-9 px-3 text-sm rounded-lg dark:bg-slate-800 bg-white dark:text-white"
/>
```

### Pattern 7: TradeFilterChips Extension (FILT-05 already done)
**What:** `TradeFilterChips.tsx` already handles all current filter fields. For Phase 20, add chip generation for `filter.tags` (already has a stub) and `filter.accountId`.
**Changes needed in TradeFilterChips.tsx:**
```typescript
// Tags chip — replace existing stub that already handles tags.length > 0:
// (already renders "Tags: N selected" — no change needed for basic case)
// Optionally make it show the tag names: `filter.tags.join(", ")`

// Account chip — add:
if (filter.accountId) {
  const accountName = accounts.find(a => a.id === filter.accountId)?.name ?? filter.accountId;
  chips.push({ label: `Account: ${accountName}`, field: "accountId" });
}
```
Note: `TradeFilterChips` needs an `accounts` prop added to support the account chip label.

### Anti-Patterns to Avoid
- **Deriving tags list inside render without useMemo:** Iterating all trades on every render is wasteful. Derive `allTags` with `useMemo` keyed on `allTrades`.
- **Using `filter.accountId` for data fetch:** The trades fetch is scoped by `activeAccountId` from context (server-side). `filter.accountId` is client-side only. Never use `filter.accountId` in the fetch URL.
- **Storing `SavedView[]` in sessionStorage:** Views should survive browser close — use `/api/settings` (authenticated users) or localStorage (guests). Filter state stays in sessionStorage; saved views go to `/api/settings`.
- **Showing account filter when a specific account is already selected:** Only render the account filter dropdown when `activeAccountId === null`. When a specific account is selected in the navbar switcher, the account filter is redundant.
- **Resetting saved views on account switch:** Saved views are global to the user, not account-scoped. Do not clear `views` state when `activeAccountId` changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Saved views persistence | Custom API route | Existing `/api/settings` PUT with `saved_filter_views` key | Settings API already handles arbitrary JSON keys, user scoping, and guest blocking |
| Unique ID for saved views | Custom UUID | `crypto.randomUUID()` | Built into all modern browsers and Node; already used in project |
| Date formatting | Custom date formatter | `new Date().toISOString().slice(0, 10)` | ISO date string matches Trade.exit_date format directly |
| Tags extraction | Custom data structure | `useMemo` over `allTrades` splitting `t.tags` | Simple, no library needed |
| Multi-select dropdown | react-select | Custom 20-line dropdown with checkboxes | Tag list is short; avoiding a dependency is better for bundle size |

**Key insight:** 90% of the work in Phase 20 is adding JSX controls to `TradeFilterBar` and wiring `SavedViewsDropdown`. The data model, filter logic, chip display, and persistence pattern are all established.

## Common Pitfalls

### Pitfall 1: Tags filter semantics (OR vs AND)
**What goes wrong:** Implementing tags filter as AND (trade must have ALL selected tags) instead of OR (trade has ANY selected tag) gives confusing results with zero matches.
**Why it happens:** The REQUIREMENTS say "multi-select dropdown and see only matching trades" — "matching" is ambiguous.
**How to avoid:** Use OR semantics (common in filter UIs): a trade matches if it has **any** of the selected tags. This returns more results and matches user mental model. The code: `filter.tags.some(ft => tradeTags.includes(ft))`.

### Pitfall 2: Date comparison edge case for open trades
**What goes wrong:** Open trades have `exit_date = null`. If user sets a date filter, open trades disappear entirely.
**Why it happens:** `applyFilter()` already handles this correctly: `if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false` — the `&& t.exit_date` guard means null exit_date passes through.
**How to avoid:** Verify this behavior is preserved when completing the `applyFilter()` implementation. Open trades should always show through date filters (or optionally use entry_date for planned/open trades).

### Pitfall 3: "This Week" preset definition
**What goes wrong:** "This Week" computed as Sun-Sat when user expects Mon-Sun (trading week).
**Why it happens:** `new Date().getDay()` returns 0 for Sunday. Week start convention varies.
**How to avoid:** Use Monday as week start: `monday = date - ((day + 6) % 7)`. This makes Sunday day 6 (end of week), which is correct for traders.

### Pitfall 4: Saved view names collide
**What goes wrong:** User saves two views named "FOMO Review" — duplicate names in the list are confusing.
**Why it happens:** No uniqueness enforcement on view names.
**How to avoid:** Each view has a unique `id` (UUID) so duplicates are harmless structurally. Optionally warn on duplicate names, but do not block. The UUID-keyed array handles all operations correctly even with duplicate names.

### Pitfall 5: SavedViewsDropdown loads views from /api/settings but TradesShell already fetches settings
**What goes wrong:** `SavedViewsDropdown` makes its own `/api/settings` fetch, creating a duplicate network request.
**Why it happens:** Component wants to be self-contained.
**How to avoid:** Pass `initialViews: SavedView[]` as a prop to `SavedViewsDropdown`, populated from the `settingsData` that `TradesShell.load()` already fetches. The component uses this as initial state and takes ownership of persistence from there.

### Pitfall 6: Filter bar overflow on mobile
**What goes wrong:** Adding date inputs + tags dropdown + presets to the filter bar overflows on small screens.
**Why it happens:** Filter bar grows wider; current layout uses `flex flex-wrap`.
**How to avoid:** Group new controls behind a "More filters" expand button or a "Date" collapsible section. The requirements note MOBI-02 (Phase 23) will handle horizontal scroll for chips, but the filter bar inputs should be responsive from day one.

### Pitfall 7: Date input styling inconsistency across browsers
**What goes wrong:** `<input type="date">` renders a browser-native calendar picker that ignores Tailwind dark mode styling (especially on Chrome/Windows).
**Why it happens:** The native date picker chrome is OS/browser-controlled.
**How to avoid:** Apply `color-scheme: dark` via Tailwind's `[color-scheme:dark]` class or inline style on the date input when in dark mode. This makes the calendar popup dark on Chrome. Example: `className="... dark:[color-scheme:dark]"`.

## Code Examples

Verified patterns from existing codebase:

### applyFilter() — current implementation (TradesShell.tsx lines 14-25)
```typescript
// Source: components/trades/TradesShell.tsx
function applyFilter(trades: Trade[], filter: TradeFilterState): Trade[] {
  return trades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) return false;
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false;
    if (filter.dateTo && t.exit_date && t.exit_date > filter.dateTo) return false;
    return true;
  });
}
// Phase 20 adds: accountId check, tags check (completing the stubs)
```

### SavedView type (lib/types.ts lines 189-194)
```typescript
// Source: lib/types.ts
export interface SavedView {
  id: string;        // crypto.randomUUID()
  name: string;
  filter: TradeFilterState;
  created_at: string;
}
```

### Settings persistence pattern (used by chart_tabs, watchlists, dashboard_layout)
```typescript
// Pattern already used in PersistentChart.tsx and DashboardShell.tsx
await fetch("/api/settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ saved_filter_views: JSON.stringify(updatedViews) }),
});
```

### TradeFilterChips — already handles tags stub (TradeFilterChips.tsx line 47-49)
```typescript
// Source: components/trades/TradeFilterChips.tsx
if (filter.tags.length > 0) {
  chips.push({ label: `Tags: ${filter.tags.length} selected`, field: "tags" });
}
// Phase 20 can enhance this to show tag names instead of count
```

### Tags in demo data (comma-separated string format)
```typescript
// Source: lib/demo-data.ts (confirmed)
// Trade.tags = "momentum,breakout,ai"  (comma-separated, not JSON array)
// Splitting: t.tags.split(",").map(s => s.trim()).filter(Boolean)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No date filter UI | `dateFrom`/`dateTo` inputs + `applyFilter()` already handles them | Phase 20 | Date range filtering works once inputs are added |
| No tags filter | `filter.tags[]` in TradeFilterState, stub in applyFilter | Phase 20 completes | Tags multi-select dropdown needed |
| No quick presets | Planned | Phase 20 | Preset buttons set multiple filter fields at once |
| No saved views | `SavedView` type in lib/types.ts, no UI | Phase 20 | Named views persist via /api/settings |
| Filter chips already done | `TradeFilterChips.tsx` complete | Phase 19 | Just add accountId chip; tags chip already stubbed |

**Already done (do not re-implement):**
- FILT-05 and FILT-06: Fully implemented in Phase 19.
- `applyFilter()` for pnlFilter, dateFrom, dateTo, symbol, status, direction: fully wired.
- sessionStorage filter persistence: fully wired.
- `TradeFilterState` / `DEFAULT_FILTER` type: complete.

## Open Questions

1. **FILT-03: Mistake type filter (Phase 20 scope?)**
   - What we know: `filter.mistakeId` is in `TradeFilterState` but the `trade_mistake_tags` junction table (Phase 18) is not yet used by the trades list fetch. The trades array does not currently include mistake tag data.
   - What's unclear: Can FILT-03 be implemented in Phase 20 without Phase 22 (which wires mistake tags to the trade table display)?
   - Recommendation: Defer FILT-03 to Phase 22. The planner should note that `filter.mistakeId` remains unused in Phase 20 (applyFilter already has a no-op comment for it). Phase 22 will fetch `trade_mistake_tags` joins and complete the filter.

2. **Account filter dropdown visibility logic**
   - What we know: STATE.md says "filter.accountId vs activeAccountId is unresolved."
   - Recommendation: Render account dropdown only when `activeAccountId === null` (All Accounts view). When a specific account is active, the dropdown is unnecessary and potentially confusing.

3. **"This Week" preset — does it override existing date chips?**
   - What we know: Presets call `updateFilter({ dateFrom, dateTo })` which updates only those fields.
   - What's unclear: If user already has a date range set and clicks "This Week", should it fully replace dateFrom/dateTo? Yes — `updateFilter` merges, but since it only touches dateFrom and dateTo, it replaces them cleanly.
   - Recommendation: This works correctly as-is. No special handling needed.

## Sources

### Primary (HIGH confidence)
- `components/trades/TradesShell.tsx` — current state after Phase 19 (read directly)
- `components/trades/TradeFilterChips.tsx` — existing chip component (read directly)
- `lib/types.ts` — `TradeFilterState`, `DEFAULT_FILTER`, `SavedView` types (read directly)
- `app/api/settings/route.ts` — settings persistence pattern (read directly)
- `lib/demo-data.ts` — confirmed `Trade.tags` comma-separated format (read directly)
- `.planning/STATE.md` — confirmed decision: sessionStorage for filter, open question on accountId (read directly)
- `.planning/phases/19-tradesshell-refactor/19-RESEARCH.md` — Phase 19 patterns (read directly)

### Secondary (MEDIUM confidence)
- MDN: `crypto.randomUUID()` — browser built-in, available in all modern browsers and Node 14.17+
- MDN: `<input type="date">` — returns YYYY-MM-DD format, matches Trade.exit_date format

### Tertiary (LOW confidence)
None — all findings based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns already exist in codebase
- Architecture: HIGH — SavedView type pre-declared, applyFilter stubs already written, settings API pattern well-established
- Pitfalls: HIGH — identified from direct inspection of existing code and known browser behavior

**Research date:** 2026-03-21
**Valid until:** Stable — internal codebase knowledge; valid until Phase 20 implementation changes the code
