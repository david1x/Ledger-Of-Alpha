# Phase 25: Navbar Collapse Lock & Filter Bar Redesign - Research

**Researched:** 2026-03-21
**Domain:** React/Tailwind UI — sidebar state management, dropdown filter components, color cohesion
**Confidence:** HIGH

## Summary

This phase has three tightly-coupled visual concerns: (1) permanently collapse the sidebar to icon-only mode, (2) redesign the filter bar as a compact dropdown-button row, and (3) unify the sidebar and filter bar background colors into one visual frame.

The sidebar collapse mechanism is already fully built. The `expanded` state in `Navbar.tsx` drives a `data-sidebar` attribute on `<html>` which triggers CSS margin shifts via `.sidebar-push` classes in `globals.css`. Locking to collapsed mode means: removing the expand toggle button, deleting the `expanded` state entirely, and hard-coding `data-sidebar="collapsed"` permanently (it already starts there in `layout.tsx`). The icon-only layout (`showLabels = false`) is already implemented for all nav links, the account switcher, the user menu, and the TradingView link.

The `TradeFilterBar` is a flat `flex-wrap` row of heterogeneous inputs — a text input, inline button groups for Status and Direction, two date inputs, dropdown-pattern buttons for Tags/Mistakes/Account, and four preset buttons. The redesign converts every control into a uniform-height compact button that opens a dropdown panel. The Symbol field becomes a button opening a search input + scrollable checklist. Status, Direction, and PnlFilter become dropdown buttons replacing the inline radio-style groups. The Date range and quick presets (This Week, This Month) also become dropdown buttons. The wrapper div gets a background color and border to visually "frame" the bar.

Color cohesion: The sidebar uses `dark:bg-slate-950 bg-white` (the body background), with a `dark:border-slate-800 border-slate-200` right border. The TradesSidebar panels use `dark:bg-slate-800 bg-white`. The filter bar currently has no background (`flex-wrap items-center gap-3` with no bg class). The natural unifying color is `dark:bg-slate-900 bg-slate-100` — one step lighter/darker than the page body — applied to both the main sidebar and the filter bar wrapper.

**Primary recommendation:** Lock sidebar to `sm:w-16` always, add CSS-only `title`-attribute tooltips on nav icons (already partially in place), convert TradeFilterBar to a framed compact row of uniform dropdown buttons, apply `dark:bg-slate-900 bg-slate-100` to both sidebar and filter bar wrapper.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove the expand/collapse toggle — sidebar is permanently collapsed (icon-only mode)
- Add hover tooltips on each nav icon showing what it is (e.g., "Dashboard", "Trades", "Journal", etc.)
- Adjust sidebar background color slightly so it visually connects with the filter bar
- The filter bar should visually blend with the main sidebar — same or similar background color
- The filter bar should be "framed" (have a defined background/border) — currently it floats and looks misaligned
- All filter buttons/options must be the same height — currently inconsistent
- The free text search field should become a "Symbol" button that expands into a search field + symbol checklist dropdown
- All other filter options should follow the same pattern: compact button that expands to show options (dropdown pattern)
- Goal: minimize the filter bar footprint — everything starts as a compact button row

### Claude's Discretion
- Exact background colors for sidebar and filter bar (should be dark, cohesive)
- Tooltip implementation (CSS vs component)
- Dropdown animation/behavior
- How the symbol checklist works (multi-select with checkboxes)
- Whether the account switcher in the sidebar needs adjustment for always-collapsed mode

### Deferred Ideas (OUT OF SCOPE)
None — all items are in scope for this phase.
</user_constraints>

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18 (Next.js 15) | State, refs, effects for dropdown open/close | Already used throughout |
| Tailwind CSS v3 | v3 | All styling — bg colors, heights, transitions | Project convention |
| lucide-react | current | Icons for dropdown buttons (ChevronDown, Search, etc.) | Project convention |
| clsx | current | Conditional className composition | Used in Navbar.tsx already |

**No new dependencies required.** This is a pure Tailwind/React UI refactor.

---

## Architecture Patterns

### Recommended Project Structure (no changes needed)
The three components being modified:
```
components/
├── Navbar.tsx                    — sidebar lock + tooltip + color
└── trades/
    ├── TradeFilterBar.tsx        — full rewrite as dropdown-button row
    └── TradesShell.tsx           — filter bar wrapper framing
```

### Pattern 1: Sidebar Permanent Collapse

**What:** Remove `expanded` state and the toggle button entirely. The sidebar is always `sm:w-16` (icon-only).

**Current state analysis:**
- `expanded` state initialized from `localStorage.getItem("sidebar_expanded")`
- Persisted on change: `localStorage.setItem("sidebar_expanded", ...)`
- Drives `data-sidebar` attribute on `<html>` for `.sidebar-push` margin shifts
- Toggle button: `<button onClick={() => setExpanded(v => !v)} ...>` with `ChevronsLeft/ChevronsRight` icon
- `showLabels = expanded || mobileOpen` — with expanded always false, this reduces to `showLabels = mobileOpen`
- `html` in `layout.tsx` already has `data-sidebar="collapsed"` as default

**Changes needed:**
1. Remove `expanded` state and its `useEffect` (the one writing to localStorage and setting `data-sidebar`)
2. Remove the toggle `<button>` (the floating `-right-3` button)
3. The `data-sidebar` attribute in `layout.tsx` stays as `"collapsed"` — it never changes, so the CSS margin stays at `4rem` always
4. `showLabels` reduces to `mobileOpen` only
5. Remove `ChevronsLeft, ChevronsRight` from the lucide import list
6. Account switcher in collapsed mode: already has a `title` attribute fallback (`title={!showLabels ? ... : undefined}`), dropdown opens to the right (`left-14 top-0 w-52`) — this path is already correct for always-collapsed

**What to keep:**
- `mobileOpen` state and the mobile hamburger button — mobile still needs the full-width sidebar
- All `title={!showLabels ? label : undefined}` on nav links (these are the existing native `title` tooltips)

### Pattern 2: Nav Icon Tooltips

**What:** Hover tooltips on each nav icon. Currently, every nav link already has `title={!showLabels ? label : undefined}` which renders native browser tooltips. This is sufficient for the locked-collapsed case but native tooltips have inconsistent styling and a ~1s delay.

**Decision area (Claude's discretion):** The existing `Tooltip.tsx` component uses hover state + absolute positioning. It is designed for inline use (`<span>` wrapper). For sidebar nav items it would need the tooltip positioned to the right of the icon (not top/bottom).

**Recommended approach:** CSS-only custom tooltip using a sibling/pseudo element pattern, or a small inline tooltip component that positions to the right. Since the project already has `Tooltip.tsx` but it positions top/bottom, the cleanest approach is a simple `title` attribute upgrade with a custom CSS tooltip.

**Simplest pattern that fits the project's "no unnecessary abstractions" convention:**
```tsx
// Keep existing title= attribute on each nav link (already present)
// Optionally: add a small NavTooltip that renders right-side positioned label
// The title= approach already works and matches convention
```

If custom tooltip is desired, a minimal inline approach:
```tsx
// Inside each nav link, when collapsed:
<div className="relative group">
  <Icon className="w-5 h-5 shrink-0" />
  <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium
    dark:bg-slate-800 bg-slate-100 dark:text-white text-slate-900 rounded-md whitespace-nowrap
    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
    {label}
  </span>
</div>
```
This requires changing `<Link>` elements to have `relative group` and the inner layout adjusted. Since `<Link>` itself can have `relative group` classes, this is straightforward.

**Important:** The `group-hover` pattern on `<Link>` requires the `relative` class on the link itself (already present via flex/padding classes) and `group` added.

### Pattern 3: TradeFilterBar Redesign

**What:** Every filter control becomes a uniform-height compact button that opens a dropdown. All buttons same height (recommend `h-9`).

**Current filter inventory:**
| Filter | Current UI | New UI |
|--------|-----------|--------|
| Symbol | Text input (`h-9`, `pl-9`) | Button → dropdown (search input + symbol checklist) |
| Status | Inline button group (All/Planned/Open/Closed) | Single "Status" button → dropdown with 4 options |
| Direction | Inline button group (All/Long/Short) | Single "Direction" button → dropdown with 3 options |
| Date range | Two date inputs + Calendar icon | "Date" button → dropdown with from/to date inputs + preset links |
| Tags | Dropdown button (already pattern-compliant) | Keep pattern, unify height/style |
| Mistakes | Dropdown button (already pattern-compliant) | Keep pattern, unify height/style |
| Account | Dropdown button (already pattern-compliant) | Keep pattern, unify height/style |
| Winners/Losers | Two standalone buttons | Fold into a "P&L" dropdown with All/Winners/Losers options |
| This Week/This Month | Two standalone preset buttons | Fold into Date dropdown as quick-select options |

**Symbol checklist pattern:**
- Extract distinct symbols from `allTrades` (similar to how `allTags` is derived)
- Dropdown contains: search `<input>` at top + scrollable list of checkboxes
- Multi-select: `filter.symbol` is currently a string used for `.includes()` substring match
- **Option A (minimal change):** Keep `symbol: string` in filter state, the checklist filters the list but selecting a symbol sets the string value. Single-select.
- **Option B (new multi-select):** Add `symbols: string[]` to `TradeFilterState` and update `applyFilter` in `TradesShell` accordingly. More correct for multi-select UX.
- **Recommendation:** Option A (single-select, sets `filter.symbol`) keeps the diff small. The button label shows the selected symbol or "Symbol" when empty.

**Uniform button style:**
```tsx
const DROPDOWN_BTN = (active: boolean) =>
  `h-9 px-3 flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
    active
      ? "bg-emerald-500/20 text-emerald-400"
      : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-200/60 dark:bg-slate-800/40 bg-slate-200/40"
  }`;
```

**Dropdown close behavior:** Each dropdown uses the existing `useRef` + `useEffect` + `document.addEventListener("mousedown", ...)` pattern already in `TradeFilterBar.tsx`. One `openDropdown: string | null` state (replacing the 3 separate booleans) can manage mutual exclusivity cleanly.

### Pattern 4: Filter Bar Framing + Color Cohesion

**What:** The filter bar wrapper gets a background color and subtle border/padding so it reads as a "frame" visually connected to the sidebar.

**Current sidebar colors:**
- `dark:bg-slate-950 bg-white` on the `<aside>` — very dark (same as body background)
- `dark:border-slate-800 border-slate-200` on the right border
- TradesSidebar panels: `dark:bg-slate-800 bg-white`

**Current filter bar:** No background, no border — floats on top of the `dark:bg-slate-950` page body.

**Recommended color:**
- Sidebar: change from `dark:bg-slate-950` to `dark:bg-slate-900` (one step lighter, creates a visible sidebar shape)
- Filter bar wrapper: `dark:bg-slate-900 bg-slate-100` with `rounded-lg px-3 py-2` and subtle `dark:border-slate-800/50 border-slate-200` border

This creates a visual throughline: sidebar left edge (`slate-900`) → filter bar top of content area (`slate-900`). They share the same "frame" color and feel connected even though they're separate elements.

**Alternative:** `dark:bg-slate-800/60` for the filter bar wrapper only, keeping sidebar at `slate-950`. This separates the two more but still frames the filter bar. Slightly less cohesive.

**Recommendation:** Change sidebar bg to `dark:bg-slate-900` and filter bar to `dark:bg-slate-900 bg-slate-100`.

### Filter Bar Positioning in TradesShell

**Current layout in TradesShell:**
```tsx
<div className="flex items-start gap-3">
  <div className="flex-1 min-w-0">
    <TradeFilterBar ... />
  </div>
  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
    {/* Import/Export + New Trade button */}
  </div>
</div>
```

The framing background needs to go on the `TradeFilterBar` wrapper div inside `TradeFilterBar.tsx` itself (the root `<div>`), not on the outer row in `TradesShell`. This keeps the action buttons (Import/Export, New Trade) outside the frame — they are not filters.

### Anti-Patterns to Avoid

- **Don't add `expanded` state back:** The sidebar is locked. Any feature that reads `expanded` state (none currently do outside Navbar.tsx) should be audited.
- **Don't merge the mobile hamburger with the collapse toggle:** Mobile still needs full-width expansion. The `mobileOpen` state is separate from `expanded` and must be preserved.
- **Don't use one `useState` for all dropdowns with a string key and then conditionally render:** The current per-dropdown refs are needed for outside-click handling. A `openDropdown` string state works for open/close but each dropdown still needs its own `ref` for click detection.
- **Don't make the Symbol checklist lazy-loaded:** Symbols come from `allTrades` which is already in memory. Derive them like `allTags` — no async fetch needed.
- **Don't remove `title` attribute fallbacks:** Even if custom tooltips are added, keep `title` for accessibility.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outside-click to close dropdown | Custom event system | `useRef` + `document.addEventListener("mousedown")` | Already used in TradeFilterBar for Tags/Mistakes/Account dropdowns |
| Tooltip positioning | Auto-positioning logic | CSS `group-hover` + `left-full ml-3` positioning | Sidebar is always at left edge — right-side tooltip is always correct |
| Symbol list derivation | API fetch | `useMemo` over `allTrades` (already in memory) | Same pattern as `allTags` derivation already in the file |

---

## Common Pitfalls

### Pitfall 1: Sidebar Expansion State Still Referenced After Removal
**What goes wrong:** `expanded` state drives `showLabels = expanded || mobileOpen`. After removing `expanded`, the `data-sidebar` attribute will no longer be toggled — but it starts as `"collapsed"` in `layout.tsx` and never changes. The CSS margin stays at `4rem`. This is correct behavior. However, if any other component reads `localStorage.getItem("sidebar_expanded")`, it will still get the old value until cleared.
**How to avoid:** Remove all three occurrences in Navbar.tsx: the `useState`, the two `useEffect` hooks that read/write it, and the toggle button. Also remove `localStorage.setItem("sidebar_expanded", ...)` to stop persisting it.
**Warning signs:** If `data-sidebar` is not being set to `"collapsed"` on load, the main content will have no left margin. Check that `layout.tsx` `<html data-sidebar="collapsed">` is intact.

### Pitfall 2: Account Switcher Dropdown Positioning in Collapsed Mode
**What goes wrong:** The account switcher dropdown uses `left-14 top-0 w-52` positioning when collapsed (a flyout to the right). This is already implemented and correct. After the sidebar is permanently collapsed, this path is always taken. Verify it still opens correctly when sidebar has `dark:bg-slate-900` (the dropdown itself has `dark:bg-slate-900` already).
**How to avoid:** Test the account switcher with the new sidebar bg color — there should be no visual blending issue since the dropdown has a `border` and `shadow-2xl`.

### Pitfall 3: Date Inputs Inside a Dropdown
**What goes wrong:** `<input type="date">` inside a dropdown panel can cause the dropdown to close due to outside-click detection if the date picker's native UI extends outside the `ref`'d container.
**How to avoid:** Use the existing pattern (mousedown on document → check `ref.current.contains(e.target)`). The native date picker for `type="date"` fires events on the input itself, not outside the container. On desktop browsers this is safe. The existing date inputs use this same pattern in the filter bar.

### Pitfall 4: Filter Bar Height Regression on Mobile
**What goes wrong:** The filter bar currently uses `flex-wrap` which allows it to reflow onto multiple lines on mobile. Converting to compact buttons may break responsive layout if buttons overflow the container.
**How to avoid:** Keep `flex-wrap` on the outer container. The compact buttons are smaller than the current controls, so wrapping will be less frequent, not more. The `TradeFilterChips` row below the filter bar handles the active filter display.

### Pitfall 5: `showLabels` Used After `expanded` Removal
**What goes wrong:** `showLabels = expanded || mobileOpen` — after removing `expanded`, this becomes `showLabels = mobileOpen`. The logo text, nav labels, account name, and user name are all gated on `showLabels`. In desktop mode they will always be hidden (correct). In mobile mode (`mobileOpen = true`) they will show (correct). This is the desired behavior.
**Warning signs:** If nav labels appear on desktop after the change, `showLabels` still has `expanded` in its expression.

### Pitfall 6: Tooltip Overlapping Other Sidebar Elements
**What goes wrong:** `group-hover` tooltips positioned `left-full ml-3` will overlap the page content which starts 4rem (64px) from the left. The sidebar is 64px wide. A `left-full` tooltip on a sidebar icon would appear at approximately `x=64` which is right at the content edge.
**How to avoid:** Add `z-50` and a shadow to the tooltip. The tooltip is `pointer-events-none` so it will not interfere with content interaction. A `z-50` is sufficient since the sidebar has `z-40`.

---

## Code Examples

### Sidebar — Collapse Lock (Navbar.tsx changes)

```tsx
// REMOVE these lines:
const [expanded, setExpanded] = useState(false);
// REMOVE the useEffect that reads localStorage.getItem("sidebar_expanded")
// REMOVE the useEffect that writes localStorage.setItem("sidebar_expanded") and sets data-sidebar attribute
// REMOVE the toggle button JSX (the -right-3 floating button)

// CHANGE showLabels to:
const showLabels = mobileOpen; // was: expanded || mobileOpen

// CHANGE aside className to (remove sm:w-64 conditional):
<aside className={clsx(
  "fixed top-0 left-0 bottom-0 z-40 flex flex-col border-r dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-100 transition-all duration-300",
  mobileOpen ? "max-sm:translate-x-0 w-64" : "max-sm:-translate-x-full w-64",
  "sm:w-16", // always collapsed on desktop
)}>
```

### Nav Icon Tooltip (group-hover CSS pattern)

```tsx
// In sidebarLinks map — change the Link to use group:
<Link
  key={href}
  href={href}
  onClick={() => setMobileOpen(false)}
  className={clsx(
    "relative group flex items-center py-3 text-sm font-medium transition-colors whitespace-nowrap",
    showLabels ? "gap-3 pl-5 pr-4" : "justify-center px-0",
    active ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-400"
           : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 hover:dark:bg-slate-800/50 hover:bg-slate-100"
  )}
>
  <Icon className="w-5 h-5 shrink-0" />
  {showLabels && <span>{label}</span>}
  {!showLabels && (
    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-xs font-medium rounded-md dark:bg-slate-800 bg-white dark:text-white text-slate-900 shadow-lg border dark:border-slate-700 border-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
      {label}
    </span>
  )}
</Link>
```

### Dropdown Button Base Style

```tsx
// In TradeFilterBar.tsx — replace FILTER_BTN with:
const DROPDOWN_BTN = (active: boolean) =>
  `h-9 px-3 flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
    active
      ? "bg-emerald-500/20 text-emerald-400"
      : "dark:text-slate-400 text-slate-500 hover:dark:bg-slate-800 hover:bg-slate-200/60 dark:bg-slate-800/40 bg-slate-200/40"
  }`;
```

### Symbol Button with Checklist Dropdown

```tsx
// Derive symbols from allTrades (add alongside allTags useMemo):
const allSymbols = useMemo(() => {
  const set = new Set<string>();
  allTrades.forEach(t => { if (t.symbol) set.add(t.symbol.toUpperCase()); });
  return Array.from(set).sort();
}, [allTrades]);

// Symbol dropdown state:
const [symbolSearch, setSymbolSearch] = useState("");
const filteredSymbols = symbolSearch
  ? allSymbols.filter(s => s.includes(symbolSearch.toUpperCase()))
  : allSymbols;

// Button + dropdown:
<div className="relative" ref={symbolMenuRef}>
  <button
    onClick={() => setOpenDropdown(p => p === "symbol" ? null : "symbol")}
    className={DROPDOWN_BTN(!!filter.symbol || openDropdown === "symbol")}
  >
    <Search className="w-4 h-4" />
    {filter.symbol || "Symbol"}
    {filter.symbol && <X className="w-3.5 h-3.5" onClick={(e) => { e.stopPropagation(); onFilterChange({ symbol: "" }); }} />}
    <ChevronDown className="w-3.5 h-3.5" />
  </button>
  {openDropdown === "symbol" && (
    <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md dark:bg-slate-800 bg-white shadow-xl border dark:border-slate-700 border-slate-200">
      <div className="p-2 border-b dark:border-slate-700 border-slate-200">
        <input
          autoFocus
          type="text"
          value={symbolSearch}
          onChange={e => setSymbolSearch(e.target.value.toUpperCase())}
          placeholder="Search symbols..."
          className="w-full px-2 py-1.5 text-sm rounded dark:bg-slate-700 bg-slate-100 dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filteredSymbols.map(sym => (
          <button
            key={sym}
            onClick={() => { onFilterChange({ symbol: sym }); setOpenDropdown(null); setSymbolSearch(""); }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${
              filter.symbol === sym
                ? "bg-emerald-500/10 text-emerald-400"
                : "dark:text-slate-300 text-slate-700 hover:dark:bg-slate-700/50 hover:bg-slate-50"
            }`}
          >
            {sym}
          </button>
        ))}
        {filteredSymbols.length === 0 && (
          <p className="px-3 py-2 text-xs dark:text-slate-500 text-slate-400">No matches</p>
        )}
      </div>
    </div>
  )}
</div>
```

### Filter Bar Wrapper Framing (TradeFilterBar root div)

```tsx
// Replace the root <div className="flex flex-wrap items-center gap-3">
// with a framed wrapper:
<div className="dark:bg-slate-900 bg-slate-100 rounded-lg px-3 py-2.5 border dark:border-slate-800/60 border-slate-200/80">
  <div className="flex flex-wrap items-center gap-2">
    {/* ... all filter buttons ... */}
  </div>
</div>
```

### Unified Dropdown State (replacing 3+ separate booleans)

```tsx
// Replace showTagsMenu, showMistakesMenu, showAccountMenu with:
const [openDropdown, setOpenDropdown] = useState<string | null>(null);

// Each dropdown button:
onClick={() => setOpenDropdown(p => p === "tags" ? null : "tags")}
// Show panel:
{openDropdown === "tags" && (...)}

// Outside-click handler (one shared handler):
useEffect(() => {
  if (!openDropdown) return;
  const handler = (e: MouseEvent) => {
    // check each ref — close if click is outside all of them
    const allRefs = [symbolMenuRef, statusMenuRef, directionMenuRef, dateMenuRef, tagsMenuRef, mistakesMenuRef, accountMenuRef, pnlMenuRef];
    const clickedInside = allRefs.some(r => r.current?.contains(e.target as Node));
    if (!clickedInside) setOpenDropdown(null);
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [openDropdown]);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Multiple `showXMenu` booleans | Single `openDropdown: string | null` | Mutual exclusivity of dropdowns is automatic |
| `expanded` state with localStorage | Remove entirely | Sidebar is locked, no state needed |
| Native `title` attribute tooltips | CSS `group-hover` tooltip span | Custom styling, no delay, consistent positioning |
| Flat filter row with mixed input types | Uniform dropdown buttons | All controls same height, compact footprint |

---

## Open Questions

1. **Symbol filter: single-select or multi-select?**
   - What we know: `filter.symbol: string` is used for `.includes()` substring match in `applyFilter`. The current input allows freetext partial match.
   - What's unclear: Whether user wants to filter by multiple symbols simultaneously (e.g., "show trades in AAPL and TSLA").
   - Recommendation: Single-select from checklist (sets `filter.symbol` to exact match). This is the simplest change. Multi-select would require adding `symbols: string[]` to `TradeFilterState` and updating `applyFilter` — scope that to a future phase if needed.

2. **Filter chips: do they need updating after filter bar redesign?**
   - What we know: `TradeFilterChips` displays active filters as dismissible pills. It reads `filter.symbol` and all other fields. If symbol becomes a dropdown (exact match), the chip label `Symbol: ${filter.symbol}` still works correctly.
   - What's unclear: Nothing — no changes needed to `TradeFilterChips`.
   - Recommendation: No changes to `TradeFilterChips`.

3. **Account switcher in collapsed mode: tooltip needed?**
   - What we know: The Wallet button already has `title={!showLabels ? (activeAccount?.name ?? "All Accounts") : undefined}`. With the sidebar always collapsed, this always shows.
   - Recommendation: Apply the same `group-hover` tooltip pattern used for nav links for consistency.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `components/Navbar.tsx` — full sidebar state machine, toggle button, `showLabels` logic, account switcher
- Direct code read: `components/trades/TradeFilterBar.tsx` — all filter controls, their types, dropdown patterns
- Direct code read: `components/trades/TradesShell.tsx` — filter bar placement, wrapper structure, action buttons
- Direct code read: `app/globals.css` — `.sidebar-push` / `.sidebar-push-fixed` CSS, `data-sidebar` attribute usage
- Direct code read: `app/layout.tsx` — `<html data-sidebar="collapsed">` default, `sidebar-push` class on `<main>`
- Direct code read: `lib/types.ts` — `TradeFilterState` interface, `DEFAULT_FILTER` values
- Direct code read: `components/Tooltip.tsx` — existing tooltip implementation
- Direct code read: `components/trades/TradeFilterChips.tsx` — chip rendering for all filter fields

### Secondary (MEDIUM confidence)
- Tailwind CSS v3 `group` / `group-hover` pattern — standard documented feature, widely used

---

## Metadata

**Confidence breakdown:**
- Sidebar collapse lock: HIGH — code fully read, changes are surgical removals
- Tooltip pattern: HIGH — CSS group-hover is well-understood in this codebase
- Filter bar redesign: HIGH — all existing patterns read from source, no new libraries
- Color cohesion: HIGH — color palette is Tailwind slate scale, choices are from existing scale

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase, no external dependencies)
