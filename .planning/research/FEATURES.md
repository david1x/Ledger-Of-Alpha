# Feature Landscape

**Domain:** Advanced Trade Journal — Filters, Saved Views, Mistakes System, Inline Analytics Sidebar
**Researched:** 2026-03-21
**Milestone:** v3.0 Trades Page Overhaul

---

## Existing Foundation (Do Not Re-Build)

The current trades page already has:
- Symbol text search (client-side)
- Status filter buttons (All / Planned / Open / Closed)
- Direction filter buttons (All / Long / Short)
- Column visibility toggle (checkbox dropdown, persisted to settings API as `trade_table_columns`)
- `FilteredSummary` bar: P&L, win rate, unrealized P&L, trade count
- `AccountBanner`: balance, P&L, win rate, expectancy
- `mistakes` column on trades table (TEXT, JSON array of strings — migration already applied)
- `tags` column on trades table (TEXT, freeform)
- `strategy_id` on trades table
- `TradeTable` component: sorting, bulk delete, edit/delete row actions, quote hover

These are the **starting points**, not features to build from scratch.

---

## Table Stakes

Features traders expect. Missing = trades page feels like a prototype.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Active filter chips with X dismiss | Every modern data tool shows active filters as dismissible chips below the toolbar | Low | Replace implicit button-active state with explicit chip row |
| Quick filter presets | "Winners / Losers / This Week / This Month" are the 4 most common rapid views. TradeZella, TradesViz, TraderSync all implement these | Low | Hard-coded chips, no persistence needed |
| Date range filter | Traders constantly ask "what did I do last month?" — no date filter = can't answer | Medium | From/To date inputs, integrates with existing `entry_date`/`exit_date` fields |
| Setup/Tag filter | Traders build setups (e.g. "Bull Flag", "VWAP Reclaim") and need to see only trades of a given setup | Low | Derive unique values from `tags` field; dropdown multi-select |
| Side (Long/Short) filter | Already exists as buttons — promote to the new chip/filter system for consistency | Trivial | Already built, integrate into unified filter state |
| Account filter | Multi-account users need to filter without switching the global account context | Low | Dropdown of accounts, integrates with existing AccountProvider |
| Mistakes filter | Core to the mistake review workflow — "show me all trades where I sized too large" | Low | Derive from `mistakes` field; multi-select dropdown |
| Summary stats bar (P&L, Win%, P/L Ratio) | Traders need to see at-a-glance performance for the current view | Low | Already partially built in `FilteredSummary`; extend with P/L Ratio and sparkline |
| Status badges on rows | Visual status at a glance (color-coded pill: Planned/Open/Closed) | Trivial | `STATUS_STYLE` map exists in TradeTable, just needs badge rendering |
| Side badges on rows | Long/Short pill with color coding (green/red) | Trivial | Styling only |
| Mistakes column in table | Show mistake tags on each row | Low | Column already in ALL_COLUMNS definition; render pill tags |
| User-defined mistake types | Traders maintain consistent mistake vocabularies; ad-hoc strings lead to duplicates and unmergeable analytics | Medium | Needs `mistake_types` table (id, user_id, name, color); admin of their own list |
| Per-trade mistake tagging (edit modal) | Tagging at trade close is when context is freshest | Low | Extend TradeModal with multi-select from user's mistake types list |
| Column configuration persistence | Already exists — ensure new columns (net return, cost basis, mistakes) are added to ALL_COLUMNS | Low | Additive to existing system |

---

## Differentiators

Features that set this product apart. Not universally expected, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Saved named filter views | "My FOMO Review" or "Breakout Only Winners" — recall complex multi-filter state in one click. TradesViz calls these "custom reports"; TradeZella lists saved filters as "coming soon" | Medium | Store JSON filter state in settings API as `saved_trade_views`; name + filter snapshot |
| Sparklines in summary stats bar | Visual trend of cumulative P&L or win rate over filtered trades — shows trajectory, not just snapshot. Compact win/loss bar chart across filtered trades is widely used in financial dashboards | Medium | Use Recharts `<Sparkline>` or minimal custom SVG path; 60-day rolling P&L array |
| Right sidebar analytics panel | Setup P&L breakdown and Mistakes P&L breakdown as ranked lists — answer "which setups make money?" and "which mistakes cost most?" without leaving the trades page. TradesViz implements a powerful sidebar for this. | Medium | Collapsible right panel, filtered by same active filters; recalculated on filter change |
| Net return $ and % columns | Traders want P&L net of commission and also as % of position cost — more meaningful than raw P&L | Low | Compute: `pnl - commission`; `(exit - entry) / entry * 100 * direction_sign` |
| Cost basis column | Total capital deployed per trade (`entry_price * shares`) — helps assess position sizing discipline | Low | Compute client-side from existing fields |
| Mistake P&L impact in sidebar | For each mistake type: total loss attributed, count of occurrences, average P&L impact — the "cost of your bad habits" view. Rarely found outside professional tools. | Medium | Group closed trades by mistake tag, sum P&L |
| Setup P&L breakdown in sidebar | Win rate and average P&L by tag/setup — shows which edge actually works | Medium | Group closed trades by `tags` field; aggregate stats |
| Account performance panel in sidebar | Same as AccountBanner but scoped to the active filter state — filtered view performance, not account total | Low | Derive from filtered trades array, not allTrades |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Server-side filtering with API round-trips | Latency kills UX; all trade data is already loaded client-side (trades page fetches all trades on mount). SQLite is fast but adds network overhead | Keep all filter logic client-side on the `allTrades` array |
| Drag-reorder of sidebar analytics panels | DnD adds complexity; the sidebar has a natural hierarchy (Account > Setups > Mistakes). Ordering is not requested. | Static ordered sections with expand/collapse |
| Saved view sharing / export | No multi-user infrastructure; out of scope per PROJECT.md | Per-user settings API storage only |
| Full pivot grid (TradesViz-style) | Massive scope; this milestone targets a practical sidebar, not a pivot table | Simple ranked breakdown lists |
| Inline trade editing in table rows | Adds complex state; TradeModal already works well | Keep edit through modal |
| Real-time filter updates via WebSocket | Not applicable; trades data is static between manual refreshes | 60s quote refresh for open positions is sufficient |
| Mobile card stacked view (responsive table) | Web-first per PROJECT.md; horizontal scroll with sticky first column is adequate. Full card redesign is out of scope for this milestone. | Horizontal scroll on narrow viewports; sticky Symbol column |
| Per-strategy breakdown (strategy_id) | Deferred per PROJECT.md — strategies exist but strategy-level analytics are a later milestone | Use tags/setup field for now |
| Infinite scroll / virtualization | Trade counts are in the hundreds, not millions; pagination/full list is fine | Keep current full-list render |

---

## Feature Dependencies

```
Mistake Types Admin UI
  -> prerequisite for: Per-trade mistake tagging (TradeModal)
  -> prerequisite for: Mistakes filter dropdown (derive from user's list)
  -> prerequisite for: Mistakes column in table (render pills)
  -> prerequisite for: Mistakes P&L breakdown in sidebar

Active Filter Chips
  -> prerequisite for: Saved named filter views (need composable filter state object)
  -> parallel with: Quick filter presets (both manipulate same filter state)

Unified Filter State (single object with all active filter keys)
  -> prerequisite for: Saved views (serialize/deserialize this object)
  -> prerequisite for: Right sidebar (re-derives analytics from filtered trades)
  -> prerequisite for: Summary stats bar sparkline (scoped to filtered set)

Summary Stats Bar Extension
  -> builds on: existing FilteredSummary component
  -> adds: P/L Ratio metric, sparkline component

Right Sidebar
  -> depends on: filtered trades array (from Unified Filter State)
  -> depends on: Mistake Types (to label mistake breakdown)
  -> independent of: Saved Views (sidebar content, not filter config)
```

---

## MVP Recommendation

Prioritize in this order based on dependency chain and trader value:

1. **Unified filter state + active chip row** — Foundational. All other features depend on having a composable filter state object. The existing 3 separate filter states (status, direction, symbolQ) must be unified into one object. Active chips provide clear visual feedback.

2. **Quick filter presets** — High trader value, zero schema changes. Hard-code Winners / Losers / This Week / This Month as chip buttons that populate filter state.

3. **Date range, Setup/Tag, Account, Mistakes filter dropdowns** — Extend filter state with these dimensions. All client-side.

4. **Mistake types admin list** — Prerequisite for tagging. Needs new `mistake_types` DB table and a settings tab section. Keep it simple: add/remove names with optional color.

5. **Per-trade mistake tagging in TradeModal** — Once types exist, extend modal with multi-select. Writes JSON array to existing `mistakes` column.

6. **Summary stats bar extension** — Extend `FilteredSummary` with P/L Ratio and sparkline. Recharts is already in the stack.

7. **Enhanced trade table** — Add net return $/%, cost basis columns to ALL_COLUMNS. Add status/side badges, mistakes pills.

8. **Saved named filter views** — Serialize active filter state to settings API. Load/delete from a named preset dropdown.

9. **Right sidebar analytics** — Account performance, Setups breakdown, Mistakes breakdown. Collapsible panel driven entirely by filtered trades array.

**Defer for later:** Sparkline advanced interactions (hover detail), sidebar section reordering, per-strategy breakdown.

---

## Filter Dimension Reference

| Filter | Data Source | Type | Notes |
|--------|-------------|------|-------|
| Symbol | `trade.symbol` | Text search (contains) | Already exists |
| Status | `trade.status` | Multi-select or exclusive button group | Already exists |
| Side | `trade.direction` | Multi-select or exclusive button group | Already exists |
| Date Range | `trade.entry_date` or `trade.exit_date` | From/To date | New |
| Setup / Tag | `trade.tags` (comma-split or JSON array) | Multi-select dropdown of distinct values | New — clarify tags format first |
| Mistake | `trade.mistakes` (JSON string array) | Multi-select from user's mistake_types list | New — depends on mistake_types table |
| Account | `trade.account_id` | Dropdown of accounts | New — useful for "All Accounts" view |
| Outcome | derived from `trade.pnl` | Winners (>0) / Losers (<0) / Scratch (=0) | New (quick filter only) |

---

## Sidebar Analytics Sections

Right sidebar should contain three collapsible sections, each reacting to active filters:

**Section 1: Account Performance (filtered view)**
- Total P&L, Win Rate, Profit Factor, Avg Winner, Avg Loser, Total Trades
- This is the filtered counterpart to AccountBanner (which always shows account totals)

**Section 2: Setups Breakdown**
- Ranked by total P&L: Setup name | Trade count | Win rate | Avg P&L
- Source: `trade.tags` field, parsed and grouped
- Clicking a setup row applies it as a filter

**Section 3: Mistakes Breakdown**
- Ranked by total P&L impact (most costly first): Mistake | Count | Total P&L impact | Avg impact
- Source: `trade.mistakes` JSON array, cross-referenced with mistake_types
- Clicking a mistake type applies it as a filter

---

## Mobile Behavior

Web-first but not mobile-hostile:

- Filter bar: wrap to multiple lines on small viewports; filter chips scroll horizontally
- Trade table: horizontal scroll with `Symbol` column sticky (position: sticky, left: 0)
- Sidebar: collapses to bottom drawer on mobile OR hides behind a toggle button
- Summary stats bar: 2-column grid layout on small screens (hide sparkline at xs breakpoint)

Standard pattern per UX research: stacked card view is best UX but high complexity. For this milestone, horizontal scroll with sticky column is the pragmatic choice.

---

## Sources

- [TradeZella Features Page](https://www.tradezella.com/features) — filter types, saved filters (coming soon status)
- [TradeZella: Using Filters](https://intercom.help/tradezella-4066d388d93c/en/articles/12417670-using-filters-in-tradezella) — filter UX patterns
- [TradeZella: Analyzing Tags](https://intercom.help/tradezella-4066d388d93c/en/articles/7190691-analyzing-tags) — mistake/tag analysis patterns
- [TradesViz: Build Custom Reports](https://www.tradesviz.com/blog/build-trade-report/) — saved filter combinations, custom report UX
- [TradesViz: Nov 2024 Updates](https://www.tradesviz.com/blog/nov-2024-updates/) — sidebar analytics, pivot grid
- [Best Trading Journal 2026 Comparison](https://www.tradesviz.com/blog/best-trading-journal-2026-comparison/) — market expectations, table stakes
- [StockBrokers: Best Trading Journals 2026](https://www.stockbrokers.com/guides/best-trading-journals) — trader expectations
- [Designing Mobile Tables — UXmatters](https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php) — mobile table patterns
- [NN/G: Mobile Tables](https://www.nngroup.com/articles/mobile-tables/) — sticky column, horizontal scroll pattern
- [Data Table UX Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — column chooser, filter pattern analysis
- [TanStack Table Column Visibility](https://tanstack.com/table/latest/docs/framework/react/examples/column-visibility) — column toggle implementation reference
