# Architecture Patterns

**Domain:** Trades page overhaul — filters, saved views, mistakes tagging, summary stats, column config, sidebar analytics
**Researched:** 2026-03-21
**Milestone:** v3.0 Trades Page Overhaul
**Confidence:** HIGH (derived from full codebase read; all patterns proven from existing code)

---

## Executive Context

The v3.0 milestone transforms `app/trades/page.tsx` from a ~590-line monolith with basic symbol/status/direction filtering into a full-featured workspace. The existing page already loads all trades client-side, filters in-memory, and persists column config via `/api/settings`. The work is additive: new DB migrations for mistakes types, new filter state, new components extracted from the page, and a new sidebar analytics panel. No existing API routes are removed; the GET `/api/trades` route gains additional query params.

The key architectural constraint: the existing codebase stores UI config as JSON strings in the settings table (strategies, dashboard layouts, watchlists, tab configs, column visibility). This pattern must be followed for saved views and column order. No new tables for user preferences.

---

## Recommended Architecture

```
app/
  trades/
    page.tsx                      MODIFY: thin shell — imports TradesShell, passes nothing
components/
  trades/                         NEW directory
    TradesShell.tsx               NEW: orchestrator (~600 lines). Owns all filter state,
                                       loads trades + mistakes types, mounts sub-components.
    FilterBar.tsx                 NEW: symbol search, dropdown filters, quick chips, active
                                       filter chips with clear, saved views load/save/delete.
    SummaryStatsBar.tsx           NEW: 3 stat cards (Cumulative Return, P/L Ratio, Win%) +
                                       sparklines. Scoped to filtered trades.
    TradesSidebar.tsx             NEW: right sidebar. Account performance, setups P&L
                                       breakdown, mistakes P&L breakdown. Collapsible.
    MistakesPill.tsx              NEW: displays mistake tags inline in table row.
    SavedViewsMenu.tsx            NEW: dropdown panel for save/load/delete named views.
  TradeTable.tsx                  MODIFY: add "mistakes" column, status/side badges, net
                                          return $/%/cost columns, column reorder support.
lib/
  db.ts                           MODIFY: add migrations 023 (mistake_types table) and
                                          024 (trade_mistake_tags junction table).
  types.ts                        MODIFY: add MistakeType, TradeFilterState interfaces.
app/
  api/
    trades/
      route.ts                    MODIFY: add date_from/date_to/mistake_id/tag query params.
    mistakes/
      route.ts                    NEW: GET list, POST create mistake type (user-scoped).
      [id]/
        route.ts                  NEW: PUT rename, DELETE mistake type.
    trades/
      [id]/
        mistakes/
          route.ts                NEW: POST add mistake tag, DELETE remove mistake tag.
```

---

## Component Boundaries

### Feature 1: Filter System and Saved Views

**Current state:** Filters live directly in `app/trades/page.tsx` as three `useState` calls (`status`, `direction`, `symbolQ`). Filtering is client-side. There are no filter chips, no presets, no saved views.

**New filter state model:**

```typescript
// lib/types.ts (additions)
export interface TradeFilterState {
  symbol: string;           // substring match
  status: "all" | "planned" | "open" | "closed";
  direction: "all" | "long" | "short";
  mistakeId: string | null; // filter to trades tagged with this mistake type
  tags: string[];           // custom tags (from trade.tags JSON field)
  dateFrom: string | null;  // ISO date string
  dateTo: string | null;    // ISO date string
  accountId: string | null; // null = active account from context (not a separate filter)
}

export const DEFAULT_FILTER: TradeFilterState = {
  symbol: "",
  status: "all",
  direction: "all",
  mistakeId: null,
  tags: [],
  dateFrom: null,
  dateTo: null,
  accountId: null,
};

export interface SavedView {
  id: string;               // crypto.randomUUID()
  name: string;
  filter: TradeFilterState;
  created_at: string;
}
```

**Filter state management — React state only (not URL params):**

The existing page uses no URL params for filters. Given the app is a single-user journaling tool (not a shareable link destination), React state is sufficient and simpler. URL params would add `useSearchParams` + router dependency for no user benefit. The saved views system gives persistence without URL coupling.

If a future milestone adds deep linking to specific filter states, URL params can be added then — it is an additive change (read from URL on mount, write on filter change).

**Quick filter presets (client-side computed, not stored):**

```typescript
const QUICK_FILTERS: { label: string; filter: Partial<TradeFilterState> }[] = [
  { label: "Winners",    filter: { status: "closed" } }, // show trades where pnl > 0 — post-filter
  { label: "Losers",     filter: { status: "closed" } }, // show trades where pnl < 0 — post-filter
  { label: "This Week",  filter: { dateFrom: startOfWeek, dateTo: today } },
  { label: "This Month", filter: { dateFrom: startOfMonth, dateTo: today } },
];
```

Winners/Losers are special: they need a `pnlFilter: "winners" | "losers" | "all"` field added to `TradeFilterState`. The filter is applied client-side after loading (pnl is already on the trade object from the DB).

**Saved views persistence:** Follow the strategies/templates pattern exactly.

```typescript
// settings key: "trades_saved_views"
// value: JSON.stringify(SavedView[])
```

Loaded in `TradesShell` on mount alongside settings. Saved via `PUT /api/settings`. No dedicated API route needed.

**FilterBar component interface:**

```typescript
interface FilterBarProps {
  filter: TradeFilterState;
  onFilterChange: (patch: Partial<TradeFilterState>) => void;
  onReset: () => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  mistakeTypes: MistakeType[];
  allTags: string[];           // derived from loaded trades
}
```

**Active filter chips:** Rendered by FilterBar. One chip per active filter criterion. Each chip shows the criterion label and an X to clear that specific filter. "Clear all" button when any filter is active.

---

### Feature 2: Mistakes Tagging System

**Data model: two new DB tables (migrations 023 and 024).**

This is the only feature that requires new tables. The existing `trades.mistakes` column (TEXT, added in migration 013) stores a free-text string — it is not structured enough for filtering or analytics. The new system is a proper many-to-many relationship.

```sql
-- Migration 023: mistake_types table
CREATE TABLE IF NOT EXISTS mistake_types (
  id         TEXT PRIMARY KEY,    -- crypto.randomUUID()
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#ef4444',  -- hex color for pill display
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_mistake_types_user ON mistake_types(user_id);

-- Migration 024: trade_mistake_tags junction table
CREATE TABLE IF NOT EXISTS trade_mistake_tags (
  trade_id    INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  mistake_id  TEXT NOT NULL REFERENCES mistake_types(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, mistake_id)
);
CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_trade ON trade_mistake_tags(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_mistake ON trade_mistake_tags(mistake_id);
```

**Why not reuse `trades.mistakes` TEXT column?**

The existing `trades.mistakes` column is a freeform text reflection field used in the journal/TradeModal. It is NOT structured tag data — it stores notes like "Chased entry, ignored stop". The new system is separate: user-defined mistake type records linked to trades. The old column remains for backward compat. The TradeModal can continue writing freeform reflection to `trades.mistakes`; the new pill-based tagging writes to `trade_mistake_tags`.

**MistakeType interface:**

```typescript
// lib/types.ts
export interface MistakeType {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}
```

**API routes:**

```
GET  /api/mistakes              → list user's mistake types
POST /api/mistakes              → create new mistake type { name, color }
PUT  /api/mistakes/[id]         → rename or recolor { name?, color? }
DELETE /api/mistakes/[id]       → delete (cascades to trade_mistake_tags)

POST   /api/trades/[id]/mistakes         → tag a trade { mistake_id }
DELETE /api/trades/[id]/mistakes/[mid]   → untag a trade
```

**Loading mistakes on the trades page:** `GET /api/trades` does NOT join `trade_mistake_tags` — that would bloat the response. Instead, `TradesShell` makes two parallel fetches: one for trades, one for mistakes types. A third fetch gets `trade_mistake_tags` for the current account scope as a mapping `{ trade_id: mistake_id[] }`. This mapping is joined client-side.

```typescript
// TradesShell: parallel load
const [tradesRes, mistakesRes, tagsRes] = await Promise.all([
  fetch(tradesUrl),
  fetch("/api/mistakes"),
  fetch("/api/trades/mistake-tags" + (activeAccountId ? `?account_id=${activeAccountId}` : "")),
]);
```

Alternatively, add a `?include_mistakes=1` param to `GET /api/trades` that adds a LEFT JOIN and returns `mistake_ids: string[]` per trade. This is cleaner. Either approach works — the join approach is recommended to keep network requests to 2 instead of 3.

**Tagging UI in TradeTable:** Each row gets a small `MistakesPill` component showing colored pills for each tagged mistake type. Clicking a pill opens a dropdown to add/remove mistake types. This is inline editing — no modal needed.

---

### Feature 3: Summary Stats Bar with Sparklines

**Positioning:** Between the filter bar and the trade table. Scoped to the currently filtered trades (updates as filters change). Does not use the AccountBanner (which shows all-account stats) — it shows filter-scoped stats.

**Stats to display:**

| Stat | Calculation | Sparkline |
|------|-------------|-----------|
| Cumulative P&L | Sum of `pnl` for closed trades in filter | Daily P&L over time (line chart) |
| Win Rate | Winners / (Winners + Losers) × 100 | Win/loss by week (bar chart) |
| P/L Ratio | Avg winner pnl / Abs(avg loser pnl) | None (single ratio) |

**Sparkline implementation:** Use Recharts (already in the stack). A `<AreaChart>` or `<LineChart>` at 120×40px with no axes, no tooltip, no legend — purely visual. The data is derived client-side from the filtered trades array (group by exit_date, sum pnl). No new API calls.

```typescript
// SummaryStatsBar.tsx — data derivation (client-side, no fetch)
interface SummaryStatsBarProps {
  trades: Trade[];  // already filtered
  hidden: boolean;
}
```

**Why not persist the time scope separately?** The trades page will have date filters in the filter bar. The summary stats bar reflects the filter bar's active date range. No additional time selector is needed on the stats bar itself — this avoids the confusion of having two date controls on the same page. The stat "scoped to all trades unless date-filtered" in the milestone brief means: show all-time stats when no date filter is active; show filtered stats when one is.

---

### Feature 4: Enhanced Trade Table

**Modifications to `TradeTable.tsx`:**

1. **Status/side badges:** Already partially styled (`STATUS_STYLE` object exists). The badge rendering is already in the table — `direction` uses `ArrowUpRight`/`ArrowDownRight` icons. No structural change; just confirm the visual treatment is distinct badges (colored background + text).

2. **New columns to add to `ALL_COLUMNS`:**

```typescript
{ key: "net_return",   label: "Net $",    default: false },  // pnl - commission
{ key: "pct_return_exit", label: "% Return", default: false }, // already exists as pct_return — confirm calculation uses exit
{ key: "cost",         label: "Cost",     default: false },  // entry_price * shares
{ key: "mistakes",     label: "Mistakes", default: false },  // MistakesPill rendering
```

Note: `pct_return` already exists in `ALL_COLUMNS` (index 11). Confirm it uses `(exit_price - entry_price) / entry_price * direction_multiplier`. If so, no change needed — just verify.

3. **Column reorder:** The existing system uses a toggle-based dropdown. For v3.0, the milestone asks for "column config" not necessarily drag-to-reorder. A simpler approach: the column visibility dropdown already exists; add an "order" concept by letting the user drag columns in that dropdown (DnD kit is already in the stack). The column order is stored alongside `trade_table_columns` in settings:

```typescript
// settings key: "trade_table_columns" (already exists)
// current: JSON.stringify(ColumnKey[])  — array of visible keys
// new: same format — the array order defines render order
```

The `TradeTable` receives `visibleColumns: ColumnKey[]` and renders them in array order. This is already the case. The only change: the column config dropdown now supports drag-to-reorder (using `@dnd-kit/sortable`), and the ordered array is saved.

---

### Feature 5: Right Sidebar Analytics

**Layout structure:**

```
┌─────────────────────────────────────────────────────┐
│  Filter Bar                                         │
│  Summary Stats Bar                                  │
│  ┌──────────────────────────────┐ ┌───────────────┐ │
│  │  Trade Table                 │ │  Sidebar      │ │
│  │  (flexible width)            │ │  Analytics    │ │
│  │                              │ │  (fixed 280px)│ │
│  └──────────────────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Implementation:** CSS grid with two columns. The sidebar is collapsible (toggle button on its left edge, similar to the Navbar collapse pattern). Width is fixed at 280px when expanded, 0 when collapsed (CSS transition). Collapsed state is persisted in localStorage (`trades_sidebar_collapsed`).

```tsx
// In TradesShell.tsx
const [sidebarOpen, setSidebarOpen] = useState(true);
// Persist in localStorage on change

<div className={`flex gap-4 ${sidebarOpen ? "grid grid-cols-[1fr_280px]" : "grid grid-cols-[1fr]"}`}>
  <div className="min-w-0">
    <TradeTable ... />
  </div>
  {sidebarOpen && (
    <TradesSidebar trades={filteredTrades} mistakeTypes={mistakeTypes} />
  )}
</div>
```

**Sidebar content (three panels, each collapsible):**

1. **Account Performance:** Starting balance, current balance (start + total realized PnL), total PnL, win rate, expectancy. Derived from the UNFILTERED allTrades + activeAccount. This is the same data as AccountBanner — pass in the same computed values rather than re-fetching.

2. **Setups P&L Breakdown:** Group filtered trades by `strategy_id` (join with strategies from settings). Show strategy name, trade count, total PnL, win rate per strategy. Sorted by total PnL descending.

3. **Mistakes P&L Breakdown:** Group filtered trades by mistake type tag. For each mistake type, show: name, tagged trade count, total PnL of tagged trades. Sorted by total PnL (worst first — helps identify most costly mistakes).

All sidebar data is client-side derived from `filteredTrades` + `mistakeTypes` + strategies. No additional API calls.

**Mobile behavior:** On screens below `md` breakpoint (768px), the sidebar is hidden entirely (not collapsible, just gone). The toggle button does not render on mobile. This avoids a complex overlay/drawer pattern for v3.0. A drawer can be added later.

---

## Data Flow Changes

### New Settings Keys

| Key | Scope | Format | Purpose |
|-----|-------|--------|---------|
| `trades_saved_views` | user | `JSON: SavedView[]` | Named filter presets |
| `trade_table_columns` | user | `JSON: ColumnKey[]` (ordered) | Visible columns + render order |

`trade_table_columns` already exists — the format does not change, just the implication that order matters now.

### New DB Tables (Migrations 023 + 024)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `mistake_types` | User-defined mistake type catalog | id, user_id, name, color |
| `trade_mistake_tags` | Many-to-many: trades ↔ mistake types | trade_id, mistake_id (composite PK) |

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/mistakes` | GET | List user's mistake types |
| `POST /api/mistakes` | POST | Create mistake type |
| `PUT /api/mistakes/[id]` | PUT | Rename or recolor |
| `DELETE /api/mistakes/[id]` | DELETE | Delete (cascades tags) |
| `POST /api/trades/[id]/mistakes` | POST | Tag a trade with a mistake type |
| `DELETE /api/trades/[id]/mistakes/[mid]` | DELETE | Remove a mistake tag |

### Modified API Routes

| Route | Change |
|-------|--------|
| `GET /api/trades` | Add `date_from`, `date_to`, `mistake_id` query params (server-side filtering). Also add `?include_mistakes=1` to return `mistake_ids[]` per trade. |

**Current `GET /api/trades` supports:** `account_id`, `status`, `direction`, `symbol`, `ai_pattern`

**New params to add:**
- `date_from`: `exit_date >= ?` (ISO date)
- `date_to`: `exit_date <= ?` (ISO date)
- `mistake_id`: JOIN with `trade_mistake_tags WHERE mistake_id = ?`
- `include_mistakes=1`: adds LEFT JOIN subquery to return mistake IDs per trade

Most filtering will remain client-side for responsiveness (symbol search, pnl winners/losers, tag filtering). Date range and mistake filters benefit from server-side filtering when trade counts are large.

### Component File Map

| File | Status | What Changes |
|------|--------|--------------|
| `app/trades/page.tsx` | MODIFY | Becomes a thin shell importing `TradesShell` |
| `components/trades/TradesShell.tsx` | NEW | Main orchestrator, owns all state from current page.tsx |
| `components/trades/FilterBar.tsx` | NEW | All filter controls + saved views UI |
| `components/trades/SummaryStatsBar.tsx` | NEW | 3 stats + sparklines |
| `components/trades/TradesSidebar.tsx` | NEW | Right sidebar with 3 analytics panels |
| `components/trades/MistakesPill.tsx` | NEW | Inline mistake tag pills for table rows |
| `components/trades/SavedViewsMenu.tsx` | NEW | Dropdown for save/load/delete views |
| `components/TradeTable.tsx` | MODIFY | Add new columns, mistakes column, column reorder support |
| `lib/db.ts` | MODIFY | Migrations 023, 024 |
| `lib/types.ts` | MODIFY | Add MistakeType, SavedView, TradeFilterState |
| `app/api/mistakes/route.ts` | NEW | GET + POST mistake types |
| `app/api/mistakes/[id]/route.ts` | NEW | PUT + DELETE mistake type |
| `app/api/trades/[id]/mistakes/route.ts` | NEW | POST: add mistake tag to trade |
| `app/api/trades/[id]/mistakes/[mid]/route.ts` | NEW | DELETE: remove mistake tag |
| `app/api/trades/route.ts` | MODIFY | Add date_from, date_to, mistake_id, include_mistakes params |

**Untouched:** `lib/auth.ts`, `middleware.ts`, `lib/account-context.tsx`, `components/AccountBanner.tsx`, `components/TradeModal.tsx` (no changes needed for v3.0 — mistake tagging lives in the table row, not the modal), all settings API routes, all other pages.

---

## Patterns to Follow

### Pattern 1: Settings-Backed User Preferences (Saved Views)

Follow the `strategies` / `dashboard_layout_templates` pattern exactly:

```typescript
// TradesShell.tsx
const [savedViews, setSavedViews] = useState<SavedView[]>([]);

// Load on mount (alongside trades fetch)
const settingsData = await fetch("/api/settings").then(r => r.json());
if (settingsData.trades_saved_views) {
  try { setSavedViews(JSON.parse(settingsData.trades_saved_views)); } catch {}
}

// Save
const persistViews = (views: SavedView[]) => {
  setSavedViews(views);
  fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trades_saved_views: JSON.stringify(views) }),
  });
};

const saveCurrentView = (name: string) => {
  const view: SavedView = { id: crypto.randomUUID(), name, filter: { ...activeFilter }, created_at: new Date().toISOString() };
  persistViews([...savedViews, view]);
};
```

### Pattern 2: Client-Side Filter Application

The existing page filters in-memory. Keep this approach for symbol, status, direction, pnl winners/losers, and tags. Server-side filtering is only added for date range and mistake_id (where index scans are worth the round-trip).

```typescript
// TradesShell.tsx
const filteredTrades = useMemo(() => {
  return allTrades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) return false;
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.mistakeId) {
      const tradeMistakeIds = mistakeTagMap[t.id] ?? [];
      if (!tradeMistakeIds.includes(filter.mistakeId)) return false;
    }
    if (filter.tags.length > 0) {
      const tradeTags = t.tags ? JSON.parse(t.tags) : [];
      if (!filter.tags.every((tag: string) => tradeTags.includes(tag))) return false;
    }
    return true;
  });
}, [allTrades, filter, mistakeTagMap]);
```

### Pattern 3: Inline Row Editing for Mistake Tags

The MistakesPill component handles its own fetch on tag add/remove:

```typescript
// components/trades/MistakesPill.tsx
interface MistakesPillProps {
  tradeId: number;
  mistakeIds: string[];
  allMistakeTypes: MistakeType[];
  onUpdated: () => void;  // triggers TradesShell to reload mistake tag map
}

const addTag = async (mistakeId: string) => {
  await fetch(`/api/trades/${tradeId}/mistakes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mistake_id: mistakeId }),
  });
  onUpdated();
};
```

This avoids bubbling the operation up to the page — each row manages its own tagging state via the callback.

### Pattern 4: Migration Pattern (023, 024)

Follow the existing `hasMigration` / `markMigration` pattern in `lib/db.ts`:

```typescript
// Migration 023: mistake_types
if (!hasMigration(db, "023_mistake_types")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mistake_types (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#ef4444',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_mistake_types_user ON mistake_types(user_id);
  `);
  markMigration(db, "023_mistake_types");
}

// Migration 024: trade_mistake_tags
if (!hasMigration(db, "024_trade_mistake_tags")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_mistake_tags (
      trade_id   INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      mistake_id TEXT NOT NULL REFERENCES mistake_types(id) ON DELETE CASCADE,
      PRIMARY KEY (trade_id, mistake_id)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_trade ON trade_mistake_tags(trade_id);
    CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_mistake ON trade_mistake_tags(mistake_id);
  `);
  markMigration(db, "024_trade_mistake_tags");
}
```

### Pattern 5: Sidebar Collapse with localStorage

Follow the Navbar sidebar pattern:

```typescript
// TradesShell.tsx
const [sidebarOpen, setSidebarOpen] = useState(() => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("trades_sidebar_collapsed") !== "true";
});

const toggleSidebar = () => {
  const next = !sidebarOpen;
  setSidebarOpen(next);
  localStorage.setItem("trades_sidebar_collapsed", String(!next));
};
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reusing `trades.mistakes` TEXT for the Tagging System
**What:** Storing comma-separated mistake type IDs in `trades.mistakes`.
**Why bad:** That column is a freeform reflection text field, not a tag field. Storing IDs there breaks the journal/TradeModal which expects human-readable text. Also prevents filtering by mistake ID without a LIKE query across all rows.
**Instead:** New `trade_mistake_tags` junction table. Leave `trades.mistakes` for freeform notes.

### Anti-Pattern 2: URL Params for Filter State
**What:** Syncing `TradeFilterState` to `?status=closed&direction=long&dateFrom=...` URL params.
**Why bad:** Adds `useSearchParams`, `useRouter`, and navigation complexity. The app is not a shareable link destination — no user needs to bookmark a filtered trade view. Saved views provide better UX for persistence.
**Instead:** React state only. `useSearchParams` is a future addition if deep-linking becomes a requirement.

### Anti-Pattern 3: Fetching Sidebar Analytics Separately
**What:** Making dedicated API calls from `TradesSidebar` for setups breakdown, account performance.
**Why bad:** Data is already loaded in `TradesShell` (allTrades, filteredTrades, accounts, strategies from settings). Making additional fetches duplicates the data and introduces loading states inside the sidebar.
**Instead:** Pass derived data as props to `TradesSidebar`. All computation is client-side `useMemo`.

### Anti-Pattern 4: Mistake Types as Settings JSON
**What:** Storing `mistake_types` as a JSON array in the settings table (like strategies).
**Why bad:** Mistake types need CASCADE delete (removing a type should untag all trades). This requires a FK relationship. JSON-in-settings has no FK support. Also, filtering trades by mistake type at the DB level requires a real indexed table.
**Instead:** Proper tables: `mistake_types` + `trade_mistake_tags` with FK constraints and indexes.

### Anti-Pattern 5: Moving All Filtering Server-Side
**What:** Adding all filter params (symbol, status, direction, pnl, tags) to the API and removing client-side filtering.
**Why bad:** The summary stats bar and sidebar analytics both need the full trades array for their calculations. If filtering is server-side, the stats only see the filtered subset — which is correct for the summary bar, but the sidebar "Account Performance" panel should show all-account stats regardless of filter. Mixing server-side + client-side filtering is more complex than client-side-only.
**Instead:** Load all trades for the active account. Filter client-side for display. Only use server-side params for date range (performance on large datasets) and mistake_id (requires a JOIN the client doesn't have).

### Anti-Pattern 6: Full TradesShell Re-render on Mistake Tag
**What:** Calling `load()` (full page reload) after adding/removing a mistake tag.
**Why bad:** Reloads all trades and all settings, causing visible loading flicker.
**Instead:** Maintain a `mistakeTagMap: Record<number, string[]>` in TradesShell state. On tag add/remove, update only this map optimistically. The `onUpdated` callback from `MistakesPill` triggers a targeted refetch of just the tag map, not all trades.

---

## Build Order (Feature Dependencies)

Dependencies:
- Summary stats bar, filter bar, and sidebar all depend on `TradesShell` existing
- Mistakes filtering in FilterBar depends on `MistakeType` data + the API routes
- Column config changes to `TradeTable` are independent of filter work

### Phase 1: DB Migrations + API Routes (foundation, no UI yet)
1. Add migrations 023 + 024 to `lib/db.ts`
2. Create `app/api/mistakes/route.ts` (GET + POST)
3. Create `app/api/mistakes/[id]/route.ts` (PUT + DELETE)
4. Create `app/api/trades/[id]/mistakes/route.ts` (POST)
5. Create `app/api/trades/[id]/mistakes/[mid]/route.ts` (DELETE)
6. Modify `GET /api/trades` to accept `date_from`, `date_to`, `mistake_id`, `include_mistakes`
7. Add `MistakeType`, `SavedView`, `TradeFilterState` to `lib/types.ts`

### Phase 2: TradesShell Extraction (structural refactor, no new features)
1. Create `components/trades/` directory
2. Move all state and logic from `app/trades/page.tsx` into `components/trades/TradesShell.tsx`
3. `app/trades/page.tsx` becomes: `export default function TradesPage() { return <TradesShell />; }`
4. Verify existing behavior is unchanged (this is a pure refactor)

### Phase 3: Filter Bar + Saved Views (high visibility, foundational for rest)
1. Create `components/trades/FilterBar.tsx` with new `TradeFilterState` model
2. Replace the existing inline filter controls in `TradesShell` with `FilterBar`
3. Add quick filter chips (Winners, Losers, This Week, This Month)
4. Add active filter chips with individual clear buttons
5. Add mistake type dropdown to FilterBar (uses Phase 1 API)
6. Create `components/trades/SavedViewsMenu.tsx`
7. Wire saved views to `/api/settings` (load + persist)

### Phase 4: Summary Stats Bar
1. Create `components/trades/SummaryStatsBar.tsx`
2. Wire to `filteredTrades` from `TradesShell`
3. Add Recharts sparklines (AreaChart for cumulative P&L, BarChart for win rate by week)

### Phase 5: Enhanced Table + Mistakes Column
1. Add `MistakesPill` component (`components/trades/MistakesPill.tsx`)
2. Add new columns to `ALL_COLUMNS` in `TradeTable.tsx` (net_return, cost, mistakes)
3. Wire mistakes column to `mistakeTagMap` from `TradesShell`
4. Add column drag-to-reorder in the column config dropdown (DnD kit already available)
5. Confirm status/side badge visual treatment meets design intent

### Phase 6: Right Sidebar Analytics
1. Create `components/trades/TradesSidebar.tsx` with three collapsible panels
2. Add sidebar toggle to `TradesShell` layout with localStorage persistence
3. Account Performance panel: derived from `allTrades` + `activeAccount`
4. Setups P&L breakdown: group `filteredTrades` by `strategy_id`
5. Mistakes breakdown: group `filteredTrades` by mistake type via `mistakeTagMap`

**Rationale for this order:**
- Phase 1 unblocks all feature work (types + APIs exist before UI)
- Phase 2 is a safe refactor that validates the split before adding features
- Phase 3 delivers the most user-visible value early (filtering is the headline feature)
- Phases 4-6 are additive and non-blocking — they can be reordered if needed

---

## Mobile Responsive Layout

The sidebar uses a CSS grid approach that degrades gracefully:

```tsx
// On md+ screens: two-column grid
// On sm- screens: single column (sidebar hidden)
<div className="hidden md:block" /* sidebar toggle button */>
<div className={clsx(
  "grid gap-4",
  sidebarOpen ? "md:grid-cols-[1fr_280px]" : "grid-cols-1"
)}>
  <div className="min-w-0">...</div>
  <div className="hidden md:block">
    {sidebarOpen && <TradesSidebar ... />}
  </div>
</div>
```

The trade table is already horizontally scrollable (from existing implementation). The filter bar wraps via `flex-wrap`. The summary stats bar renders 1, 2, or 3 cards based on available space using `flex-wrap` or a responsive grid.

No new breakpoints needed beyond the existing Tailwind `md:` (768px) and `sm:` (640px) usage in the codebase.

---

## Scalability Considerations

| Concern | At ~500 trades | At ~5K trades |
|---------|---------------|---------------|
| Client-side filter | Instant (< 1ms) | Still fast (< 10ms) |
| Mistake tag map join | Negligible (< 500 entries) | Acceptable (< 5K entries) |
| Sidebar analytics derivation | Instant useMemo | < 50ms — add `useMemo` with deps |
| Sparkline data derivation | Instant (group by date) | Instant (SQLite date grouping if needed) |
| `mistake_types` JSON | N/A — stored in DB table | N/A |
| Saved views JSON | < 50 views = < 10KB | Same — no growth concern |

Server-side date filtering is the only optimization worth adding proactively. At 5K+ trades with a date range filter, loading all trades then filtering client-side is still fast (< 100ms), but the network payload grows. The `date_from`/`date_to` params on the API handle this.

---

## Sources

- Codebase: `app/trades/page.tsx` (read in full, 589 lines)
- Codebase: `app/api/trades/route.ts` (read in full, 149 lines)
- Codebase: `components/TradeTable.tsx` (read lines 1-80)
- Codebase: `lib/db.ts` (read in full through migration 022)
- Codebase: `lib/types.ts` (read in full)
- Codebase: `app/api/settings/route.ts` (read in full)
- Codebase: `.planning/PROJECT.md` (read in full — v3.0 feature list)
- Confidence: HIGH — all integration patterns derived directly from existing codebase
