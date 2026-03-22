# Phase 26: Top Bar and Card Redesign - Research

**Researched:** 2026-03-22
**Domain:** Next.js / Tailwind CSS layout restructuring — viewport-locked flex shell, inline account stats bar, unified card styling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Top Bar Layout**
- Fixed h-16 top bar matching trades page pattern: `dark:bg-slate-900 bg-slate-100`, bottom border only (`border-b dark:border-slate-800 border-slate-200`)
- Left side: account stats inline (Balance, P&L with %, Today P&L, Trades count, Win Rate) — same data as current account summary strip, condensed into the bar
- Right side: time filter pills, then utility button group (edit mode toggle, reset, templates, refresh, export, privacy toggle), then New Trade button
- Account summary strip (the separate rounded card below header) is removed — absorbed into top bar
- Daily loss limit warning banner remains below the top bar (conditionally shown)

**Card Visual Style**
- Switch from `rounded-2xl` to `rounded-md` to match trades page (Phase 24 decision)
- Background: `dark:bg-slate-800/50 bg-white` stays
- Add subtle border: `border dark:border-slate-800 border-slate-200` to match trades page cards
- Remove `shadow-sm` from cards — borders provide definition
- Grid gap from `gap-3` stays
- Card header text stays `text-sm font-semibold`
- Card internal padding stays `p-3`

**Weekly Calendar Placement**
- Weekly calendar remains as a full-width element between the top bar and the widget grid
- It is NOT a widget card — it stays as a standalone strip
- Styling updated to match new card conventions (rounded-md, border instead of shadow)

**Viewport Locking**
- Outer container: `h-screen flex flex-col`
- Top bar: `shrink-0` fixed height
- Content area (weekly calendar + widget grid + hidden widgets panel + open trades): `flex-1 min-h-0 overflow-y-auto` with padding
- No page-level scrollbar — only the content area scrolls

**Removed Elements**
- Page title "Dashboard" and subtitle "Your trading performance at a glance" — removed per LAYOUT-03
- The separate account summary strip card — absorbed into top bar
- "Recent trades" table is not a current widget; CARD-02 refers to removal of any recent-trades widget if present (none found in widget list) — Open Trades section kept but moved inside scrollable area

### Claude's Discretion
- Exact stat condensing in top bar (responsive breakpoints for narrow viewports)
- Whether time filter pills use current rounded-2xl pill group or switch to simpler buttons
- Button sizing in top bar (h-7/h-8 icons may need adjustment for h-16 bar)
- Hidden widgets panel styling update (rounded-md, border)
- Export dropdown styling update
- Whether New Trade button stays in top bar or moves elsewhere
- Animation/transition details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAYOUT-01 | Dashboard has navbar-style top bar (h-16) with account balance, P&L, and win rate | Top bar pattern documented below; account stats already computed in DashboardShell (`currentBalance`, `totalPnl`, win rate inline calculations at lines 1171-1216) |
| LAYOUT-02 | Layout controls (edit mode, save/load templates, time filter, privacy, refresh) in top navbar | All controls exist in current header div (lines 1077-1163); need relocating into new top bar structure |
| LAYOUT-03 | Page title and subtitle removed | Located at DashboardShell lines 1072-1073; straightforward deletion |
| LAYOUT-04 | Dashboard is viewport-locked (no page scroll, grid scrolls independently) | Requires replacing `space-y-6` root div with `h-screen flex flex-col`; content area gets `flex-1 min-h-0 overflow-y-auto` |
| CARD-01 | Card design matches trades page style (rounded-md, borders, bg, font sizing) | `WidgetCard` component at line 246: change `rounded-2xl ... shadow-sm` to `rounded-md border dark:border-slate-800 border-slate-200` |
| CARD-02 | Recent trades table widget removed | No `recent-trades` widget ID exists in `ALL_WIDGETS` or `DEFAULT_ORDER` — requirement is already satisfied by current state. Verification step: confirm no widget renders a recent trades table. |
| CARD-03 | All widgets use unified card container component | `WidgetCard` is already the single wrapper for all widgets; ensuring every widget goes through it satisfies this |
</phase_requirements>

---

## Summary

Phase 26 is a layout and visual refactor of `DashboardShell.tsx` (~1350 lines). The component already contains all the data, state, and widget logic — nothing new needs building from scratch. The work is structural: replace the scrolling page layout with a viewport-locked flex shell, absorb the account summary strip into a new h-16 top bar, and change card border radius and shadow rules to match the trades page.

The primary reference implementation is `TradesShell.tsx` line 243-283. Its top bar pattern (`h-screen flex flex-col` wrapper, `h-16 shrink-0 border-b dark:border-slate-800 dark:bg-slate-900 bg-slate-100` bar) is directly copied. The account stats currently in the "Account Summary Strip" div (lines 1167-1218) are reformatted as inline label+value pairs inside that bar. All existing controls (time filter pills, utility button group, New Trade button) move right in the same bar.

The `WidgetCard` component (line 219-282) needs one-line class changes: `rounded-2xl ... shadow-sm` becomes `rounded-md border dark:border-slate-800 border-slate-200`. The `WeeklyCalendar`, hidden widgets panel, open trades section, and daily loss warning all receive the same border/radius treatment. No new state, no new API calls, no new components are required.

**Primary recommendation:** Work top-down through `DashboardShell.tsx` — outer container first, then top bar, then card classes. Keep all existing state and logic intact; only structural JSX and className strings change.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v3 (project-installed) | All layout, spacing, color classes | Already in project; flex/grid utilities drive the entire layout change |
| @dnd-kit/core + sortable | existing | Drag-reorder stays unchanged | No changes to DnD logic — only surrounding container structure changes |
| next-themes | existing | Dark mode class toggling | `dark:` prefix pattern applies to all new classes |
| lucide-react | existing | Button icons | Same icon set; no new icons needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | existing | Conditional className strings | Already imported in DashboardShell; use for `hidden` privacy toggling in top bar stats |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `flex-1 min-h-0 overflow-y-auto` content area | `h-[calc(100vh-64px)] overflow-y-auto` | Both work; flex approach is what trades page uses and is more robust with dynamic top-bar heights |

---

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes are within:
```
components/dashboard/
├── DashboardShell.tsx    # Primary change file (outer container, top bar, WidgetCard classes)
├── WeeklyCalendar.tsx    # Minor: update border/radius styling on the outer wrapper
```

### Pattern 1: Viewport-Locked Flex Shell (TradesShell pattern)
**What:** Replace `<div className="space-y-6">` root with a full-screen flex column; top bar is `shrink-0`, content area is `flex-1 min-h-0 overflow-y-auto`.
**When to use:** Any page that must not create a page-level scrollbar — scroll happens only inside the content area.

**The current DashboardShell root (to replace):**
```tsx
// BEFORE (line 1068)
return (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col xl:flex-row ...">
    ...
    {/* Account Summary Strip */}
    <div className="rounded-2xl dark:bg-slate-900/80 ...">
```

**After (TradesShell pattern adapted):**
```tsx
// Source: components/trades/TradesShell.tsx line 243-245
return (
  <div className="flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden" style={{ height: "100vh" }}>

    {/* Top Bar */}
    <div className="px-6 flex items-center h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100">
      {/* LEFT: account stats */}
      <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
        {/* Balance, P&L, Today, Trades, Win Rate — label+value pairs */}
      </div>
      {/* RIGHT: time filter + utility group + New Trade */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {/* time filter pills */}
        {/* utility icon group */}
        {/* New Trade button */}
      </div>
    </div>

    {/* Daily Loss Warning — conditionally shown, shrink-0 */}
    {dailyLossExceeded && (
      <div className="px-6 py-2 shrink-0 ...">...</div>
    )}

    {/* Scrollable content area */}
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
      <WeeklyCalendar ... />
      {/* Widget Grid */}
      {/* Hidden Widgets Panel */}
      {/* Open Trades */}
    </div>
  </div>
);
```

### Pattern 2: Top Bar Inline Account Stats
**What:** The 5 account stats (Balance, P&L+%, Today P&L+%, Trades, Win Rate) sit inline as label+value pairs separated by thin vertical dividers — same pattern as the existing Account Summary Strip but without the card wrapper.

**Current strip structure to adapt (lines 1169-1216):**
```tsx
// Existing pattern — keep structure, strip the outer card div
<div className="flex items-center gap-2">
  <span className="text-[10px] sm:text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">Balance</span>
  <span className={`text-sm sm:text-base font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
    {hidden ? mask : `$${currentBalance.toFixed(2)}`}
  </span>
</div>
<div className="hidden sm:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
{/* ... repeat for P&L, Today, Trades, Win Rate */}
```

For the top bar, the outer `sm:text-base` sizing should shrink to consistently `text-sm` to fit h-16. Labels can be condensed (`text-xs`) or hidden at smaller breakpoints (`hidden lg:block` or `hidden md:flex`).

### Pattern 3: Updated WidgetCard Class
**What:** Single className change on the WidgetCard wrapper div.

```tsx
// BEFORE (line 246)
<div ref={setNodeRef} style={style}
  className={`rounded-2xl dark:bg-slate-800/50 bg-white p-3 flex flex-col shadow-sm ${spanClass}`}
>

// AFTER
<div ref={setNodeRef} style={style}
  className={`rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-800/50 bg-white p-3 flex flex-col ${spanClass}`}
>
```

### Pattern 4: WeeklyCalendar Border Update
WeeklyCalendar renders its own outer container. Search for `rounded-xl` or `shadow` on its outer wrapper and apply the same treatment (`rounded-md border dark:border-slate-800 border-slate-200`).

### Anti-Patterns to Avoid
- **Keeping `space-y-6` as root:** The current root div uses `space-y-6` which means page-level margin stacking — this defeats viewport locking. The ENTIRE content must be inside the `flex-1 min-h-0 overflow-y-auto` area.
- **Using `h-[calc(100vh-64px)]`:** The sidebar is already 64px. The `app/layout.tsx` wraps content in a padded area. Inspect how `TradesShell` uses `-mx-6 -mt-6 -mb-6 overflow-hidden` with `style={{ height: "100vh" }}` to escape the layout padding — use that same escape pattern.
- **Putting the daily loss warning inside the top bar:** It must be a `shrink-0` element below the top bar so it doesn't compress the bar height.
- **Removing Open Trades section:** CONTEXT.md confirms Open Trades stays, just moves inside the scrollable content area.
- **Creating a new "AccountTopBar" component:** The user's preference is direct/inline patterns (CLAUDE.md: "No unnecessary abstractions"). Build it inline in DashboardShell.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport locking | Custom CSS or JS scroll management | Tailwind `h-screen flex flex-col` + `flex-1 min-h-0 overflow-y-auto` | CSS flex handles this natively; TradesShell already proves the pattern works in this codebase |
| Privacy masking in top bar | Separate privacy state | Existing `usePrivacy()` hook + `hidden` + `mask` variables | Already wired in DashboardShell — just apply the same `hidden ? mask : value` pattern to the top bar stats |
| Responsive stat hiding | JS-based width detection | Tailwind breakpoint classes (`hidden md:flex`, `hidden lg:inline`) | Pure CSS, no JS overhead |

---

## Common Pitfalls

### Pitfall 1: Layout Escape — The `-mx-6 -mt-6 -mb-6` Pattern
**What goes wrong:** If the DashboardShell root div does not escape the parent layout padding, the `h-screen` container will be taller than the visible viewport and cause a double scrollbar.
**Why it happens:** `app/layout.tsx` wraps the main content area with padding (commonly `p-6` or similar).
**How to avoid:** Mirror TradesShell exactly: `<div className="flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden" style={{ height: "100vh" }}>`. The negative margins offset the layout padding.
**Warning signs:** Page shows a vertical scrollbar at the browser level, not just within the content area.

### Pitfall 2: Top Bar Stat Overflow at Narrow Viewports
**What goes wrong:** 5 stat pairs + time filters + utility buttons + New Trade button all in one h-16 row will overflow on md and sm screens.
**Why it happens:** Each stat group has a label + value + divider. At 5 stats that's ~300px before any controls.
**How to avoid:** Hide stats progressively with breakpoints (`hidden xl:flex` for less critical ones like Trades count). Time filter pills and utility group are higher priority than stat labels.
**Warning signs:** Stats wrapping below the bar or controls being cut off.

### Pitfall 3: WidgetCard `rounded-2xl` Missed Locations
**What goes wrong:** Some elements use `rounded-2xl` inline (not through WidgetCard) — e.g., the empty state div at line 1243, the hidden widgets panel at line 1270, the open trades wrapper at line 1292, the export dropdown at line 1141.
**Why it happens:** These were styled independently, not through `WidgetCard`.
**How to avoid:** grep for `rounded-2xl` in DashboardShell and update every occurrence to `rounded-md`. Also update `shadow-sm` removals.
**Warning signs:** Inconsistent rounding between different card-like elements on the dashboard.

### Pitfall 4: Daily Loss Warning Banner Loses its Style
**What goes wrong:** The warning banner currently uses `rounded-2xl border-red-500/30` — if only WidgetCard is updated, this outlier stays at `rounded-2xl`.
**Why it happens:** It's a standalone non-widget element with its own className.
**How to avoid:** Update it to `rounded-md` alongside WidgetCard changes.

### Pitfall 5: DnD Context Wrapping Scope
**What goes wrong:** `DndContext` currently wraps only the widget grid. Moving content inside a `flex-1 min-h-0 overflow-y-auto` div does not affect DnD — but if the container div scrolls, DnD drop zones remain correct because `rectSortingStrategy` recalculates from current DOM positions.
**Why it happens:** DnD uses `getBoundingClientRect` which accounts for scroll offset.
**How to avoid:** No change needed to DnD setup — just ensure the DndContext remains wrapping only the grid, not the entire page.

---

## Code Examples

### Current WidgetCard className to change
```tsx
// Source: DashboardShell.tsx line 246 — BEFORE
className={`rounded-2xl dark:bg-slate-800/50 bg-white p-3 flex flex-col shadow-sm ${spanClass}`}

// AFTER
className={`rounded-md border dark:border-slate-800 border-slate-200 dark:bg-slate-800/50 bg-white p-3 flex flex-col ${spanClass}`}
```

### Top bar outer container (from TradesShell.tsx line 243-245)
```tsx
// Source: components/trades/TradesShell.tsx line 243
<div className="flex flex-col -mx-6 -mt-6 -mb-6 overflow-hidden" style={{ height: "100vh" }}>
  <div className="px-6 flex items-center h-16 shrink-0 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100">
    {/* ... bar contents ... */}
  </div>
  {/* ... rest of content ... */}
```

### Scrollable content area pattern
```tsx
// Content area below the top bar
<div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
  {/* Weekly Calendar, widget grid, hidden panel, open trades */}
</div>
```

### Inline divider between stats (existing pattern at line 1175)
```tsx
// Source: DashboardShell.tsx line 1175 — reuse as-is
<div className="hidden sm:block w-px h-5 dark:bg-slate-700 bg-slate-200" />
```

### Hidden widgets panel — update from rounded-2xl to rounded-md
```tsx
// Source: DashboardShell.tsx line 1270 — BEFORE
<div className="rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-3 shadow-sm">

// AFTER
<div className="rounded-md border dark:border-slate-700 border-slate-200 dark:bg-slate-800/30 bg-slate-50 p-3">
```

### Hidden widget restore buttons — update from rounded-xl to rounded-md
```tsx
// Source: DashboardShell.tsx line 1275 — BEFORE
className="... rounded-xl border ..."

// AFTER
className="... rounded-md border ..."
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Page-level scroll (`space-y-6` root) | Viewport-locked flex shell (`h-screen flex flex-col`) | This phase | Eliminates browser-level scrollbar; content area scrolls independently |
| Separate account summary card below header | Account stats inline in h-16 top bar | This phase | Reclaims ~72px of vertical space for widget content |
| `rounded-2xl shadow-sm` cards | `rounded-md border` cards | This phase (aligns with Phase 24 trades page decision) | Unified design language between dashboard and trades page |
| Page title + subtitle as visible heading | Removed | This phase | Clean top bar replaces the need for a named heading |

**Deprecated/outdated in this phase:**
- `rounded-2xl` on WidgetCard — replaced with `rounded-md border`
- `shadow-sm` on WidgetCard and surrounding containers — replaced by border-based definition
- The account summary strip `<div className="rounded-2xl dark:bg-slate-900/80 ...">` — absorbed into top bar

---

## Open Questions

1. **Responsive stat visibility strategy (Claude's Discretion)**
   - What we know: 5 stats + controls must fit in h-16 at various breakpoints
   - What's unclear: Which stats to hide at md/lg breakpoints vs which to always show
   - Recommendation: Always show Balance and Win Rate (highest-value at a glance); hide Today P&L and Trades count below lg; hide P&L percentage suffix below xl

2. **Time filter pill style (Claude's Discretion)**
   - What we know: Current pills use `rounded-2xl` wrapper with `rounded-xl` inner buttons
   - What's unclear: Whether to keep that pill group style (which doesn't match `rounded-md` elsewhere) or switch to simpler flat buttons
   - Recommendation: Keep the pill group style — it's a UI control, not a card, and the rounded appearance distinguishes it from content cards. No change needed for visual consistency.

3. **New Trade button placement (Claude's Discretion)**
   - What we know: Current button is `rounded-2xl bg-emerald-600 h-10 px-5` — slightly oversized for a h-16 bar
   - What's unclear: Whether to keep it in the top bar or move it elsewhere
   - Recommendation: Keep in top bar, rightmost position — mirror TradesShell. Adjust to `h-9 px-4 rounded-md` to match the trades page button at TradesShell line 276.

---

## Sources

### Primary (HIGH confidence)
- `components/trades/TradesShell.tsx` (lines 243-283) — Direct reference implementation for the h-16 top bar pattern in this codebase
- `components/dashboard/DashboardShell.tsx` (full file) — Source of truth for all existing state, stats, and widget rendering
- CONTEXT.md (26-CONTEXT.md) — All locked decisions are project-authoritative

### Secondary (MEDIUM confidence)
- Tailwind CSS v3 flex documentation — `flex-1 min-h-0 overflow-y-auto` is the standard pattern for flex children that must scroll

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in the project, no new dependencies
- Architecture: HIGH — TradesShell is a proven in-codebase reference; pattern is directly transferable
- Pitfalls: HIGH — identified from reading current implementation line numbers and the TradesShell comparison

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable — no external dependencies)
