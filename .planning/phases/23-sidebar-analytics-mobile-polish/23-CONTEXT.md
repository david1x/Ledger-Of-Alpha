# Phase 23: Sidebar Analytics & Mobile Polish - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Right sidebar on the trades page showing account performance, setup rankings, and mistake impact breakdowns derived from the current filtered trades. Sidebar collapses to a slim toggle with state persisted. Full page is responsive on small screens with horizontal-scroll table, sticky symbol column, and a mobile toggle between table and analytics views. Covers SIDE-01, SIDE-02, SIDE-03, SIDE-04, MOBI-01, MOBI-02, MOBI-03.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Panels & Content
- **Account Performance (SIDE-01)**: Area chart (recharts) showing cumulative P&L curve. Stats above chart: avg return $, avg return %, win rate %
- **Setups Breakdown (SIDE-02)**: Ranked list sorted by total P&L descending. Each row: setup name, total P&L (color-coded), trade count, win rate %
- **Mistakes Breakdown (SIDE-03)**: Same ranked-list format as setups. Each row: mistake name with color dot (from mistake_type color), total P&L impact, occurrence count. Ranked by P&L impact (most costly first)
- **Click-to-filter**: Clicking a setup row sets `filter.tags = ["setup_name"]`; clicking a mistake row sets `filter.mistakeId`. Filter chips appear in TradeFilterBar. Bidirectional — sidebar drives filters

### Sidebar Behavior
- **Fixed width**: ~320px, not resizable
- **Collapse**: Slim icon toggle strip (~40px) when collapsed — single icon to expand
- **Default state**: Open on desktop on first visit. Persists toggle state via settings API (`trades_sidebar_open`)
- **Mobile (<1024px)**: Sidebar hidden — replaced by tab toggle (see Mobile section)
- **Independent scroll**: Sidebar scrolls vertically independent of main content area
- **Panels NOT individually collapsible**: All three panels always visible. Whole sidebar collapses as one unit

### Mobile Layout
- **Breakpoint**: lg (1024px) — below this, sidebar hides and mobile layout activates
- **Tab toggle**: Two tabs ("Table" / "Analytics") below the filter bar on mobile. Switches between trade table view and sidebar analytics view (full-width)
- **Sticky symbol column (MOBI-01)**: Symbol column only — pinned left on horizontal scroll
- **Filter chips (MOBI-02)**: Horizontal scroll without wrapping layout
- **Summary stats (MOBI-03)**: 2-column grid on small screens

### Sidebar Visual Style
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SummaryStatsBar` (`components/trades/SummaryStatsBar.tsx`): Recharts area charts with ResponsiveContainer — same pattern for performance chart
- `ChartWidgets` (`components/dashboard/ChartWidgets.tsx`): AreaChartWidget with gradient fills — reference for area chart styling
- `SymbolPnlWidget` (`components/dashboard/SymbolPnlWidget.tsx`): Horizontal bar chart for P&L by symbol — similar concept to setup/mistake rankings
- `usePrivacy()` hook from `lib/privacy-context`: Privacy masking for sensitive values
- `applyFilter()` in TradesShell: Pure function — sidebar computes from same `filteredTrades`
- `TradeFilterState` + `DEFAULT_FILTER` in `lib/types.ts`: Sidebar click-to-filter updates this state
- `MistakeType` interface in `lib/types.ts`: Has `color` field for color dots in mistake rows

### Established Patterns
- Dashboard widget cards: `dark:bg-slate-800/50 rounded-xl shadow p-4`
- Settings persistence: `/api/settings` as JSON strings (for sidebar open/closed state)
- SessionStorage for filter state (Phase 19 decision)
- Independent scroll panels: PersistentChart has sidebar with overflow-y-auto
- Border separation: `border-l dark:border-slate-700` used in Navbar

### Integration Points
- `components/trades/TradesShell.tsx`: Main orchestrator — sidebar sits alongside the existing content
- `filteredTrades` and `allTrades` arrays: Data source for all sidebar computations
- `filter` state + `updateFilter()`: Sidebar click-to-filter wires into these
- `mistakeTypes` state: Already fetched in TradesShell — pass to sidebar for color dots
- `TradeTable`: Needs sticky column + horizontal scroll modifications
- `TradeFilterChips`: Needs horizontal scroll on mobile
- `SummaryStatsBar`: Needs 2-col responsive grid

</code_context>

<specifics>
## Specific Ideas

- Mobile uses a tab toggle ("Table" / "Analytics") to switch between table and sidebar content — NOT a drawer or sheet
- Sidebar click-to-filter is bidirectional: clicking a setup/mistake row in the sidebar sets the corresponding filter, which then scopes the sidebar's own data (feedback loop)
- Mistake rows show the user-defined color dot from `mistake_type.color` field

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-sidebar-analytics-mobile-polish*
*Context gathered: 2026-03-21*
