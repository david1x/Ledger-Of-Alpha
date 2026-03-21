# Phase 19: TradesShell Refactor - Research

**Researched:** 2026-03-21
**Domain:** React component architecture, Next.js App Router, TypeScript state management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extract import/export logic (~140 lines) into a dedicated `TradeImportExport` component. Shell passes an `onTradesChanged` callback.
- Remove `FilteredSummary` entirely (P&L/win rate strip below table). Phase 21 will build a proper Summary Stats Bar to replace it.
- Wire the full `TradeFilterState` type from `lib/types.ts` from the start, including fields without UI controls yet (`mistakeId`, `tags`, `dateFrom`, `dateTo`, `pnlFilter`). Unused fields use `DEFAULT_FILTER` values. Phase 20 just adds UI controls.
- Filter persistence: per-session (survives page navigation, resets on browser close). User wants sessionStorage or equivalent.
- Account switching: reloads trade data without resetting any active filter state.
- Privacy mode: centralize in a context provider (not per-page localStorage). All pages that use privacy mode should consume from context.

### Claude's Discretion
- Filter bar extraction timing (now vs Phase 20)
- Header extraction vs inline
- Data fetching architecture (centralized vs distributed)
- Re-fetch vs optimistic updates
- Custom hook vs inline state
- Sidebar slot pre-creation for Phase 23
- Component file organization (`components/trades/` vs flat)
- Page wrapper pattern (thin `page.tsx` importing `TradesShell` vs all-in-one)
- Filter application logic location (where the `.filter()` chain lives)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-05 | User can see active filters as dismissible chips with individual clear | `TradeFilterState` already in `lib/types.ts`; filter chip rendering requires knowing which fields are non-default; `DEFAULT_FILTER` constant provides the comparison baseline |
| FILT-06 | User can clear all active filters at once | Single `setFilter(DEFAULT_FILTER)` call resets all state; "Clear all" button visible only when `filter !== DEFAULT_FILTER` |
</phase_requirements>

## Summary

Phase 19 is a pure refactor of `app/trades/page.tsx` — a 588-line monolith — into a clean component tree. No net-new user features are added except FILT-05 and FILT-06 (filter chips with individual dismiss + clear-all), which require the unified `TradeFilterState` type and chip rendering infrastructure.

The core technical work is: (1) creating `TradesShell` as a dedicated component following the `DashboardShell` pattern already established, (2) extracting `TradeImportExport` from the header area, (3) wiring `TradeFilterState` / `DEFAULT_FILTER` from `lib/types.ts` (already defined), (4) adding `PrivacyContext` to `lib/` and wrapping it in `app/layout.tsx` alongside `AccountProvider`, and (5) using `sessionStorage` for filter persistence.

All the types, hooks, and sub-components this phase needs already exist in the codebase. The main risk is regressions in the existing filter/load/quote/column-persistence flow during the restructure.

**Primary recommendation:** Follow the DashboardShell pattern — thin `app/trades/page.tsx` imports `TradesShell` from `components/trades/`. Create `PrivacyContext` in `lib/privacy-context.tsx` mirroring the shape of `account-context.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (built-in) | 18 (via Next.js 15) | useState, useEffect, useContext, useRef | Already in use everywhere |
| Next.js App Router | 15 | `app/trades/page.tsx` thin wrapper | Established project pattern |
| TypeScript | (project TS) | `TradeFilterState`, `DEFAULT_FILTER` already typed | All components are typed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sessionStorage (browser API) | N/A | Per-session filter persistence | Survives navigation, clears on tab close |
| `useAccounts` hook | project | Provides `activeAccountId` for data reload trigger | Already imported in trades page |
| lucide-react | project | X icon for chip dismiss buttons | Project standard for all icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sessionStorage for filter | URL search params | URL params are more shareable but user explicitly chose session-only; URL params also require router integration |
| sessionStorage for filter | React state only (no persistence) | Pure React state resets on navigation; user wants persistence across page nav |
| Context provider for privacy | Per-component localStorage | Per-component pattern is the current (broken) approach — leads to duplicated boilerplate across trades/journal/dashboard |

**Installation:** No new packages needed. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
app/trades/
└── page.tsx               # Thin wrapper: "use client"; export default TradesShell

components/trades/
├── TradesShell.tsx         # Main orchestrator (~200 lines after extraction)
├── TradeImportExport.tsx   # Import/export logic extracted from header (~140 lines)
└── TradeFilterChips.tsx    # FILT-05/06: filter chip strip + clear-all button

lib/
├── privacy-context.tsx     # NEW: PrivacyContext + PrivacyProvider + usePrivacy hook
└── types.ts                # TradeFilterState + DEFAULT_FILTER already here
```

### Pattern 1: Thin Page Wrapper (DashboardShell Pattern)
**What:** `app/trades/page.tsx` becomes a 3-line file that re-exports `TradesShell`
**When to use:** Always — this is the established project convention
**Example:**
```typescript
// app/trades/page.tsx
"use client";
import TradesShell from "@/components/trades/TradesShell";
export default function TradesPage() {
  return <TradesShell />;
}
```

### Pattern 2: TradesShell as Orchestrator
**What:** `TradesShell` owns all state — filter, trades data, quotes, UI modals — and passes data + callbacks to children
**When to use:** Centralized state makes account-switch-without-filter-reset straightforward: `activeAccountId` change triggers data reload, filter state is separate `useState`
**Example:**
```typescript
// components/trades/TradesShell.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { TradeFilterState, DEFAULT_FILTER, Trade, QuoteMap } from "@/lib/types";
import { useAccounts } from "@/lib/account-context";
import { usePrivacy } from "@/lib/privacy-context";

export default function TradesShell() {
  const { activeAccountId, activeAccount, accounts } = useAccounts();
  const { hidden, setHidden } = usePrivacy();
  const [filter, setFilter] = useState<TradeFilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTER;
    try {
      const saved = sessionStorage.getItem("trades_filter");
      return saved ? { ...DEFAULT_FILTER, ...JSON.parse(saved) } : DEFAULT_FILTER;
    } catch { return DEFAULT_FILTER; }
  });
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  // ... rest of state

  // Persist filter on change
  useEffect(() => {
    sessionStorage.setItem("trades_filter", JSON.stringify(filter));
  }, [filter]);

  // Reload trades when account changes — filter state untouched
  useEffect(() => { loadTrades(); }, [activeAccountId, accounts.length]);

  const filteredTrades = applyFilter(allTrades, filter);
  // ...
}
```

### Pattern 3: PrivacyContext (mirrors AccountProvider pattern)
**What:** Context provider in `lib/privacy-context.tsx` that owns the `hidden` boolean, reads/writes `localStorage`, and listens for `StorageEvent` cross-tab sync
**When to use:** Any component that needs `hidden` state — currently trades page, journal page, DashboardShell
**Example:**
```typescript
// lib/privacy-context.tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PrivacyContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}
const PrivacyContext = createContext<PrivacyContextValue>({ hidden: false, toggleHidden: () => {} });

export function usePrivacy() { return useContext(PrivacyContext); }

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("privacy_hidden");
    if (saved !== null) setHidden(saved === "true");
    const handler = (e: StorageEvent) => {
      if (e.key === "privacy_hidden") setHidden(e.newValue === "true");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden(prev => {
      const next = !prev;
      localStorage.setItem("privacy_hidden", String(next));
      return next;
    });
  }, []);

  return <PrivacyContext.Provider value={{ hidden, toggleHidden }}>{children}</PrivacyContext.Provider>;
}
```

Add `<PrivacyProvider>` inside `<AccountProvider>` in `app/layout.tsx`.

### Pattern 4: Filter Application — Pure Function
**What:** Extract `applyFilter(trades, filter)` as a pure helper function inside `TradesShell.tsx` (or a `lib/filter-trades.ts` file)
**When to use:** Centralizing the filter chain in one place makes Phase 20 filter additions a single-file edit
**Example:**
```typescript
function applyFilter(trades: Trade[], filter: TradeFilterState): Trade[] {
  return trades.filter(t => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.direction !== "all" && t.direction !== filter.direction) return false;
    if (filter.symbol && !t.symbol.toUpperCase().includes(filter.symbol.toUpperCase())) return false;
    if (filter.pnlFilter === "winners" && (t.pnl ?? 0) <= 0) return false;
    if (filter.pnlFilter === "losers" && (t.pnl ?? 0) >= 0) return false;
    if (filter.dateFrom && t.exit_date && t.exit_date < filter.dateFrom) return false;
    if (filter.dateTo && t.exit_date && t.exit_date > filter.dateTo) return false;
    if (filter.mistakeId) { /* Phase 22 will populate trade_mistake_tags; skip for now */ }
    if (filter.tags.length > 0) { /* Phase 20 will wire tag filter UI; skip for now */ }
    return true;
  });
}
```

### Pattern 5: TradeFilterChips (FILT-05 / FILT-06)
**What:** A component that renders dismissible chips for each non-default filter field, plus a "Clear all" button
**When to use:** Rendered below the filter bar area; only visible when at least one filter differs from DEFAULT_FILTER
**Example:**
```typescript
// components/trades/TradeFilterChips.tsx
interface Props {
  filter: TradeFilterState;
  onClear: (field: keyof TradeFilterState) => void;
  onClearAll: () => void;
}

export default function TradeFilterChips({ filter, onClear, onClearAll }: Props) {
  const chips: { label: string; field: keyof TradeFilterState }[] = [];
  if (filter.symbol) chips.push({ label: `Symbol: ${filter.symbol}`, field: "symbol" });
  if (filter.status !== "all") chips.push({ label: `Status: ${filter.status}`, field: "status" });
  if (filter.direction !== "all") chips.push({ label: `Direction: ${filter.direction}`, field: "direction" });
  if (filter.pnlFilter !== "all") chips.push({ label: filter.pnlFilter === "winners" ? "Winners only" : "Losers only", field: "pnlFilter" });
  if (filter.dateFrom) chips.push({ label: `From: ${filter.dateFrom}`, field: "dateFrom" });
  if (filter.dateTo) chips.push({ label: `To: ${filter.dateTo}`, field: "dateTo" });
  if (filter.mistakeId) chips.push({ label: "Mistake filter", field: "mistakeId" });
  // tags handled as group chip

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(chip => (
        <span key={chip.field} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {chip.label}
          <button onClick={() => onClear(chip.field)} className="hover:text-white transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs text-slate-400 hover:text-white transition-colors underline">
        Clear all
      </button>
    </div>
  );
}
```

### Pattern 6: TradeImportExport Extraction
**What:** Move all import/export state and handlers from TradesPage into a self-contained `TradeImportExport` component
**When to use:** Receives `onTradesChanged: () => void` callback; calls it after successful import to trigger re-fetch
**State owned internally:** `importResult`, `importing`, `showImportMenu`, `showExportMenu`
**Props interface:**
```typescript
interface TradeImportExportProps {
  activeAccountId: string | null;
  onTradesChanged: () => void;
}
```

### Anti-Patterns to Avoid
- **Splitting filter state across components:** Filter state must live in TradesShell (owner), not in the filter bar child component. Children receive `filter` + `onFilterChange` props.
- **Re-fetching on every filter change:** Filtering is client-side. Only fetch when `activeAccountId` or `accounts.length` changes.
- **Duplicating privacy localStorage logic:** The whole point of PrivacyContext is one place for this. Don't add `localStorage.getItem("privacy_hidden")` calls anywhere in TradesShell.
- **Initializing sessionStorage on server:** `typeof window === "undefined"` guard required; Next.js renders components on server first.
- **Forgetting the `privacy_mode` settings fallback:** The current page reads `settingsData.privacy_mode` as a fallback when localStorage is null. This logic should move into `PrivacyProvider` initial load or be dropped (the settings-based fallback is edge-case complexity).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab privacy sync | Custom event system | Native `StorageEvent` on `window` | Browser fires this automatically when localStorage changes in another tab |
| Filter state type | Ad-hoc object | `TradeFilterState` + `DEFAULT_FILTER` from `lib/types.ts` | Already defined, correctly typed, used by Phase 20+ |
| Column persistence | Custom serializer | Existing `/api/settings` PUT with `trade_table_columns` key | Already wired and working in current page — preserve exactly |
| Account-aware data fetch | Custom account resolver | `useAccounts()` from `lib/account-context.tsx` | Provides `activeAccountId`, already handles null = All Accounts |
| File download | Custom stream | `URL.createObjectURL` + `<a>` click pattern | Already working in current `exportTrades()` — copy into `TradeImportExport` |

**Key insight:** This refactor is a decomposition task, not a rebuild. Almost every implementation detail already exists in the 588-line monolith — the work is moving code into the right files and replacing ad-hoc state with typed structures.

## Common Pitfalls

### Pitfall 1: sessionStorage lazy initializer SSR crash
**What goes wrong:** `sessionStorage.getItem(...)` called during server-side render throws `ReferenceError: sessionStorage is not defined`
**Why it happens:** Next.js renders all `"use client"` components on the server for HTML generation; `sessionStorage` doesn't exist in Node
**How to avoid:** Use lazy `useState` initializer with `typeof window === "undefined"` guard:
```typescript
const [filter, setFilter] = useState<TradeFilterState>(() => {
  if (typeof window === "undefined") return DEFAULT_FILTER;
  try {
    const saved = sessionStorage.getItem("trades_filter");
    return saved ? { ...DEFAULT_FILTER, ...JSON.parse(saved) } : DEFAULT_FILTER;
  } catch { return DEFAULT_FILTER; }
});
```
**Warning signs:** Build succeeds but page crashes with hydration mismatch or server error on first load.

### Pitfall 2: Account switch resets filter state
**What goes wrong:** Placing filter state inside the `useEffect` that also fires on `activeAccountId` change causes filter to reset on account switch
**Why it happens:** `useEffect(() => { setFilter(DEFAULT_FILTER); load(); }, [activeAccountId])` — filters reset as side effect
**How to avoid:** Keep data fetch and filter state in separate `useEffect`s. `activeAccountId` change only triggers `loadTrades()`; filter state is never touched by the account effect.
**Warning signs:** Switching accounts clears the symbol search or status filter.

### Pitfall 3: Privacy mode initial flash
**What goes wrong:** Page renders with `hidden = false` (default), then flickers to `hidden = true` after `useEffect` reads localStorage
**Why it happens:** `useEffect` runs after first paint; localStorage read happens too late
**How to avoid:** Initialize `PrivacyProvider` state with a lazy initializer that reads `localStorage` synchronously (safe in provider since it only runs client-side after hydration):
```typescript
const [hidden, setHidden] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("privacy_hidden") === "true";
});
```
**Warning signs:** Numbers flash visible briefly before masking on page load.

### Pitfall 4: DashboardShell privacy duplication after context migration
**What goes wrong:** After adding `PrivacyProvider`, `DashboardShell.tsx` still has its own `privacy_hidden` localStorage read/write and `StorageEvent` listener
**Why it happens:** The migration touches trades page but forgets to update DashboardShell and journal page
**How to avoid:** This phase creates `PrivacyContext` and migrates `app/trades/page.tsx` to it. DashboardShell and journal page should also be migrated in this same phase (they're small changes: replace 15-line privacy blocks with `const { hidden, toggleHidden } = usePrivacy()`).
**Warning signs:** Privacy toggle on dashboard no longer syncs with trades page toggle.

### Pitfall 5: Stale column persistence after component split
**What goes wrong:** Column visibility settings stop persisting after refactor because the `me` (user auth) state or the `saveColumns` function is no longer correctly wired
**Why it happens:** `saveColumns` requires `me` (guest check) and makes a PUT to `/api/settings`. If this moves into a sub-component without the `me` state being passed down, it silently stops saving for guest users.
**How to avoid:** Keep `visibleColumns` and `saveColumns` in `TradesShell` where `me` state lives, or pass `isGuest` as a prop to any component that needs it.

### Pitfall 6: FILT-05/06 "isFiltered" detection
**What goes wrong:** Using a simple boolean `isFiltered` instead of per-field comparison means dismissing individual chips is impossible
**Why it happens:** The old code only needed a single "is anything filtered?" boolean for the `FilteredSummary` label
**How to avoid:** Compare each field against `DEFAULT_FILTER` to generate the chips array. Individual clear handler receives the field key and resets that field to its default value:
```typescript
const clearField = (field: keyof TradeFilterState) => {
  setFilter(prev => ({ ...prev, [field]: DEFAULT_FILTER[field] }));
};
```

## Code Examples

Verified patterns from existing codebase:

### Existing filter application (current monolith, lines 162-167)
```typescript
// Source: app/trades/page.tsx (current)
const trades = allTrades.filter(t => {
  if (status !== "all" && t.status !== status) return false;
  if (direction !== "all" && t.direction !== direction) return false;
  if (symbolQ && !t.symbol.toUpperCase().includes(symbolQ.toUpperCase())) return false;
  return true;
});
```
This maps to `filter.status`, `filter.direction`, `filter.symbol` in `TradeFilterState`.

### TradeFilterState type (already in lib/types.ts, lines 165-187)
```typescript
// Source: lib/types.ts
export interface TradeFilterState {
  symbol: string;
  status: "all" | "planned" | "open" | "closed";
  direction: "all" | "long" | "short";
  mistakeId: string | null;
  tags: string[];
  dateFrom: string | null;
  dateTo: string | null;
  accountId: string | null;
  pnlFilter: "all" | "winners" | "losers";
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
  pnlFilter: "all",
};
```

### AccountProvider pattern to mirror for PrivacyProvider (lib/account-context.tsx)
```typescript
// Source: lib/account-context.tsx (shape to follow)
export function useAccounts() {
  return useContext(AccountContext);
}
export function AccountProvider({ children }: { children: ReactNode }) { ... }
```

### layout.tsx current provider nesting (app/layout.tsx, lines 20-42)
```typescript
// Source: app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
  <AccountProvider>
    <Navbar />
    ...
  </AccountProvider>
</ThemeProvider>
```
Add `<PrivacyProvider>` wrapping inside `<AccountProvider>` (or outside — no dependency between them).

### Data load with account scope (current monolith, lines 113-157)
```typescript
// Source: app/trades/page.tsx (current)
const load = async () => {
  setLoading(true);
  try {
    const tradesUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
    const [tradesRes, settingsRes, meRes] = await Promise.all([...]);
    // ...
  } finally { setLoading(false); }
};
useEffect(() => { load(); }, [activeAccountId, accounts.length]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All trades logic in one 588-line page.tsx | TradesShell + extracted components | Phase 19 | Phases 20-23 can add features with focused edits |
| Local-only filter state (3 separate useState) | Unified `TradeFilterState` with `DEFAULT_FILTER` | Phase 19 | Type-safe, extensible, session-persistent |
| Per-page localStorage privacy boilerplate (3 copies) | Single `PrivacyContext` + `usePrivacy()` | Phase 19 | Removing ~15 lines of duplication per page |
| FilteredSummary inline component | Removed | Phase 19 (permanently) | Phase 21 adds proper Summary Stats Bar |

**Removed in this phase:**
- `FilteredSummary` inline function component (lines 16-61 of current trades page) — deleted, not replaced until Phase 21
- Local `StatusFilter` / `DirectionFilter` type aliases — replaced by `TradeFilterState` fields
- Privacy `useEffect` blocks in trades page — replaced by `usePrivacy()`

## Open Questions

1. **Privacy fallback from `/api/settings` `privacy_mode` key**
   - What we know: Both trades page and journal page have this fallback (read `settingsData.privacy_mode` if `localStorage` is null)
   - What's unclear: Whether this fallback is still needed or was superseded by the localStorage-first approach
   - Recommendation: Move the fallback into `PrivacyProvider`'s initial load (fetch settings once, apply only if localStorage has no value). This preserves backward compatibility without spreading the logic.

2. **`accountId` field in TradeFilterState**
   - What we know: `TradeFilterState.accountId` exists but the current trades page scopes data by `activeAccountId` from `useAccounts()`, not by filter state
   - What's unclear: Whether `filter.accountId` should override `activeAccountId` or be a secondary filter
   - Recommendation: Leave `filter.accountId` unused in Phase 19 (set to `null` always). Phase 20 will define account filter UI behavior. The data fetch continues to use `activeAccountId` from context.

## Sources

### Primary (HIGH confidence)
- `app/trades/page.tsx` — full source of the component being refactored (588 lines, read directly)
- `lib/types.ts` — `TradeFilterState`, `DEFAULT_FILTER`, `Trade` types (read directly)
- `lib/account-context.tsx` — `AccountProvider` pattern to mirror for `PrivacyContext` (read directly)
- `app/layout.tsx` — current provider nesting, where `PrivacyProvider` slots in (read directly)
- `components/AccountBanner.tsx` — `hidden` prop interface, toggle callback pattern (read directly)
- `components/dashboard/DashboardShell.tsx` — privacy localStorage pattern (grep verified)
- `app/journal/page.tsx` — privacy localStorage pattern (grep verified — identical to trades page)

### Secondary (MEDIUM confidence)
- MDN / React docs: `sessionStorage` browser API — standard behavior (no version issues, widely known)
- Next.js 15 App Router: `"use client"` SSR behavior — `typeof window` guard is the documented pattern

### Tertiary (LOW confidence)
None — all findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — based on direct reading of existing code, established DashboardShell precedent
- Pitfalls: HIGH — identified from actual code patterns in the monolith (SSR guard, account-switch effect, privacy duplication)

**Research date:** 2026-03-21
**Valid until:** Stable — this is internal codebase knowledge, not external library research
