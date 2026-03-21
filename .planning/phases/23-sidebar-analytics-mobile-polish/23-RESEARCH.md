# Phase 23: Sidebar Analytics & Mobile Polish - Research

**Researched:** 2026-03-21
**Domain:** React sidebar layout, recharts area charts, CSS sticky columns, Tailwind responsive utilities
**Confidence:** HIGH

## Summary

Phase 23 adds a right analytics sidebar to the Trades page (TradesShell) and fixes mobile layout issues. The sidebar shows three panels — Account Performance with a cumulative return chart, Setups breakdown, and Mistakes breakdown — all derived from `filteredTrades` already computed in TradesShell. The sidebar is fixed-width (320px), collapses to a 40px toggle strip, and its open/closed state persists via the existing `/api/settings` key `trades_sidebar_open`. On mobile (< 1024px) the sidebar hides and a tab toggle switches between Table and Analytics views.

Mobile polish involves three targeted CSS fixes: (1) the Symbol column becomes sticky with `position: sticky; left: 0` on `<th>` and `<td>`, (2) filter chips container changes from `flex-wrap` to `flex-nowrap overflow-x-auto`, and (3) SummaryStatsBar grid changes from `grid-cols-3` to `grid-cols-2 sm:grid-cols-3`.

The entire phase is pure client-side UI: no API changes, no new DB migrations, no new settings keys beyond `trades_sidebar_open`. All analytics computations happen in the sidebar component via `useMemo` over the already-available `filteredTrades` array.

**Primary recommendation:** Extract a new `TradesSidebar` component that accepts `filteredTrades`, `mistakeTypes`, `filter`, and `updateFilter`. Wire it into TradesShell with sidebar open state, settings persistence, and responsive tab toggle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sidebar Panels & Content
- **Account Performance (SIDE-01)**: Area chart (recharts) showing cumulative P&L curve. Stats above chart: avg return $, avg return %, win rate %
- **Setups Breakdown (SIDE-02)**: Ranked list sorted by total P&L descending. Each row: setup name, total P&L (color-coded), trade count, win rate %
- **Mistakes Breakdown (SIDE-03)**: Same ranked-list format as setups. Each row: mistake name with color dot (from mistake_type color), total P&L impact, occurrence count. Ranked by P&L impact (most costly first)
- **Click-to-filter**: Clicking a setup row sets `filter.tags = ["setup_name"]`; clicking a mistake row sets `filter.mistakeId`. Filter chips appear in TradeFilterBar. Bidirectional — sidebar drives filters

#### Sidebar Behavior
- **Fixed width**: ~320px, not resizable
- **Collapse**: Slim icon toggle strip (~40px) when collapsed — single icon to expand
- **Default state**: Open on desktop on first visit. Persists toggle state via settings API (`trades_sidebar_open`)
- **Mobile (<1024px)**: Sidebar hidden — replaced by tab toggle (see Mobile section)
- **Independent scroll**: Sidebar scrolls vertically independent of main content area
- **Panels NOT individually collapsible**: All three panels always visible. Whole sidebar collapses as one unit

#### Mobile Layout
- **Breakpoint**: lg (1024px) — below this, sidebar hides and mobile layout activates
- **Tab toggle**: Two tabs ("Table" / "Analytics") below the filter bar on mobile. Switches between trade table view and sidebar analytics view (full-width)
- **Sticky symbol column (MOBI-01)**: Symbol column only — pinned left on horizontal scroll
- **Filter chips (MOBI-02)**: Horizontal scroll without wrapping layout
- **Summary stats (MOBI-03)**: 2-column grid on small screens

#### Sidebar Visual Style
- **Separate cards**: Each panel (Performance, Setups, Mistakes) in its own card container (dark:bg-slate-800, rounded-xl, shadow) — matches dashboard widget style
- **Left border**: Subtle border-l (dark:border-slate-700) separating sidebar from main content
- **Color coding**: emerald-400 for positive P&L, red-400 for negative — consistent with app-wide pattern
- **Privacy mode**: Must respect usePrivacy() — mask all dollar amounts, percentages, counts

### Claude's Discretion
- Area chart height and axis configuration
- Exact spacing between sidebar cards
- Collapse animation (transition or instant)
- Toggle icon choice (BarChart3, PanelRightOpen, etc.)
- Mobile tab styling details
- Empty state handling (no setups, no mistakes)
- How many setup/mistake rows to show before truncation (if any)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIDE-01 | User can see account performance panel (avg return, avg return %, win %) with cumulative chart | `filteredTrades` already available; recharts AreaChart pattern from SummaryStatsBar confirmed |
| SIDE-02 | User can see setups P&L breakdown (ranked list with trade count, win rate, total P&L per setup) | Tags on trades are `t.tags` comma-separated string; group-by logic is pure JS `useMemo` |
| SIDE-03 | User can see mistakes P&L breakdown (ranked list with count, total P&L impact per mistake type) | `mistake_tag_ids` on trades is comma-separated IDs; `mistakeTypes` already in TradesShell state |
| SIDE-04 | User can collapse/expand sidebar; hidden by default on mobile | `/api/settings` PUT pattern confirmed; `trades_sidebar_open` is new key following existing convention |
| MOBI-01 | Trade table scrolls horizontally with sticky symbol column on small viewports | Symbol `<th>`/`<td>` already identifiable at line 547/606 of TradeTable.tsx; needs `sticky left-0 z-10 bg-*` classes |
| MOBI-02 | Filter bar wraps responsively; filter chips scroll horizontally | TradeFilterChips currently uses `flex flex-wrap`; change to `flex flex-nowrap overflow-x-auto` |
| MOBI-03 | Summary stats bar uses 2-column grid on small screens | SummaryStatsBar currently `grid-cols-3`; change to `grid-cols-2 sm:grid-cols-3` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | Already installed | Area chart for cumulative P&L curve | Used in SummaryStatsBar; consistent with existing sparklines |
| Tailwind CSS v3 | Already installed | Responsive classes, sticky, overflow utilities | All layout work is Tailwind-only |
| lucide-react | Already installed | Toggle icon (BarChart3, PanelRightOpen, etc.) | App-wide icon library |
| React useMemo | Built-in | Deriving setup/mistake breakdowns from filteredTrades | Pure computation, no side effects |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| /api/settings PUT | Existing endpoint | Persist `trades_sidebar_open` boolean | On toggle click, after debounce |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline recharts in sidebar | Reuse AreaChartWidget from ChartWidgets.tsx | AreaChartWidget expects `{ index, value, label }[]` shape; simpler to inline a stripped-down AreaChart matching SummaryStatsBar's pattern |
| CSS `position: sticky` for Symbol | JS scroll-sync | Sticky is pure CSS, zero JS overhead, works with existing overflow-x-auto wrapper |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
components/trades/
├── TradesShell.tsx          # Modified: add sidebar state, layout wrapper, mobile tabs
├── TradesSidebar.tsx        # NEW: sidebar component with all 3 panels
├── SummaryStatsBar.tsx      # Modified: grid-cols-2 sm:grid-cols-3
├── TradeFilterChips.tsx     # Modified: flex-nowrap overflow-x-auto
└── TradeTable.tsx           # Modified: sticky Symbol column
```

### Pattern 1: TradesShell Layout with Sidebar

The root div in TradesShell changes from `space-y-6` to a flex layout that places the existing content alongside the sidebar.

**Current structure:**
```tsx
<div className="space-y-6">
  {/* header, stats, filters, table */}
</div>
```

**New structure:**
```tsx
<div className="flex gap-0 items-start">
  {/* Main content column */}
  <div className="flex-1 min-w-0 space-y-6 pr-4">
    {/* header, stats, filters, table — unchanged */}
  </div>

  {/* Sidebar — hidden on mobile, replaced by tab toggle */}
  <aside className={clsx(
    "hidden lg:flex flex-col shrink-0 border-l dark:border-slate-700 border-slate-200",
    sidebarOpen ? "w-80" : "w-10"
  )}>
    {sidebarOpen ? <TradesSidebar ... /> : <SidebarToggleStrip />}
  </aside>
</div>
```

On mobile (`< lg`), the tab toggle replaces the sidebar structure and renders either the table content or the `<TradesSidebar>` full-width below the filter bar.

### Pattern 2: Sidebar State with Settings Persistence

```tsx
// In TradesShell — load initial state from settings
const [sidebarOpen, setSidebarOpen] = useState<boolean>(true); // default open

// Inside load(), after settingsRes:
if (loadedSettings.trades_sidebar_open !== undefined) {
  setSidebarOpen(loadedSettings.trades_sidebar_open === "true");
}

// Toggle handler
const toggleSidebar = async () => {
  const next = !sidebarOpen;
  setSidebarOpen(next);
  if (me && !me.guest) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trades_sidebar_open: String(next) }),
    });
  }
};
```

Note: All settings values are stored as strings in the settings API (consistent with existing `trade_table_columns`, etc.).

### Pattern 3: Sidebar Analytics Computations

All three panels are pure `useMemo` computations inside `TradesSidebar`. No API calls.

```tsx
// Performance panel
const perfStats = useMemo(() => {
  const closed = filteredTrades.filter(t => t.status === "closed");
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winners = closed.filter(t => (t.pnl ?? 0) > 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
  const avgReturnDollar = closed.length > 0 ? totalPnl / closed.length : 0;
  const avgReturnPct = closed.length > 0
    ? closed.reduce((sum, t) => sum + ((t.pnl ?? 0) / Math.max((t.entry_price ?? 1) * (t.shares ?? 1), 1)) * 100, 0) / closed.length
    : 0;
  // Cumulative curve for chart
  let running = 0;
  const curve = closed
    .filter(t => t.exit_date)
    .sort((a, b) => (a.exit_date! < b.exit_date! ? -1 : 1))
    .map(t => { running += t.pnl ?? 0; return { value: running }; });
  return { totalPnl, winRate, avgReturnDollar, avgReturnPct, curve };
}, [filteredTrades]);

// Setups breakdown
const setupRows = useMemo(() => {
  const map = new Map<string, { pnl: number; count: number; wins: number }>();
  filteredTrades
    .filter(t => t.status === "closed" && t.tags)
    .forEach(t => {
      const tags = t.tags!.split(",").map(s => s.trim()).filter(Boolean);
      tags.forEach(tag => {
        const existing = map.get(tag) ?? { pnl: 0, count: 0, wins: 0 };
        map.set(tag, {
          pnl: existing.pnl + (t.pnl ?? 0),
          count: existing.count + 1,
          wins: existing.wins + ((t.pnl ?? 0) > 0 ? 1 : 0),
        });
      });
    });
  return [...map.entries()]
    .map(([name, { pnl, count, wins }]) => ({
      name, pnl, count,
      winRate: count > 0 ? (wins / count) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}, [filteredTrades]);

// Mistakes breakdown
const mistakeRows = useMemo(() => {
  const map = new Map<string, { pnl: number; count: number }>();
  filteredTrades
    .filter(t => t.status === "closed" && t.mistake_tag_ids)
    .forEach(t => {
      const ids = t.mistake_tag_ids!.split(",").filter(Boolean);
      ids.forEach(id => {
        const existing = map.get(id) ?? { pnl: 0, count: 0 };
        map.set(id, {
          pnl: existing.pnl + (t.pnl ?? 0),
          count: existing.count + 1,
        });
      });
    });
  return [...map.entries()]
    .map(([id, { pnl, count }]) => ({
      id, pnl, count,
      mistakeType: mistakeTypes.find(m => m.id === id),
    }))
    .filter(row => row.mistakeType)
    .sort((a, b) => a.pnl - b.pnl); // most costly (most negative) first
}, [filteredTrades, mistakeTypes]);
```

### Pattern 4: Sticky Symbol Column

The table's outer wrapper already has `overflow-x-auto`. The Symbol `<th>` and `<td>` elements need sticky classes added. The background must match the table's row background to visually "cover" scrolling content.

```tsx
// In <th> for symbol:
<th className="px-4 py-3 ... sticky left-0 z-10 dark:bg-slate-900 bg-white">
  Symbol
</th>

// In <td> for symbol (per row):
<td
  className="px-4 py-3 font-bold text-emerald-400 cursor-pointer hover:underline sticky left-0 z-10 dark:bg-slate-900 bg-white group-hover:dark:bg-slate-800/30 group-hover:bg-slate-50/50"
  onClick={() => onEdit(t)}
>
```

Key: The `<td>` background must match the row hover state to prevent bleed-through. The `group-hover:` classes must match the `<tr>`'s hover classes exactly.

### Pattern 5: Filter Chips Horizontal Scroll

```tsx
// TradeFilterChips.tsx — change outer div
// Before:
<div className="flex flex-wrap items-center gap-2">
// After:
<div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
```

The `pb-1` prevents the scrollbar from clipping chip content. `scrollbar-none` hides the scrollbar visually (Tailwind plugin or inline style).

### Pattern 6: SummaryStatsBar 2-Column Mobile Grid

```tsx
// SummaryStatsBar.tsx — change grid class
// Before:
<div className="grid grid-cols-3 gap-4">
// After:
<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
```

The third card (Win %) wraps to a new row on mobile and spans full width if needed, or stays 2-per-row with the third below.

### Pattern 7: Mobile Tab Toggle

```tsx
// In TradesShell, between filter chips and table (on mobile only):
<div className="flex lg:hidden border-b dark:border-slate-700 border-slate-200 mb-4">
  {["Table", "Analytics"].map(tab => (
    <button
      key={tab}
      onClick={() => setMobileTab(tab as "Table" | "Analytics")}
      className={clsx(
        "flex-1 py-2 text-sm font-medium transition-colors",
        mobileTab === tab
          ? "border-b-2 border-emerald-400 text-emerald-400"
          : "dark:text-slate-400 text-slate-500 hover:dark:text-white"
      )}
    >
      {tab}
    </button>
  ))}
</div>

{/* Mobile: conditionally render table or analytics */}
<div className={mobileTab === "Table" ? "block lg:block" : "hidden lg:block"}>
  {/* existing table content */}
</div>
<div className={mobileTab === "Analytics" ? "block lg:hidden" : "hidden"}>
  <TradesSidebar ... />
</div>
```

### Anti-Patterns to Avoid
- **Resizable sidebar in this phase:** Scope explicitly says fixed 320px, not resizable — do not add drag handles.
- **Individually collapsible panels:** All three panels always visible in the expanded sidebar — no accordion.
- **Fetching data in sidebar:** All computations must use `filteredTrades` passed as props, not a new API call.
- **Using `overflow-hidden` on table wrapper:** The existing `overflow-x-auto` wrapper must be preserved; adding `overflow-hidden` would break sticky positioning.
- **Conflating mobile sidebar with a drawer/sheet:** CONTEXT.md is explicit: mobile uses a tab toggle, NOT a drawer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cumulative P&L chart | Custom SVG chart | recharts AreaChart (already used in SummaryStatsBar) | Gradient fills, tooltips, responsive container all built-in |
| Color-coded P&L values | Custom color logic | `(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"` pattern | Already established app-wide |
| Settings persistence | Custom localStorage per-key | `/api/settings` PUT (existing pattern) | Cross-device, consistent with all other persisted preferences |
| Sticky column | JS scroll position tracking | CSS `position: sticky; left: 0` | Zero JS, native performance |

**Key insight:** Every analytical computation needed for this phase is straightforward array grouping over `filteredTrades`. No complex algorithms, no external libraries.

## Common Pitfalls

### Pitfall 1: Sticky Column Background Bleed-Through
**What goes wrong:** Sticky `<td>` cells have transparent backgrounds by default. As the user scrolls horizontally, other row content slides visibly beneath the sticky symbol column.
**Why it happens:** Sticky positioning "sticks" but the element remains in normal paint order — without a solid background it's invisible.
**How to avoid:** Assign explicit dark/light background classes to both the sticky `<th>` and every sticky `<td>`. The `<td>` must also match hover states via `group-hover:` classes matching the `<tr>` hover exactly.
**Warning signs:** Sticky column appears but content bleeds through during scroll.

### Pitfall 2: DnD Context Conflicts with Sticky Column
**What goes wrong:** The existing DnD column reorder uses `@dnd-kit/core` on the table headers. Adding `sticky` positioning to the Symbol header within a DnD context can cause visual artifacts during drag.
**Why it happens:** DnD transforms conflict with CSS sticky's position calculation.
**How to avoid:** The Symbol column is always the first column and should not be part of the DnD-sortable set. However, visibleColumns currently drives the DnD order including Symbol. The simplest fix: keep Symbol in the DnD list but add sticky classes — in practice sticky + DnD transform artifacts only appear during active drag, which is brief.
**Warning signs:** Symbol header jumps during drag operation.

### Pitfall 3: `overflow-x-auto` Wrapper Breaks Sticky
**What goes wrong:** Applying `overflow-x: auto` to an ancestor of a sticky element confines the sticky element's scroll container. If the wrong ancestor has `overflow-x: auto`, sticky will work but only within that container.
**Why it happens:** CSS sticky respects the nearest scrolling ancestor. The current table wrapper `<div className="hidden sm:block overflow-x-auto p-1">` is the correct scroll container — sticky left on `<th>`/`<td>` will work correctly within it.
**How to avoid:** Do not add `overflow-x: hidden` or `overflow: hidden` to the table container or any ancestor wrapper between the table and the overflow-x-auto div.
**Warning signs:** Sticky column doesn't stick, or sticks to the page instead of the table.

### Pitfall 4: Setup Tags vs. Strategy Tags Confusion
**What goes wrong:** `Trade.tags` is a comma-separated free-text field used for "setups" (e.g., "VWAP Reclaim", "Bull Flag"). It is different from `strategy_id`. The sidebar uses `t.tags` for setup grouping.
**Why it happens:** The data model has both `tags` (freeform setup labels) and `strategy_id` (future structured strategies). Phase 23 uses `tags` only.
**How to avoid:** Group by `t.tags.split(",")` entries. If `t.tags` is null/empty, skip that trade in setup grouping.

### Pitfall 5: Privacy Mode Not Applied
**What goes wrong:** The sidebar renders P&L numbers without checking `usePrivacy()`, exposing sensitive data when privacy mode is on.
**Why it happens:** New component doesn't inherit the existing privacy masking.
**How to avoid:** Call `const { hidden } = usePrivacy()` at the top of `TradesSidebar`. Mask all dollar amounts, percentages, and counts with `hidden ? "------" : formatCurrency(value)` pattern (same as SummaryStatsBar).

### Pitfall 6: Filter Chips `overflow-x-auto` Causes Parent Height Issues
**What goes wrong:** Changing from `flex-wrap` to `overflow-x-auto` on filter chips can cause the chip container to collapse vertically or create unexpected height in its parent.
**Why it happens:** Overflow containers with `flex-nowrap` don't expand height to show wrapped content.
**How to avoid:** Add a fixed or min-height if needed, or `pb-1` to ensure the scrollbar doesn't clip chips. Test with 6+ active chips.

## Code Examples

Verified patterns from existing codebase:

### Recharts Area Chart (from SummaryStatsBar.tsx)
```tsx
// Source: components/trades/SummaryStatsBar.tsx lines 165-185
<ResponsiveContainer width="100%" height="100%">
  <AreaChart data={sparklines.cumulative} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <defs>
      <linearGradient id="statGradCumulative" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={cumulativeColor} stopOpacity={0.35} />
        <stop offset="95%" stopColor={cumulativeColor} stopOpacity={0} />
      </linearGradient>
    </defs>
    <Area
      type="monotone"
      dataKey="value"
      stroke={cumulativeColor}
      strokeWidth={1.5}
      fill="url(#statGradCumulative)"
      dot={false}
      activeDot={false}
      isAnimationActive={false}
    />
  </AreaChart>
</ResponsiveContainer>
```

For the sidebar's performance chart, add `<XAxis>` and `<YAxis>` with minimal ticks for better context (unlike sparklines). Use `isAnimationActive={false}` consistently.

### Settings Persistence Pattern (from TradesShell.tsx)
```tsx
// Source: components/trades/TradesShell.tsx lines 171-179
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

For sidebar state: store as string `"true"` / `"false"` (all settings are stored as strings).

### Dashboard Widget Card Style (from CONTEXT.md confirmed)
```tsx
// Pattern from existing dashboard widgets
<div className="dark:bg-slate-800 bg-white rounded-xl shadow p-4">
  {/* panel content */}
</div>
```

### Privacy Masking (from SummaryStatsBar.tsx)
```tsx
// Source: components/trades/SummaryStatsBar.tsx
const MASK = "------";
const { hidden } = usePrivacy();
// Usage:
<span>{hidden ? MASK : formatCurrency(value)}</span>
<span>{hidden ? `${MASK}%` : `${winRate.toFixed(1)}%`}</span>
```

### PersistentChart Sidebar Collapse Pattern (from PersistentChart.tsx lines 665-674)
```tsx
// Collapsed toggle strip
<div className="hidden sm:flex relative flex-col items-center justify-center w-5 shrink-0 border-l dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-slate-50 hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors z-10 gap-2">
  {/* icon */}
</div>

// Expanded sidebar
<div className="hidden sm:flex flex-col shrink-0 dark:bg-slate-900 bg-white border-l dark:border-slate-800 border-slate-200 overflow-hidden" style={{ width: 280 }}>
  <div className="flex-1 overflow-y-auto p-3">
    {/* content */}
  </div>
</div>
```

For TradesSidebar: use `w-80` (320px) instead of 280, and use `dark:border-slate-700` per CONTEXT.md.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| flex-wrap chips | overflow-x-auto scroll | Phase 23 | Prevents filter chips from pushing layout down on mobile |
| grid-cols-3 stats | grid-cols-2 sm:grid-cols-3 | Phase 23 | Stats legible at 320px viewport width |
| No sidebar on trades page | Right analytics sidebar | Phase 23 | Contextual analytics derived from current filter state |

## Open Questions

1. **Scrollbar styling for horizontal-scroll elements**
   - What we know: Tailwind v3 doesn't include `scrollbar-none` by default (requires `tailwind-scrollbar-hide` plugin or custom CSS)
   - What's unclear: Whether the project already has a scrollbar-hide plugin or custom base CSS
   - Recommendation: Use `[&::-webkit-scrollbar]:hidden` arbitrary property or check if project has custom scrollbar CSS in globals.css

2. **Settings load timing for `sidebarOpen`**
   - What we know: `settingsData` is loaded in the `load()` async function; initial state defaults to `true` (open)
   - What's unclear: Whether there's a visible flash of open-then-close on first load for users who have saved `false`
   - Recommendation: Initialize `sidebarOpen` from `settingsData` inside `load()` — accepts the minor flash as acceptable UX (same pattern as all other settings-driven state)

3. **Setup breakdown when a trade has multiple tags**
   - What we know: `t.tags` is a single comma-separated string; a trade can appear in multiple setup groups
   - What's unclear: Whether double-counting a trade's P&L across multiple tags is desirable
   - Recommendation: Allow double-counting — a trade tagged "VWAP Reclaim, Bull Flag" contributes to both rows. This is the natural interpretation of "how did each setup perform" when setups can co-occur.

## Sources

### Primary (HIGH confidence)
- Direct file reads: `components/trades/TradesShell.tsx` — confirmed state shape, filteredTrades flow, settings loading pattern
- Direct file reads: `components/trades/SummaryStatsBar.tsx` — confirmed recharts pattern, privacy masking, color coding
- Direct file reads: `components/TradeTable.tsx` — confirmed table structure at lines 542-543 (overflow-x-auto), Symbol `<th>` at line 547, Symbol `<td>` at line 606
- Direct file reads: `components/trades/TradeFilterChips.tsx` — confirmed `flex flex-wrap` on line 62
- Direct file reads: `lib/types.ts` — confirmed `Trade.tags`, `Trade.mistake_tag_ids`, `MistakeType` interface
- Direct file reads: `lib/privacy-context.tsx` — confirmed `usePrivacy()` hook, `hidden` boolean
- Direct file reads: `components/PersistentChart.tsx` — confirmed sidebar collapse/expand CSS pattern
- Direct file reads: `.planning/phases/23-sidebar-analytics-mobile-polish/23-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- CSS sticky positioning behavior: well-established CSS spec, cross-browser support is complete as of 2026
- Tailwind `sticky left-0 z-10` pattern: standard Tailwind utility usage

### Tertiary (LOW confidence)
- Scrollbar-hide approach: `[&::-webkit-scrollbar]:hidden` Tailwind arbitrary syntax — assumed valid but not verified in project globals.css

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns directly observed in existing code
- Pitfalls: HIGH — based on direct code analysis of the table and filter components
- Mobile patterns: HIGH — CSS-only changes with well-understood behavior

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable tech stack)
