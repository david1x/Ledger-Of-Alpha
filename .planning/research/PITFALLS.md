# Domain Pitfalls

**Domain:** Advanced filter system, saved views, mistakes tagging, summary stats with sparklines, enhanced trade table with column config, and right sidebar analytics — added to existing Next.js 15 + SQLite trading journal (v3.0 Trades Page Overhaul)
**Researched:** 2026-03-21
**Confidence:** HIGH (direct codebase analysis of existing trades page + targeted research on each feature area)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or feature failure.

---

### Pitfall 1: Client-Side Filter Architecture Cannot Scale to the Mistakes System

**What goes wrong:** The existing trades page already uses client-side filtering: `allTrades` is fetched once from `/api/trades`, then filtered in JavaScript with a simple `.filter()` chain (lines 162-167 of app/trades/page.tsx). The current filters are trivial — status, direction, and a symbol substring. Adding Mistake filters breaks this model entirely. The `mistakes` column on the `trades` table stores a JSON string (TEXT column added in migration 007 via `ALTER TABLE trades ADD COLUMN mistakes TEXT`). Filtering client-side requires `JSON.parse(t.mistakes)` on every row for every filter evaluation. For a trader with 500+ trades, this causes a measurable render stall, and the filter combination logic grows into an untestable nested condition chain.

**Why it happens:** Client-side filtering is fast to write and avoids a round-trip. Developers extend it because "it worked before." Each new filter type gets appended to the `.filter()` chain without measuring cumulative cost. When the mistakes column needs to be filtered, `JSON.parse` inside a hot loop is the natural first attempt.

**Consequences:**
- Filtering 1000 trades by three simultaneous criteria including JSON-parsed mistakes causes a 200-400ms stall on mid-range hardware — enough to make the UI feel broken on every keystroke.
- The client holds ALL trades in memory regardless of filter. A trader with years of journal data hits browser memory pressure.
- Adding "saved views" that trigger filter changes on load means the stall happens immediately on page open, not just when the user actively filters.
- The summary stats bar (totals, win%, sparkline data) must recalculate over the same filtered slice on every filter change — doubling the work.

**Prevention:**
- Move filtering to the server. Extend `GET /api/trades` to accept all new filter params: `mistake_type`, `setup`, `tags`, `date_from`, `date_to`. Build the WHERE clause server-side using parameterised queries (the existing query-builder pattern at lines 38-44 of `app/api/trades/route.ts` is already structured for this — extend it).
- For the `mistakes` JSON column, use SQLite's `json_each()` to filter: `EXISTS (SELECT 1 FROM json_each(t.mistakes) WHERE value = ?)`. This is supported without schema changes and performs acceptably on datasets under 10,000 rows. Add `CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades (user_id)` if not already present — the user_id filter is the first clause and the index prevents full-table scans.
- The "mistakes" column currently stores unstructured text or JSON. Before building the filter, audit what format it actually holds in production (open DevTools and inspect a few trade records). If it is free-text, a normalised approach (separate `trade_mistakes` junction table) is required for efficient filtering. If it is already a JSON array of strings, `json_each()` works.
- Keep client-side JavaScript filtering only for the quick filter chips (Winners/Losers/This Week) that filter an already-fetched, already-server-filtered result set — this is the correct use of client-side filtering.

**Detection:** Insert 500 demo trades via the import system, then enable all filter types simultaneously. Measure filter-change-to-render time with Chrome DevTools Performance tab. Any value above 100ms is unacceptable for a filter that fires on dropdown change.

**Phase:** Filter system phase (highest risk — affects all downstream features).

---

### Pitfall 2: Mistakes Tagging — JSON Column Cannot Be Indexed, Normalised Table Cannot Be Migrated Without Data Loss

**What goes wrong:** The `mistakes` column (TEXT, stores JSON) was added in migration 007. The new mistakes system is user-defined mistake types (e.g. "Chased Entry", "Ignored Stop") that are tagged per trade. There are two approaches:

1. Continue storing mistakes as a JSON array in the existing `mistakes` column (e.g. `["Chased Entry", "Ignored Stop"]`).
2. Create a normalised `trade_mistakes` junction table.

The JSON column approach cannot be indexed in SQLite. `json_each()` queries require a full scan of the `mistakes` column for every matching row. The normalised table approach requires a migration that parses the existing `mistakes` JSON values and inserts them into the new table — if the existing data is a mix of text formats (some rows store free text, some store JSON arrays, some are NULL), the migration will silently drop data for rows that fail to parse.

**Why it happens:** The `mistakes` column predates the structured mistakes system. It was likely a free-text field used for ad-hoc notes. A developer building the new mistakes system may assume it contains structured JSON when it does not.

**Consequences:**
- Attempting `json_each()` on a row where `mistakes` is `"Rushed the trade"` (plain text, not a JSON array) returns a SQLite error or silently returns no rows — the trade disappears from mistake-filtered results without warning.
- A migration that does `INSERT INTO trade_mistakes SELECT json_each.value FROM trades, json_each(trades.mistakes)` will fail on rows with non-JSON values, aborting the migration if not wrapped in error handling.
- User-defined mistake type names stored only in trades JSON cannot be enumerated without scanning all trade rows — there is no `mistake_types` source of truth for the dropdown.

**Prevention:**
- Before writing the migration, audit actual `mistakes` column values with: `SELECT mistakes FROM trades WHERE user_id = [id] AND mistakes IS NOT NULL AND mistakes != '' LIMIT 20`. This reveals whether data is JSON or free text.
- Add a `mistake_types` table for the user-defined catalogue: `id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, color TEXT`. This becomes the source of truth for the filter dropdown and is trivially indexable.
- Add a `trade_mistakes` junction table: `trade_id INTEGER, mistake_type_id INTEGER`. This replaces (not augments) the JSON column for new mistake assignments.
- The migration that populates `trade_mistakes` from the old `mistakes` column must wrap each row in a try/catch (SQLite's `json_valid()` function: `WHERE json_valid(mistakes) = 1`) to skip non-JSON rows, then log skipped rows for the user to re-tag manually.
- After migration, do NOT drop the `mistakes` column — keep it as a graveyard column (nullable, ignored by new code) for backward compatibility and potential data recovery. Mark it deprecated in a code comment.

**Detection:** Before shipping, query `SELECT COUNT(*) FROM trades WHERE mistakes IS NOT NULL AND json_valid(COALESCE(mistakes, '[]')) = 0` against a real database. If count > 0, the JSON-column filtering strategy will silently lose data.

**Phase:** Mistakes tagging phase. The migration must run before the filter system is wired up — order matters.

---

### Pitfall 3: Saved Views Stored in Settings JSON Collide with Active Filter State

**What goes wrong:** The existing settings system stores everything as key-value pairs in the `settings` table (key TEXT PRIMARY KEY, value TEXT). Saved filter views (named presets like "Winners This Month", "TSLA Only") are the natural next entry. The pitfall is that developers will also want to persist the *currently active* filter state so it survives page refreshes. If both "current active filter" and "saved views" are written to the same `trade_filter_views` settings key, loading the page overwrites the user's current session filter state with the last-saved named preset.

More subtly: if saved views are stored in `localStorage` (for speed) but the API route for fetching trades does not have the corresponding filter params, the UI shows a filter chip ("Saved: Winners Only") but the trade data behind it is unfiltered. The filter chip and the data are out of sync.

**Why it happens:** There are three separate states to manage: (a) the current active filter values, (b) the list of saved named views, and (c) which saved view (if any) is "active." Developers conflate (a) and (c), or store (b) in `localStorage` without syncing to the DB, meaning views disappear when the user clears browser storage.

**Consequences:**
- A user saves a view called "My Best Setups," navigates away, returns to the trades page, and finds the page has applied "My Best Setups" automatically even though they wanted no filter.
- Saved views stored only in `localStorage` are lost if the user clears their browser or switches machines.
- Applying a saved view does not update the URL, so sharing the page link gives an unfiltered view — the recipient sees different trades than the sender intended.

**Prevention:**
- Use three distinct storage keys: `trade_saved_views` (DB, for the named presets catalogue), `trade_active_filters` (localStorage, ephemeral session state that survives refresh but not intent), and URL search params for shareable filter state.
- On page load priority: URL params take highest precedence, then `trade_active_filters` from localStorage, then no filter (clean state). Never auto-apply a saved view on page load.
- Applying a saved view copies its filter values into the URL params — not into a "which view is active" flag. This way, the URL is always the truth for what filters are active. The "active view" chip label is derived by comparing current URL params against the saved views catalogue.
- Saved views are stored in the DB via the existing `/api/settings` endpoint as: `trade_saved_views: JSON.stringify(Array<{ id: string; name: string; filters: FilterState }>)`. This ensures cross-device persistence.
- The settings save is debounced (500ms) for active filter state — every filter change should not fire a settings API call. For saved views (explicit user action: "Save View"), the save fires immediately.

**Detection:** (1) Save a view, reload the page — active filter must be clear, saved view must appear in the presets list only. (2) Apply a saved view, copy the URL, open it in an incognito tab — the same filters must be active. (3) Clear localStorage, reload — saved views must still be present (pulled from DB).

**Phase:** Saved views phase. Must be designed before the filter UI is built, since the persistence architecture affects how every filter change is wired.

---

### Pitfall 4: Summary Stats Sparklines Re-render on Every Filter Change, Blocking the Main Thread

**What goes wrong:** The summary stats bar will include sparklines (cumulative return, win%, P/L ratio trend). Each sparkline is a Recharts instance (or similar SVG chart). When the user changes a filter, the trade list re-renders AND the sparkline data recalculates AND three Recharts instances re-render — all synchronously on the main thread. With 500 trades, the sparkline data computation alone (sorting by date, computing cumulative series, slicing the last N points) takes 15-40ms. Three sparklines in the same render cycle = 45-120ms, which adds to the filter-change latency.

**Why it happens:** Sparkline data is computed inline in the render function: `const sparkData = trades.map(t => ({ date: t.exit_date, cum: ... }))`. This recomputes from scratch on every render because trades is a new array reference after each filter. React.memo on the sparkline component doesn't help because `data` is a new array reference each time.

**Consequences:**
- Rapid filter changes (typing in a symbol search box triggers one render per keystroke) causes jank because each keystroke triggers full sparkline recomputation.
- Memory pressure: each Recharts instance maintains its own SVG DOM tree. Three sparklines plus the main trade table in the same component tree is manageable, but if the right sidebar also contains charts, total concurrent Recharts instances can reach 8-10 on a single page.

**Prevention:**
- Memoize sparkline data with `useMemo`: `const sparkData = useMemo(() => computeCumulative(filteredTrades), [filteredTrades])`. This ensures the expensive computation only runs when `filteredTrades` actually changes (referential equality check), not on every re-render.
- Debounce filter application by 150ms for text inputs (symbol search) so sparklines don't recompute on every keystroke. Dropdown filter changes (Status, Direction) can apply immediately since they are discrete selections.
- Use lightweight sparkline SVG primitives instead of full Recharts instances in the summary stats bar. Recharts' `LineChart` with `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, and `Legend` is far heavier than needed for a 60x20px sparkline. A raw SVG `<polyline>` computed from normalised data points is sufficient and has zero re-render overhead.
- The right sidebar analytics (Account Performance, Setups P&L, Mistakes P&L) should be lazy-loaded or deferred — they are secondary information and should not block the main table from rendering.

**Detection:** Open Chrome DevTools Performance tab. Change a filter (type a single character in the symbol search box). The flame graph must show no long tasks (>50ms) in the main thread. If sparkline recalculation appears as a significant slice, memoization is not working.

**Phase:** Summary stats bar phase. Architecture the sparkline data pipeline before building the UI.

---

### Pitfall 5: Dynamic SQLite Filter Query with User-Provided Values — SQL Injection via Tag/Mistake Filters

**What goes wrong:** The existing query builder (lines 35-47 of `app/api/trades/route.ts`) uses parameterised queries correctly: `query += " AND symbol LIKE ?"` with `params.push(...)`. The new filter types include Custom Tags and Mistake Types. Tags are stored as a JSON array in a TEXT column. The temptation is to build the `json_each()` clause by interpolating the filter value directly: `query += \` AND EXISTS (SELECT 1 FROM json_each(t.tags) WHERE value = '${tagValue}')\``. This is a classic SQL injection vector.

**Why it happens:** SQLite's `json_each()` is a table-valued function and the filtering pattern `WHERE json_each.value = ?` with parameterised queries is non-obvious. Developers who have never used `json_each()` before copy examples from blog posts that use string interpolation.

**Consequences:**
- A user who names a mistake type `') OR '1'='1` can craft a query that returns all users' trades.
- Even non-malicious input (apostrophes in tag names like "Bull's Run") causes SQLite syntax errors that crash the API route.

**Prevention:**
- Always use parameterised queries, even with `json_each()`. The correct form is:
  ```sql
  SELECT t.* FROM trades t
  WHERE t.user_id = ?
  AND EXISTS (
    SELECT 1 FROM json_each(t.tags) jt WHERE jt.value = ?
  )
  ```
  With `params.push(user.id, tagValue)`. Better-sqlite3 supports this pattern natively.
- Validate tag and mistake values server-side: strip or reject values containing SQL metacharacters (`'`, `;`, `--`, `/*`). Since these are user-defined label strings, valid values are plain text with no SQL significance.
- The mistake filter should filter by `mistake_type_id` (an integer from the normalised `trade_mistakes` table), not by the user-entered name string. Integer parameters are injection-safe by construction.

**Detection:** Set a breakpoint in the API route and inspect the `query` string. Confirm no user-provided value appears as a string literal in the query — every user value must be a `?` placeholder.

**Phase:** Filter system phase. Must be reviewed in code review before any filter value touches the DB.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-visible bugs but don't require fundamental redesigns.

---

### Pitfall 6: Mobile Table Layout — Horizontal Scroll + Fixed First Column Conflict with the Right Sidebar

**What goes wrong:** Adding a right sidebar (account performance, setups, mistakes breakdown) narrows the available width for the trade table. On a 1280px screen with a left sidebar (~220px), right sidebar (~280px), and padding, the trade table gets ~750px. The existing TradeTable renders a standard `<table>` with multiple columns. At 750px, columns overflow, causing horizontal scroll. Adding a "freeze first column" (Symbol) to anchor position while scrolling is the standard solution — but CSS `position: sticky` on a `<td>` requires the parent `<td>` and all ancestor elements to NOT have `overflow: hidden` or `overflow: auto`. The scrollable wrapper div that enables horizontal scrolling typically needs `overflow-x: auto`, which breaks sticky column positioning.

**Why it happens:** The `position: sticky` + horizontal scroll conflict is a well-known browser quirk. Developers test sticky columns in isolation (they work), add the scrollable wrapper (sticky stops working), and spend hours debugging.

**Consequences:**
- If sticky column is implemented incorrectly, Symbol scrolls out of view with the rest of the row — the user loses context of which trade they're looking at.
- If the developer uses `transform: translateX()` as a sticky fallback, it fires on every scroll event and can cause jank on lower-end devices.
- The right sidebar may need to be collapsible by default on screens below 1400px to prevent the table from becoming unusable.

**Prevention:**
- Do not implement a custom sticky-column solution. Use `table-layout: fixed` with the first column having `position: sticky; left: 0; z-index: 1` and the scrollable wrapper using `overflow-x: auto`. This specific combination works in all modern browsers (Chrome 90+, Firefox 88+, Safari 14+).
- The right sidebar must have a default-collapsed state below 1400px viewport width, controlled by a CSS breakpoint or a `useResizeObserver` hook. Store the collapsed state in `localStorage` (key: `trades_sidebar_open`) so the user's preference persists.
- On screens below 768px, abandon the multi-column table entirely. Render trades as stacked cards (the "card view" pattern already used on the journal page). The journal page's card layout is a reference implementation.

**Detection:** Test the table at viewport widths of 1280px, 1024px, 768px, and 375px. At each breakpoint verify: (a) the Symbol column is visible without horizontal scrolling, or (b) the table switches to card layout. Use Chrome DevTools device emulation for the mobile tests.

**Phase:** Enhanced trade table phase. Design the responsive strategy before building the filter UI — filter chips above the table affect available height.

---

### Pitfall 7: Column Config Persistence Conflicts with New "Mistakes" and "Net Return" Columns

**What goes wrong:** Column visibility is persisted via the `trade_table_columns` settings key (a JSON string array of `ColumnKey` values). The existing `ColumnKey` union type is derived from `ALL_COLUMNS` (a `const` array in TradeTable.tsx). Adding new columns (`mistakes`, `net_return`, `cost_basis`) requires adding them to `ALL_COLUMNS`. If a user's saved `trade_table_columns` is `["symbol", "direction", "pnl", "date"]` and the new code expects `ColumnKey` to include `"mistakes"` as a valid value, the saved array is valid — new columns simply aren't shown. This is safe. The problem is the inverse: if a column key is removed (e.g., `"potential"` is renamed to `"unrealized_potential"`), saved configs containing the old key parse without error but the column renders nothing — the `ColumnKey` type guard passes because the value is still a string, but the render switch never matches.

**Why it happens:** The column key is a TypeScript union type enforced at compile time, but the saved JSON comes in at runtime. `JSON.parse` produces `string[]`, not `ColumnKey[]`. The type assertion `saved as ColumnKey[]` on line 150 of `app/trades/page.tsx` silently accepts stale keys.

**Consequences:**
- Users who had `potential` in their visible columns see a blank column with no header after a rename. No error, no indication that their config is stale.
- If many columns are renamed in one milestone, users lose all their column visibility configuration silently.

**Prevention:**
- After loading saved column config, filter it against the current `ALL_COLUMNS` keys: `const validKeys = new Set(ALL_COLUMNS.map(c => c.key)); const cleaned = saved.filter(k => validKeys.has(k));`. If `cleaned.length < saved.length`, the config had stale keys — apply it anyway (users lose their preference for removed columns only) and log a warning.
- Never rename existing column keys. Add new columns with new keys. Deprecate columns by keeping the key in `ALL_COLUMNS` but setting `default: false` — they fade from default views but don't break saved configs.
- If a column must be renamed, add the new key and keep the old key as an alias that maps to the same render path. Remove the alias in the milestone after next.

**Detection:** Save a column config, add a new column key to `ALL_COLUMNS` (simulate a new release), reload. Verify the saved config still renders correctly and includes the new column in its default-hidden state.

**Phase:** Enhanced trade table phase.

---

### Pitfall 8: Right Sidebar Analytics Run Separate API Calls, Causing Waterfall Fetches

**What goes wrong:** The right sidebar needs: (1) account performance summary (total P&L, win rate, expectancy), (2) P&L breakdown by setup/strategy, (3) P&L breakdown by mistake type. The natural implementation is three separate `useEffect` calls each fetching from a different API endpoint (or the same endpoint with different aggregation params). On page load, these three fetches happen in sequence if each depends on the previous, or in parallel but each with its own loading spinner — creating a "flickering" sidebar where sections pop in at different times.

**Why it happens:** Sidebar sections are built as independent components, each owning their own data fetching. This is a clean component boundary but produces a waterfall. React 18's Suspense could wrap these, but the codebase's API routes are not set up for streaming responses.

**Consequences:**
- Three spinner-then-content transitions in the sidebar create a jarring UX.
- Three separate `/api/trades` round-trips for the same underlying dataset (just different aggregations) is wasteful — all three can be computed from the same trade records.
- If the active account filter changes, all three sidepanel queries must re-fetch. Without careful dependency arrays, stale data from a previous account appears briefly.

**Prevention:**
- Compute sidebar analytics from the same `filteredTrades` array that drives the table, using client-side aggregation (reduce/groupBy). The sidebar shows breakdowns of the already-loaded trade data — it does not need its own API calls. This eliminates the waterfall entirely.
- Aggregate functions: `groupBy(filteredTrades, t => t.strategy_id)` for setup breakdown; `groupBy(tradesMistakes, m => m.mistake_type_id)` for mistake breakdown. These are O(n) operations on the already-fetched array.
- The sidebar should receive `filteredTrades` as a prop (or read from a shared context) and be a pure computation component. No `useEffect`, no fetch.
- If the analytics require data not in the trades array (e.g., account balance history for the performance chart), fetch it once in the parent and pass it down.

**Detection:** Open the Network tab, apply a filter, observe the sidebar update. Zero new API calls should fire — the sidebar must update purely from the in-memory filtered trades.

**Phase:** Right sidebar analytics phase. This is a downstream consumer of the filter architecture — design the filter state propagation path to include the sidebar before building it.

---

### Pitfall 9: Quick Filter Chips ("Winners", "This Week") Override Active Saved View State Inconsistently

**What goes wrong:** Quick filter chips are shortcuts that apply a preset filter combination (e.g., "Winners" = `status: closed, pnl > 0`; "This Week" = `exit_date >= [start of week]`). Saved views are named presets that restore a full filter state. If a user has a saved view active ("TSLA Shorts") and clicks the "Winners" quick filter chip, the intent is ambiguous: (a) does "Winners" replace all filters? (b) does "Winners" add to the active view's filters? The UX becomes inconsistent if quick filter chips are not treated as a defined operation.

**Why it happens:** Quick filter chips are added to the filter toolbar without a clear mental model of how they interact with the filter state. Each developer makes their own assumption about whether chips are additive or replacive.

**Consequences:**
- Users applying "This Week" after having "TSLA Shorts" active expect to see TSLA shorts from this week — but the implementation replaced all filters, so they see all trades from this week.
- The saved view chip shows "TSLA Shorts" as active even though "This Week" overrode part of its filter — the UI lies about which view is active.

**Prevention:**
- Define the interaction contract before building: quick filter chips are **additive to the current filter state**, not replacive. "Winners" adds `pnl > 0` and `status: closed` on top of whatever else is active. "This Week" adds `exit_date_from` and `exit_date_to` on top of whatever else is active.
- If a quick chip's filter value conflicts with an existing filter (e.g., current active filter already has `status: open`, and "Winners" requires `status: closed`), the chip replaces only its own fields, not the entire filter state.
- When any quick chip or manual filter change modifies the filter state away from a saved view's exact values, the "active view" label changes to "Custom" (or clears). The saved views list remains available to re-apply.
- Implement a `FilterState` type with well-defined fields and a pure `applyQuickFilter(current: FilterState, chip: QuickFilter): FilterState` function. This makes the merge logic testable and consistent.

**Detection:** (1) Apply a saved view. (2) Click a quick filter chip. (3) Verify the trade list shows the intersection (both filters active). (4) Verify the saved view label changes to "Custom."

**Phase:** Filter system phase. Define `FilterState` type and the merge semantics before building any UI.

---

### Pitfall 10: The `load()` Function Is Called on Account Switch, Discarding Active Filters

**What goes wrong:** The existing `load()` function (lines 113-157 of `app/trades/page.tsx`) is triggered by `useEffect(() => { load(); }, [activeAccountId, accounts.length])`. When the account changes, `load()` fetches fresh trades but also resets all UI state that is computed from the trade response. Adding filters means filter state must survive account switches (the user may want "Winners" in both their Main and Paper Trading accounts) — but if `load()` also calls `setStatus("all"); setDirection("all"); setSymbolQ("")`, the filters reset on every account change.

**Why it happens:** The single `load()` function mixes data fetching with state initialisation. When it was written, there was no filter state to preserve. Adding filter state without refactoring `load()` means either (a) filters reset on account switch (bad) or (b) stale filters from the previous account contaminate the new account's view (bad).

**Consequences:**
- User sets up a "Losers" filter on their Main account, switches to Paper Trading to check something, switches back — filter is gone.
- Alternatively: user searches for "AAPL" on their Main account, switches to Paper Trading — Paper Trading shows an "AAPL" filter even though they never set it there.

**Prevention:**
- Separate the filter state lifecycle from the data-fetching lifecycle. Filters belong to the UI session (persist in URL params or localStorage), not to the account. Switching accounts refetches data with the current filter applied.
- The `load()` function must accept filter params and pass them to the API call — it must NOT reset filter state. Filter state is controlled by the filter UI components independently.
- On initial page load, initialise filter state from URL params, then call `load()` with those filters. On account switch, call `load()` with the *current* filter state (not a reset state).

**Detection:** Set a filter, switch accounts, switch back. The filter must still be active and the data must reflect both the filter AND the correct account.

**Phase:** Filter system phase. Refactor `load()` before adding any filter params to it.

---

## Minor Pitfalls

Mistakes that cause inconvenience or polish issues without fundamental breakage.

---

### Pitfall 11: Filter Chips Show Stale Labels When Referenced Entities Are Deleted

**What goes wrong:** A filter chip might display "Setup: Wyckoff Buying" or "Mistake: Chased Entry." If the user deletes the "Wyckoff Buying" strategy or the "Chased Entry" mistake type, the filter chip still shows the label (it stored the ID or the name string). The filter may still technically work (filtering by a deleted mistake type returns zero results), but the chip label says "Mistake: Chased Entry" when that type no longer exists.

**Prevention:**
- Active filter chips derive their display labels from the live catalogue (strategies list, mistake types list). When deriving the label, if the ID is not found in the catalogue, show "[Deleted]" with a warning style and an X to dismiss.
- On page load, validate active filter state against the live catalogue. Auto-remove filter values referencing deleted entities.

**Phase:** Mistakes tagging phase / saved views phase.

---

### Pitfall 12: Summary Stats Bar Shows Aggregate of ALL Trades, Not Filtered Trades

**What goes wrong:** The project spec says the summary stats bar is "scoped to all trades unless date-filtered." This is an unusual scoping rule. If the user has a Symbol filter active ("TSLA only"), they expect the stats bar to reflect TSLA trades. If the stats bar always shows all-trades aggregates, it becomes misleading — the win rate in the bar doesn't match the trades shown in the table below it.

**Why it happens:** The spec ambiguity. "Unless date-filtered" is likely meant to mean "always shows current account's all-time stats for context, and only date-filtering narrows it" — but this is not how users expect a filter bar to behave.

**Prevention:**
- Clarify with the project owner before building: does the stats bar reflect the filtered set or the unfiltered set? The most intuitive UX (and the pattern used by every competitor: TradesViz, TraderSync, Tradervue) is that the stats bar reflects the filtered set.
- If the answer is "unfiltered always," label the stats bar clearly as "Account Totals" and position it above the filter bar (not between filter and table) so users understand it is a separate summary, not filter-scoped.
- If the answer is "filtered," use the same `filteredTrades` array for stats computation — this is the simpler implementation and the expected UX.

**Detection:** Apply a filter that excludes 50% of trades. If the stats bar numbers don't change, it's showing unfiltered data — which may be intended but must be labeled clearly.

**Phase:** Summary stats bar phase. Clarify the spec before implementation.

---

### Pitfall 13: The Symbol Search Filter Fires an API Call on Every Keystroke

**What goes wrong:** If the symbol filter input triggers server-side filtering (the correct architecture per Pitfall 1), each keystroke fires a `fetch()` call to `/api/trades?symbol=T`, then `/api/trades?symbol=TS`, then `/api/trades?symbol=TSL`, then `/api/trades?symbol=TSLA`. Without debouncing, four API calls fire in under 200ms. The last response is not guaranteed to be the last to arrive (network race condition) — the user may briefly see TSLA results replaced by TSL results if the `TSLA` response arrives before the `TSL` response.

**Prevention:**
- Debounce the symbol search input at 300ms. Only fire the API call after the user pauses typing.
- Use an AbortController to cancel the previous in-flight request when a new one fires. The existing `load()` function has no cancellation — add a `useRef` for the AbortController and cancel on each new call.
- Pattern: `const abortRef = useRef<AbortController | null>(null); const load = () => { abortRef.current?.abort(); abortRef.current = new AbortController(); fetch(url, { signal: abortRef.current.signal }); }`.

**Phase:** Filter system phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Filter system | Client-side JSON parse in hot loop for mistakes filter (Pitfall 1) | Move all filtering server-side; use json_each() with parameterised queries |
| Filter system | FilterState type undefined — each filter has ad-hoc shape (Pitfall 9, 10) | Define `FilterState` type and `applyQuickFilter()` before writing any UI |
| Filter system | SQL injection via tag/mistake name strings (Pitfall 5) | Parameterised queries only; never interpolate user values |
| Filter system | Symbol search API call race condition (Pitfall 13) | Debounce 300ms + AbortController |
| Mistakes tagging | Non-JSON values in existing `mistakes` column crash `json_each()` (Pitfall 2) | Audit column values before migration; use `json_valid()` guard |
| Mistakes tagging | No source-of-truth table for mistake type names (Pitfall 2) | Add `mistake_types` table in migration |
| Saved views | Active filter and saved views stored in same settings key (Pitfall 3) | Three separate storage mechanisms: DB for views, localStorage for session filters, URL for shareable state |
| Saved views | Saved view auto-applies on page load (Pitfall 3) | Never auto-apply saved views; URL params are the only auto-applied state |
| Summary stats sparklines | Recharts instances recompute on every keystroke (Pitfall 4) | `useMemo` for sparkline data; debounce text inputs; use raw SVG for sparklines |
| Summary stats | Stats bar reflects unfiltered data without labeling (Pitfall 12) | Clarify spec; implement stats from filteredTrades |
| Enhanced trade table | Sticky first column breaks inside overflow-x wrapper (Pitfall 6) | Use `table-layout: fixed` + `position: sticky; left: 0` pattern specifically |
| Enhanced trade table | Column key rename silently breaks saved configs (Pitfall 7) | Never rename keys; add new keys; validate saved keys against ALL_COLUMNS at load |
| Right sidebar | Three separate API fetches cause waterfall (Pitfall 8) | Compute all sidebar analytics from `filteredTrades` prop — no sidebar API calls |
| Right sidebar | Sidebar too wide on 1280px screens (Pitfall 6) | Default-collapsed below 1400px; persist preference in localStorage |
| Account switch | `load()` resets filter state on account change (Pitfall 10) | Separate filter state lifecycle from data fetch lifecycle |
| Filter chips | Chips referencing deleted entities show stale labels (Pitfall 11) | Validate active filters against live catalogues on load |

---

## Sources

- SQLite json_each() query patterns and indexing limitations: [SQLite JSON Functions And Operators](https://sqlite.org/json1.html), [SQLite Indexing JSON (Hacker News)](https://news.ycombinator.com/item?id=46243904), [SQLite json_each forum discussion](https://sqlite-users.sqlite.narkive.com/FoNgEqSn/sqlite-fastest-way-to-search-json-array-values)
- Client-side vs server-side filtering tradeoffs: [DEV Community — Deciding Between Client-Side and Server-Side Filtering](https://dev.to/marmariadev/deciding-between-client-side-and-server-side-filtering-22l9), [Next.js Table with Server-Side Performance](https://medium.com/@divyanshsharma0631/the-next-js-table-tango-mastering-dynamic-data-tables-with-server-side-performance-client-side-a71ee0ec2c63)
- Filter state URL sync pitfalls: [LogRocket — Advanced React state management using URL parameters](https://blog.logrocket.com/advanced-react-state-management-using-url-parameters/), [TanStack Table URL sync tree mismatch issue](https://github.com/TanStack/table/discussions/5002)
- Saved view persistence pitfalls: [PrimeNG saved filter state stale data issue](https://github.com/primefaces/primeng/issues/10065), [Best Practices for Persisting State in Frontend Applications](https://blog.pixelfreestudio.com/best-practices-for-persisting-state-in-frontend-applications/)
- Recharts performance and memoization: [Recharts Performance Guide](https://recharts.github.io/en-US/guide/performance/), [LogRocket — Best React chart libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- Mobile table responsive patterns: [TanStack Table responsive collapse discussion](https://github.com/TanStack/table/discussions/3259), [CSS Responsive Tables 2025](https://dev.to/satyam_gupta_0d1ff2152dcc/css-responsive-tables-complete-guide-with-code-examples-for-2025-225p)
- SQLite dynamic filter performance: [SQLite Query Optimizer Overview](https://sqlite.org/optoverview.html), [SQLite Performance Tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- Normalization vs JSON column tradeoffs: [SQLite JSON and denormalization](https://maximeblanc.fr/blog/sqlite-json-and-denormalization)
