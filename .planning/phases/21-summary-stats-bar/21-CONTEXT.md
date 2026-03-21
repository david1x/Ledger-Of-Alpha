# Phase 21: Summary Stats Bar - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Three stat cards (Cumulative Return, P/L Ratio, Win %) with sparkline trend charts, replacing AccountBanner on the trades page. Stats are scoped to whatever trades are currently visible (all active filters apply). Covers STAT-01, STAT-02, STAT-03.

</domain>

<decisions>
## Implementation Decisions

### Visual Layout
- Three individual card containers (not a horizontal strip) with dashboard widget styling (dark:bg-slate-800, rounded-xl, shadow)
- Each card: label at top, headline value (color-coded), subtitle text, sparkline at bottom
- 3-column grid layout, responsive (MOBI-03 specifies 2-column on small screens — Phase 23 handles that)
- Cards placed where AccountBanner currently sits — **replaces AccountBanner** on the trades page (AccountBanner removed from trades page only, still used on journal/dashboard)

### Sparkline Design
- Decorative only — no hover tooltip, no interactivity
- Data points ordered by trade exit_date (one point per closed trade)
- Sparkline content per card: Claude's discretion (e.g., cumulative P&L curve, rolling ratio, rolling win %)
- Small inline area charts using recharts (not lightweight-charts)

### Stats Scoping
- Stats respond to ALL active filters (symbol, setup, side, date, account, etc.) — not just date range
- Shows "Based on X of Y trades" label below the cards when filters are active
- Zero filtered trades: show zeros/dashes with flat sparklines, no layout shift (cards remain visible)

### Stat Definitions
- **Cumulative Return**: Sum of P&L for filtered closed trades. Display: dollar amount (primary) + percentage of starting balance (subtitle). Color: emerald if positive, red if negative.
- **P/L Ratio**: Average winning trade / |average losing trade|. Display: ratio number (primary) + "Avg $X / $Y" (subtitle). Color: emerald if > 1.0, red if < 1.0.
- **Win %**: Winners / total closed trades * 100. Display: percentage (primary) + "XW / YL" count (subtitle). Color: emerald if > 50%, red if < 50%.

### Color Coding
- All headline values color-coded: emerald-400 for positive/good, red-400 for negative/bad
- Consistent with existing dashboard color patterns throughout the app

### Privacy Mode
- Must respect usePrivacy() hook — mask all dollar amounts, percentages, and counts when privacy mode is active

### Claude's Discretion
- Exact sparkline content per stat card (cumulative curve vs rolling metric)
- Sparkline height and styling details
- Card internal spacing and typography scale
- Edge case handling (no losers for P/L ratio, single trade, etc.)
- Whether to animate stat transitions on filter change

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AccountBanner` (`components/AccountBanner.tsx`): Pattern for computing stats from trades array via useMemo — follow same approach
- `ChartWidgets` (`components/dashboard/ChartWidgets.tsx`): AreaChartWidget with recharts ResponsiveContainer, gradient fills, shared tooltip styles
- `StatWidget` (`components/dashboard/StatWidget.tsx`): Simple single-stat display card
- `usePrivacy()` hook from PrivacyProvider: privacy masking for sensitive values
- `filteredTrades` available in TradesShell via `applyFilter(allTrades, filter)` — direct input to stats computation

### Established Patterns
- Dashboard widget cards: dark:bg-slate-800/900, rounded-xl, shadow, p-4
- Color scheme: emerald for positive, red for negative, slate for neutral
- Stats computation via useMemo over trades array (AccountBanner pattern)
- Settings persistence via /api/settings as JSON strings

### Integration Points
- `components/trades/TradesShell.tsx` — insert SummaryStatsBar where AccountBanner is currently rendered (~line 240-246)
- Remove AccountBanner import from TradesShell (keep it on journal/dashboard pages)
- `filteredTrades` and `allTrades` arrays available as props/state in TradesShell
- Account starting balance available via `useAccounts()` hook for percentage calculation

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose to replace AccountBanner (not coexist) — the stats bar IS the trades page summary now
- "Based on X of Y trades" label gives users confidence about what's being measured
- Individual cards (not strip) chosen for visual weight — each stat gets its own container with sparkline

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-summary-stats-bar*
*Context gathered: 2026-03-21*
