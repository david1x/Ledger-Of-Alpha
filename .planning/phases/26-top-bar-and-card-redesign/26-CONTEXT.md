# Phase 26: Top Bar and Card Redesign - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the dashboard to match the trades page design language: navbar-style h-16 top bar with inline account stats and layout controls, unified card styling matching trades page conventions, viewport-locked layout with independent grid scrolling, and removal of the page title/subtitle and recent trades table widget.

</domain>

<decisions>
## Implementation Decisions

### Top Bar Layout
- Fixed h-16 top bar matching trades page pattern: `dark:bg-slate-900 bg-slate-100`, bottom border only (`border-b dark:border-slate-800 border-slate-200`)
- Left side: account stats inline (Balance, P&L with %, Today P&L, Trades count, Win Rate) — same data as current account summary strip, condensed into the bar
- Right side: time filter pills, then utility button group (edit mode toggle, reset, templates, refresh, export, privacy toggle), then New Trade button
- Account summary strip (the separate rounded card below header) is removed — absorbed into top bar
- Daily loss limit warning banner remains below the top bar (conditionally shown)

### Card Visual Style
- Switch from `rounded-2xl` to `rounded-md` to match trades page (Phase 24 decision)
- Background: `dark:bg-slate-800/50 bg-white` stays (consistent with current)
- Add subtle border: `border dark:border-slate-800 border-slate-200` to match trades page cards
- Remove `shadow-sm` from cards — borders provide definition (trades page pattern)
- Grid gap from `gap-3` stays — already tight
- Card header text stays `text-sm font-semibold`
- Card internal padding stays `p-3`

### Weekly Calendar Placement
- Weekly calendar remains as a full-width element between the top bar and the widget grid
- It is NOT a widget card — it stays as a standalone strip (current behavior)
- Styling updated to match new card conventions (rounded-md, border instead of shadow)

### Viewport Locking
- Outer container: `h-screen flex flex-col` (same pattern as trades page TradesShell)
- Top bar: `shrink-0` fixed height
- Content area (weekly calendar + widget grid + hidden widgets panel + open trades): `flex-1 min-h-0 overflow-y-auto` with padding
- No page-level scrollbar — only the content area scrolls

### Removed Elements
- Page title "Dashboard" and subtitle "Your trading performance at a glance" — removed per LAYOUT-03
- The separate account summary strip card — absorbed into top bar
- Recent trades table is not a current widget (no "recent-trades" widget exists) — CARD-02 may refer to the Open Trades section at bottom; keep Open Trades but move it inside the scrollable area

### Claude's Discretion
- Exact stat condensing in top bar (which stats to show if viewport is narrow — responsive breakpoints)
- Whether time filter pills use the current rounded-2xl pill group or switch to simpler buttons
- Button sizing in top bar (current h-7/h-8 icons may need adjustment for h-16 bar)
- Hidden widgets panel styling update (rounded-md, border)
- Export dropdown styling update
- Whether New Trade button stays in top bar or moves elsewhere
- Animation/transition details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TradesShell` pattern (`components/trades/TradesShell.tsx:245`): h-16 top bar with `px-6 flex items-center h-16 shrink-0 border-b` — direct reference for dashboard top bar
- `TradeFilterBar` (`components/trades/TradeFilterBar.tsx`): dropdown button pattern reusable for dashboard controls
- `WidgetCard` component (DashboardShell.tsx:219): existing sortable card wrapper — needs style updates (rounded-md, border)
- `TemplatePanel` component: already extracted, slots into top bar utility group
- `usePrivacy` context: already wired for privacy toggle
- `clsx` utility: already imported for conditional classes

### Established Patterns
- Trades page top bar: `h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100`
- Viewport locking: `h-[calc(100vh-64px)]` or flex-based with `flex-1 min-h-0 overflow-y-auto`
- Card borders: `border dark:border-slate-800 border-slate-200 rounded-md`
- Font sizing: `text-sm` for data, `text-xs` for labels
- @dnd-kit: DndContext + SortableContext + rectSortingStrategy already configured

### Integration Points
- `app/page.tsx`: minimal wrapper importing DashboardShell — no changes needed
- `app/layout.tsx`: root layout provides Navbar (64px sidebar) — dashboard content sits in the remaining space
- Settings API: `dashboard_layout`, `dashboard_time_filter` keys — no schema changes needed for this phase
- Account context: `useAccounts()` hook provides `activeAccount` for balance/stats

</code_context>

<specifics>
## Specific Ideas

- Top bar should feel like the trades page filter bar — same height, same colors, same density
- Stats in the top bar use the same label+value pattern as the current account summary strip but without the card wrapper
- The overall page should look like "trades page but with a widget grid instead of a table"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-top-bar-and-card-redesign*
*Context gathered: 2026-03-22*
