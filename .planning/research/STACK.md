# Technology Stack — v3.0 Trades Page Overhaul

**Project:** Ledger Of Alpha v3.0 — Advanced Filters, Saved Views, Mistakes System, Sidebar Analytics
**Researched:** 2026-03-21
**Scope:** NEW capabilities only. Existing validated stack (Next.js 15, TypeScript, Tailwind CSS v3, better-sqlite3, recharts, lightweight-charts, @dnd-kit, next-themes, lucide-react, nodemailer, jose JWT, Gemini 2.5 Flash, clsx, simple-statistics) is unchanged.

---

## Executive Finding

**One optional new package. Everything else is buildable from existing dependencies.**

The only feature that benefits from a new dependency is the date range calendar picker (a proper two-month calendar UI with range highlighting). Every other new feature — multi-select dropdowns, filter chips, sparklines, column config/reordering, mistakes tagging, sidebar analytics, mobile responsive layout — is fully achievable with the existing stack.

The single candidate (`react-day-picker`) is optional: a custom `<input type="date">` two-field fallback works and adds zero bundle. Add `react-day-picker` only if the UX priority for the calendar picker is HIGH and the team wants the polished two-month range UI.

---

## Feature-by-Feature Analysis

### 1. Sparklines in Summary Stats Bar

**Problem:** The new summary stats bar (Cumulative Return, P/L Ratio, Win %) needs small inline trend charts ~80×32px with no axes, no grid, no tooltip — pure visual trend signal.

**Solution: Recharts `<LineChart>` stripped to zero decorations**

Recharts (already installed, v2.15.0) composes via explicit child components. A sparkline is a `<LineChart>` with every optional child omitted and explicit `margin={{ top: 0, right: 0, bottom: 0, left: 0 }}`. Setting `width` and `height` as props gives fixed pixel dimensions. `<XAxis hide />` and `<YAxis hide />` suppress all axis rendering without removing domain calculation. No `<CartesianGrid>`, no `<Tooltip>`, no `<Legend>`.

```tsx
// Sparkline — zero new dependencies
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

function Sparkline({ data }: { data: number[] }) {
  const points = data.map((v, i) => ({ i, v }));
  const color = (data.at(-1) ?? 0) >= (data[0] ?? 0) ? "#34d399" : "#f87171";
  return (
    <LineChart width={80} height={32} data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <XAxis dataKey="i" hide />
      <YAxis hide domain={["auto", "auto"]} />
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
    </LineChart>
  );
}
```

This is the exact pattern used by Chakra UI's sparkline component (which is built on Recharts). The existing `DashboardShell.tsx` already uses Recharts for area and bar charts — this adds no new concepts.

**Libraries needed:** None.

**Confidence:** HIGH — Recharts component composition is well-documented. `hide` prop on XAxis/YAxis is the established suppression pattern (official Recharts API docs).

---

### 2. Multi-Select Filter Dropdowns

**Problem:** Filters for Symbol, Setup, Side, Mistake type, Status, Account need multi-select dropdowns — checkboxes in a dropdown panel, "3 selected" badge display, clear individual or all.

**Solution: Custom controlled dropdown — same pattern as existing column picker**

The trades page already has `showColumnMenu` dropdown built with `useRef` + click-outside handler + absolute positioned `<div>`. The new multi-select filters are the same pattern extended with checkbox lists and a selection count badge.

Key implementation points:
- One `FilterDropdown` component: takes `label`, `options: string[]`, `selected: Set<string>`, `onChange`
- Uses `clsx` (already installed) for selected item highlight
- Click-outside via `useRef` + `mousedown` listener (identical to `columnMenuRef` in existing code)
- "X selected" counter badge using Tailwind `bg-indigo-500/20 text-indigo-400` pill

No library adds value here — the existing codebase already has this pattern. Adding `react-select` or `downshift` for 4-checkbox dropdowns would be massive overkill (react-select alone is ~28 kB gzipped).

**Libraries needed:** None.

**Confidence:** HIGH — identical pattern already working in trades page column picker and dashboard time filter.

---

### 3. Date Range Picker

**Problem:** The date filter needs "From" and "To" date selection with a calendar UI — ideally a two-month range picker with highlight between selected dates.

**Option A (Recommended — zero dependencies): Native `<input type="date">` pair**

Two `<input type="date">` fields styled with Tailwind. Supported in all modern browsers. Works on mobile natively (system date picker). No library, no bundle impact. UI looks fine within a filter panel context where the filter is already opened in a dropdown.

```tsx
<input
  type="date"
  value={from}
  onChange={e => setFrom(e.target.value)}
  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
/>
```

**Option B (If polished calendar UX is required): `react-day-picker` v9**

`react-day-picker` v9.14.0 is a well-maintained, accessibility-compliant date picker. It includes `date-fns` as a bundled dependency (not peer dep as of v9). Bundle impact: ~13 kB gzipped for react-day-picker itself + ~13 kB for date-fns (if not already in bundle). Styles via CSS variables, easily themed to dark mode with Tailwind `[&_.rdp-day_selected]:bg-indigo-500` class overrides.

The app does NOT currently have `date-fns` in the dependency tree. Adding `react-day-picker` brings `date-fns` as a transitive dep — not a blocker, but adds ~13 kB to the bundle.

**Decision:** Start with Option A (native inputs). Upgrade to Option B only if trader feedback specifically identifies the calendar UX as friction. The trades page filter panel is a functional tool, not a showcase — native date inputs are appropriate.

**Libraries needed:** None for Option A. `react-day-picker@9` for Option B.

**Confidence:** HIGH for Option A. MEDIUM for Option B bundle size (could not directly verify via Bundlephobia; estimate based on package analysis search results).

---

### 4. Filter Chips (Active Filter Display)

**Problem:** Show active filters as dismissible chips below the filter bar, e.g. "Symbol: AAPL ×", "Side: Long ×", "Clear all".

**Solution: Pure Tailwind + React state**

Filter chips are stateless display components — render a list of active filter entries, each with a label and an `×` button that calls `removeFilter(key, value)`. No library needed. The dashboard already has time filter "chips" (the 30/60/90/All buttons) as a direct precedent.

```tsx
{activeFilters.map(f => (
  <span key={f.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
    {f.label}
    <button onClick={() => removeFilter(f)} className="hover:text-white">×</button>
  </span>
))}
```

**Libraries needed:** None.

**Confidence:** HIGH — trivial React + Tailwind pattern.

---

### 5. Saved Named Filter Views

**Problem:** Users want to save a current filter configuration (all active filters combined) as a named preset, then load/delete saved views.

**Solution: Extend `settings` key pattern — `trade_filter_views` JSON array**

Follow the exact pattern established for `dashboard_layout_presets` in v2.1. Store in a new settings key `trade_filter_views`:

```json
[
  { "id": "uuid", "name": "Winners Only", "filters": { "status": ["closed"], "pnl_sign": "positive" } },
  { "id": "uuid", "name": "TSLA Trades", "filters": { "symbols": ["TSLA"] } }
]
```

Save: POST to `/api/settings` with `trade_filter_views` key.
Load: GET `/api/settings`, parse key, apply filters.
Delete: filter array, POST again.

IDs via `crypto.randomUUID()` (already used in dashboard presets).

**Libraries needed:** None. Uses existing `/api/settings` endpoint.

**DB migrations needed:** None. Settings table already stores arbitrary JSON keys.

**Confidence:** HIGH — identical to `dashboard_layout_presets` pattern shipped in v2.1.

---

### 6. Column Configuration & Reordering

**Problem:** Enhanced trade table needs user-configurable column visibility and order, persisted across sessions.

**Solution: @dnd-kit/sortable (already installed) + settings persistence**

The trades page already has `visibleColumns` state and a `showColumnMenu` dropdown for toggling columns. Extension plan:

1. **Reordering:** Wrap column list in `DndContext` + `SortableContext` from `@dnd-kit` (already installed for dashboard widget drag). Each column item is a `useSortable` item. Drag handle icon (Lucide `GripVertical`).
2. **Persistence:** Save `{ visible: ColumnKey[], order: ColumnKey[] }` to a new `trade_column_config` settings key via `/api/settings`.
3. **Apply order:** Sort `ALL_COLUMNS` by the saved order array before rendering table headers.

This is structurally identical to how `DashboardShell.tsx` handles widget reorder via `@dnd-kit` — the pattern is already proven in this codebase.

**Libraries needed:** None (already have `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).

**Confidence:** HIGH — same library, same pattern, already working in dashboard.

---

### 7. Mistakes Tagging System (User-Defined Types)

**Problem:** The current `mistakes` column on trades is a free-text comma-separated string (set in v1.0 DB migration 013). The v3.0 goal is a structured user-defined mistake taxonomy with per-trade tagging and breakdown analytics.

**Current state:** `trades.mistakes TEXT` exists. `demo-data.ts` shows the expected format: `"Entered too early"` (comma-separated labels). The `insight-engine.ts` already parses via `.split(",")`.

**Solution: New `mistake_types` settings key + migrate trade storage to JSON array**

Two-part approach that avoids a new DB table:

**Part A — Mistake type registry:** Store user-defined mistake types in a new settings key `mistake_types`:
```json
["Entered too early", "Exited too early", "Moved stop loss", "Oversized position", "FOMO entry"]
```
The `demo-data.ts` already seeds `default_mistakes` as a JSON string — this becomes the canonical format.

**Part B — Per-trade mistake tags:** Change `trade.mistakes` storage format from comma-string to JSON array string: `'["Entered too early","Moved stop loss"]'`. This is backward-compatible (the insight-engine's `.split(",")` can be replaced with `JSON.parse()` with a try/catch fallback for old comma-strings).

**DB migration:** No schema change needed (column already exists). A data migration (migration 023) can normalize existing comma-strings to JSON arrays during startup.

**UI:** The mistake filter dropdown (see Feature 2) lists all `mistake_types`. Per-trade tagging in `TradeModal.tsx` uses a multi-select chip input pulling from `mistake_types`. Right sidebar shows mistakes P&L breakdown computed client-side from filtered trades.

**Libraries needed:** None.

**Confidence:** HIGH — builds on existing column and settings patterns. LOW confidence on backward-compat migration for existing user data (depends on actual stored format diversity — needs testing).

---

### 8. Right Sidebar Analytics

**Problem:** A collapsible right sidebar showing Account Performance summary, Setups P&L breakdown (bar), and Mistakes P&L breakdown (bar) — all scoped to current filtered trades.

**Solution: Recharts `<BarChart>` (already installed) + collapsible panel**

All three panels are pure computation over the already-loaded `filteredTrades` array — no new API calls needed. The sidebar uses the same pattern as `PersistentChart.tsx` sidebar (resizable panel with stored width).

- Account Performance: Derived stats (win rate, avg R:R, expectancy) displayed as stat rows
- Setups P&L: Group filtered trades by `strategy_id`, sum P&L per group → Recharts horizontal `<BarChart>`
- Mistakes P&L: Parse `mistakes` JSON array, group by mistake type, sum P&L → Recharts horizontal `<BarChart>`

Width persistence: `panel_sidebar_width` settings key (following `watchlist_width` / `panel_width` pattern from chart page).

**Libraries needed:** None.

**Confidence:** HIGH — all computation is client-side over existing trade data. Recharts horizontal bar charts are already used in `SymbolPnlWidget.tsx` — copy that pattern.

---

### 9. Mobile-Responsive Layout

**Problem:** The trades page is data-dense (table with 10+ columns, filter bar, sidebar). Mobile (< 640px) needs a usable layout.

**Solution: Tailwind responsive modifiers + card view fallback**

Two-tier approach:
1. **Tablet (640-1024px):** Horizontal scroll on the table (`overflow-x-auto` wrapper), hide the right sidebar (toggle button), filter bar wraps to two rows.
2. **Mobile (< 640px):** Table switches to card layout. Each trade row becomes a vertical card showing only key fields (Symbol, Side, P&L, Date). Hide right sidebar entirely. Filter bar collapses behind a `<Filter>` icon button (already exists in the toolbar).

Implementation:
```tsx
{/* Desktop table */}
<div className="hidden sm:block overflow-x-auto">
  <TradeTable ... />
</div>
{/* Mobile cards */}
<div className="sm:hidden space-y-2">
  {filteredTrades.map(t => <TradeMobileCard key={t.id} trade={t} />)}
</div>
```

No library needed. Tailwind's `sm:`, `md:`, `lg:` breakpoints handle all cases.

**Libraries needed:** None.

**Confidence:** HIGH — standard Tailwind responsive pattern. Card view is the industry-standard pattern for dense data on mobile (confirmed by multiple community sources).

---

## Complete New Dependencies

**Recommended addition: None.**

```bash
# No npm install needed for v3.0 base implementation
```

**Optional addition if polished date range calendar is later prioritized:**
```bash
npm install react-day-picker@9
```
This brings `date-fns` as a transitive dependency (~13 kB additional gzipped bundle).

---

## Database Migrations Required

| Migration | Table | Change | Purpose |
|-----------|-------|--------|---------|
| 023 | `trades` | Data migration: normalize `mistakes` TEXT from comma-string to JSON array | Structured mistake parsing; backward-compat via try/catch |
| — | `settings` | No schema change — new keys via data | `trade_filter_views`, `mistake_types`, `trade_column_config` |

Both are additive. No schema changes. Pattern follows established inline migrations in `lib/db.ts`.

**Note on migration 023:** The `mistakes` column already exists (migration 013). This is a **data normalization** migration, not a schema change. It runs `UPDATE trades SET mistakes = ... WHERE mistakes NOT LIKE '[%'` to convert old comma-strings to JSON arrays. The `insight-engine.ts` `.split(",")` call becomes `JSON.parse()` with comma-string fallback.

---

## Integration Points in Existing Codebase

| Feature | Integration Point | Change Type |
|---------|------------------|-------------|
| Sparklines | New `Sparkline` component in `components/dashboard/` or inline in trades page stats bar | New micro-component using existing Recharts |
| Multi-select dropdowns | New `FilterDropdown` component in `components/trades/` | New component, zero dependencies |
| Filter chips | Inline JSX in trades page header | Tailwind-only, no new component needed |
| Date range | Two `<input type="date">` fields in `FilterDropdown` | Native HTML |
| Saved views | New `trade_filter_views` settings key | `/api/settings` POST, same as presets |
| Column reorder | Extend existing `showColumnMenu` in `app/trades/page.tsx` | Add `@dnd-kit/sortable` drag to column list |
| Column persistence | New `trade_column_config` settings key | `/api/settings` POST |
| Mistakes types | New `mistake_types` settings key + migration 023 | Settings key + data migration |
| Mistakes tagging UI | `components/TradeModal.tsx` mistakes field | Replace text input with tag-picker |
| Right sidebar | New component `components/trades/TradesSidebar.tsx` | Recharts BarChart + stat rows |
| Mobile cards | New component `components/trades/TradeMobileCard.tsx` | Tailwind-only card layout |
| Quick filter presets | Inline state logic in trades page | Hardcoded filter sets applied to `activeFilters` state |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Sparklines | Recharts `<LineChart>` stripped | `react-sparklines` (npm) | Dead project (last commit 2018, 0 maintainers). Recharts already installed. |
| Sparklines | Recharts `<LineChart>` stripped | MUI X SparkLineChart | Requires installing MUI — massive bundle (~100 kB) for a 32px chart |
| Multi-select dropdown | Custom component | `react-select` | 28 kB gzipped; existing custom dropdown pattern handles the use case |
| Multi-select dropdown | Custom component | `downshift` / Headless UI | Both valid, but add abstraction over code we already have working |
| Date range | Native `<input type="date">` | `react-day-picker` v9 | Native is sufficient for filter UI; day-picker adds date-fns transitive dep |
| Date range | Native `<input type="date">` | `react-date-range` | Unmaintained as of 2024 |
| Column reorder | @dnd-kit/sortable (installed) | TanStack Table | Full table library for a feature that needs 30 lines of @dnd-kit code |
| Mistakes storage | JSON array in existing TEXT column | New `trade_mistakes` junction table | Junction table adds JOIN complexity; JSON array is sufficient at SQLite scale |
| Mistakes types | Settings key JSON array | New `mistake_types` DB table | Settings key matches all other user-preference storage; consistent pattern |
| Right sidebar data | Client-side computation | New API endpoints | All data is already loaded in `allTrades`; no server round-trip needed |
| Mobile layout | Tailwind responsive + card view | Dedicated mobile library | Tailwind breakpoints are the established pattern throughout the app |

---

## What NOT to Add

| Temptation | Why to Avoid |
|------------|-------------|
| `react-select` or `downshift` | Existing custom dropdown pattern handles multi-select. 28 kB for functionality already working in the codebase. |
| `react-table` / TanStack Table | Column reorder via @dnd-kit is ~30 lines. TanStack Table is a full headless table engine for complex sorting/virtualization we don't need yet. |
| `react-day-picker` (at start) | Native `<input type="date">` is sufficient for MVP. Defer until explicit user feedback requests calendar UX. |
| `date-fns` directly | Not needed until react-day-picker is added. All current date formatting uses `.toLocaleDateString()` and string slicing. |
| `immer` for filter state | Filter state is a flat object. Spread operators handle updates cleanly. |
| `zustand` / `jotai` | Filter state lives in the trades page. No cross-page state sharing needed. |
| `react-virtuoso` / `react-window` | Most traders have <500 trades. Virtualization is premature optimization. Add only if performance testing shows it's needed. |
| `cmdk` command palette | Overkill for this filter system. The multi-select dropdowns with search input are sufficient. |

---

## Sources

- Recharts LineChart API — `hide` prop on XAxis/YAxis confirmed as established sparkline pattern — [Recharts official API](https://recharts.github.io/en-US/api/LineChart/) — HIGH confidence
- Recharts v2.15.0 installed (package.json confirmed) — HIGH confidence
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities all installed (package.json confirmed) — HIGH confidence
- `mistakes` TEXT column existence confirmed in `lib/db.ts` migration 013 — HIGH confidence
- `demo-data.ts` `default_mistakes` JSON array format — confirmed existing intent for structured mistakes — HIGH confidence
- `react-day-picker` v9.14.0 includes `date-fns` as bundled dependency (not peer dep) — [react-day-picker GitHub discussion #2280](https://github.com/gpbl/react-day-picker/discussions/2280) — MEDIUM confidence on exact bundle size
- `react-sparklines` maintenance status (last commit 2018) — [GitHub borisyankov/react-sparklines](https://github.com/borisyankov/react-sparklines) — HIGH confidence (project clearly inactive)
- Mobile data table pattern: card view for mobile is industry standard — [Simple Table blog](https://www.simple-table.com/blog/mobile-compatibility-react-tables), [DEV Community](https://dev.to/masud_ali_cc66779de0c2b2/building-a-custom-date-range-picker-in-react-5585) — MEDIUM confidence
- Column DnD with @dnd-kit — TanStack Table official docs now use @dnd-kit as recommended DnD library — [TanStack Table column ordering guide](https://tanstack.com/table/v8/docs/guide/column-ordering) — HIGH confidence
