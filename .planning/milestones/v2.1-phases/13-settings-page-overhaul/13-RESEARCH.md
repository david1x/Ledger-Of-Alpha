# Phase 13: Settings Page Overhaul - Research

**Researched:** 2026-03-19
**Domain:** React component decomposition, Next.js App Router, Tailwind CSS layout
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETT-01 | Settings page content area uses full available width on desktop (no max-w-2xl constraint) | Line 737 of page.tsx: `sm:max-w-2xl` is on the content `<div>` — removing it makes content fill `flex-1` |
| SETT-02 | Settings page is split into per-tab components (extracted from 2380-line monolith) | Each `activeCategory === "X"` block becomes `components/settings/XTab.tsx` |
| SETT-03 | Settings tabs are reorganized with clear, descriptive names (especially replacing vague "Display" tab) | "Display" tab currently only contains heatmap config, privacy mode, and chart-collapse toggle — rename to "Appearance" |
| SETT-04 | Each settings tab shows unsaved-change indicator before switching away | Currently there is no dirty-state tracking at all; needs a `isDirty` boolean per tab or globally |
| SETT-05 | Existing `?tab=` URL routing continues to work after reorganization | `CATEGORIES` array defines IDs used in URL; any renamed tab must map old ID to new ID |
</phase_requirements>

---

## Summary

The settings page (`app/settings/page.tsx`) is a 2380-line single-file client component that holds all state, all tab rendering, and all API logic in one `SettingsContent` function. The file is well-structured internally — tabs are already delineated by `{activeCategory === "X" && (<section>...)}` comment blocks — which makes extraction mechanical rather than architectural.

The two most important patterns to carry forward are: (1) the shared `settings` state object that all tabs read from, and (2) the single `save()` call that POSTs the whole object. After the split, each tab can own only the slice of settings it needs, making dirty-state tracking local and simple. The unsaved-indicator (SETT-04) is a natural side-effect of per-tab state ownership.

The width fix (SETT-01) is a one-line Tailwind change: `sm:max-w-2xl` on the content div (line 737) becomes nothing — the `flex-1 min-w-0` already constrains it correctly. No layout risk.

**Primary recommendation:** Extract each tab into `components/settings/tabs/XTab.tsx`. Each tab owns its own state slice, fetches/saves independently, and tracks its own dirty flag. The shell page (`app/settings/page.tsx`) becomes a thin router (~100 lines) that renders the sidebar and the active tab component.

---

## Standard Stack

### Core (already in use — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` / `useEffect` | 18.x (bundled with Next.js 15) | Per-tab local state | Already used throughout; no new patterns needed |
| `useSearchParams` (next/navigation) | Next.js 15 | Read `?tab=` from URL | Already used in `SettingsContent` at line 197 |
| `clsx` | 2.x | Conditional classNames on sidebar buttons | Already imported in page.tsx |
| `@dnd-kit/*` | Already installed | Strategy drag-reorder in Strategies tab | Already imported; stays in StrategiesTab |
| Tailwind CSS v3 | Already configured | All styling | Project convention |

### No New Libraries Required
All functionality is achievable with what is already installed. Do not introduce form libraries (react-hook-form, zod) — the project explicitly avoids unnecessary abstractions (CLAUDE.md convention).

---

## Architecture Patterns

### Recommended Project Structure
```
app/settings/
└── page.tsx                   # Shell: sidebar + <ActiveTab /> (~100 lines)

components/settings/
├── types.ts                   # Shared types: SettingsData, Category, etc.
└── tabs/
    ├── AccountTab.tsx         # account — Starting balance, risk, commission, Monte Carlo
    ├── AccountsTab.tsx        # accounts — Multi-account management (CRUD)
    ├── TagsTab.tsx            # tags — Default tags & mistakes lists
    ├── TemplatesTab.tsx       # templates — Trade templates
    ├── AppearanceTab.tsx      # display → rename to "appearance" (heatmap, privacy, chart-collapse)
    ├── ChartTab.tsx           # chart — TradingView toggle settings + studies
    ├── StrategiesTab.tsx      # strategies — DnD strategy/checklist editor
    ├── IntegrationsTab.tsx    # integrations — Discord webhooks, FMP key, Gemini key
    ├── BrokerTab.tsx          # broker — IBKR connection/sync
    ├── SecurityTab.tsx        # security — 2FA setup/disable
    ├── DataTab.tsx            # data — Import/export, symbol cache refresh
    ├── AdminUsersTab.tsx      # admin-users (adminOnly) — User management
    └── AdminSettingsTab.tsx   # admin-settings (adminOnly) — System/SMTP settings
```

### Pattern 1: Tab owns its own state slice + save
**What:** Each tab component receives only the settings keys it needs, manages local state, saves independently, and exposes an `isDirty` state for the unsaved-indicator.
**When to use:** All 13 tab components.
**Example:**
```typescript
// components/settings/tabs/AccountTab.tsx
"use client";
import { useState, useEffect } from "react";
import { Save, CheckCircle, DollarSign } from "lucide-react";

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AccountTab({ onDirtyChange }: Props) {
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPerTrade, setRiskPerTrade] = useState("1");
  // ... other fields
  const [saved, setIsSaved] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      setAccountSize(data.account_size ?? "10000");
      setRiskPerTrade(data.risk_per_trade ?? "1");
      // Set saved baseline
      setSaved({ account_size: data.account_size, risk_per_trade: data.risk_per_trade });
    });
  }, []);

  // Mark dirty whenever a field differs from saved baseline
  // ...

  const handleSave = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_size: accountSize, risk_per_trade: riskPerTrade }),
    });
    setIsDirty(false);
  };

  return ( /* ... */ );
}
```

### Pattern 2: Shell page as thin router
**What:** `app/settings/page.tsx` reads `?tab=`, renders sidebar, and mounts the active tab component. No settings state lives at this level.
**When to use:** The shell page only.
**Example:**
```typescript
// app/settings/page.tsx (after refactor, ~100 lines)
"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/components/settings/types";
import AccountTab from "@/components/settings/tabs/AccountTab";
// ... other imports

function SettingsContent() {
  const searchParams = useSearchParams();
  const initial = (searchParams.get("tab") ?? "account") as Category;
  const [active, setActive] = useState<Category>(
    CATEGORIES.some(c => c.id === initial) ? initial : "account"
  );
  const [dirtyTab, setDirtyTab] = useState<Category | null>(null);

  const handleTabChange = (next: Category) => {
    if (dirtyTab) {
      // Show inline indicator — do NOT use window.confirm (no modal needed per requirements)
    }
    setActive(next);
    setDirtyTab(null);
  };

  return (
    <div className="flex gap-6">
      {/* sidebar unchanged */}
      <div className="flex-1 min-w-0 min-h-[80vh]">
        {/* removed sm:max-w-2xl — satisfies SETT-01 */}
        {active === "account" && <AccountTab onDirtyChange={d => d ? setDirtyTab("account") : setDirtyTab(null)} />}
        {/* ... other tabs */}
      </div>
    </div>
  );
}
```

### Pattern 3: Unsaved-change indicator (SETT-04)
**What:** A small visual badge on the sidebar tab button when that tab has unsaved changes. The indicator appears before the user switches away — it is visible the moment any field is modified.
**Implementation:** Each tab tracks `isDirty` locally and calls `onDirtyChange(boolean)` prop. The shell stores `dirtyTab: Category | null`. The sidebar renders a yellow dot or "(unsaved)" text next to the tab label when `dirtyTab === id`.
**Important:** The requirement says "shows a visible indicator before leaving" — it does NOT say a blocking dialog. A non-blocking dot/badge is the correct implementation.

### Pattern 4: Preserving `?tab=` routing (SETT-05)
**What:** The `id` field in `CATEGORIES` is what appears in the URL (`?tab=display`). Renaming "Display" to "Appearance" means the `id` must remain `"display"` OR a URL redirect must map `display` → `appearance`.
**Recommendation:** The simplest approach is to rename the `label` to "Appearance" but keep `id: "display"`. This satisfies SETT-03 (descriptive label) and SETT-05 (URL unchanged) with zero routing complexity.
**Alternative if id must change:** Add a redirect in the shell: `if (tab === "display") setActive("appearance")`. This also works but adds one line.

### Anti-Patterns to Avoid
- **Do not prop-drill the entire `settings` object into every tab.** Each tab should fetch only its own keys.
- **Do not use a shared context for settings state.** The tabs are independent; cross-tab coupling is exactly what SETT-02 prohibits.
- **Do not use `window.confirm` or a modal for the dirty indicator.** A visual badge is sufficient and less disruptive.
- **Do not split the admin tabs into separate routes.** REQUIREMENTS.md "Out of Scope" explicitly prohibits "Splitting settings into separate routes".
- **Do not remove the `Suspense` wrapper in `SettingsPage`.** It is required because `useSearchParams` is used inside.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe settings keys | Custom type guard | Extend existing `Settings` interface in `lib/types.ts` and add to `components/settings/types.ts` | Types already partially defined; extend, don't duplicate |
| Tab routing | New router/context | `useState` + `useSearchParams` (already used) | No React Router in this project; Next.js App Router handles pages |
| Drag-and-drop in Strategies | Custom DnD | `@dnd-kit` already installed and used in current page | Full implementation exists at lines 263-277 |

---

## Common Pitfalls

### Pitfall 1: Settings fetch waterfall
**What goes wrong:** Each of 13 tabs calls `GET /api/settings` on mount. If all 13 mount simultaneously (e.g., SSR or eager rendering), that is 13 requests for one endpoint.
**Why it happens:** Per-tab data fetching is natural but naive.
**How to avoid:** Only the active tab is mounted at any time (conditional rendering `{active === "X" && <XTab />}`). The tab unmounts when you switch away, so only one fetch is in flight. This is correct behavior.
**Warning signs:** If tabs are rendered with CSS `display:none` instead of conditional rendering, all will fetch simultaneously.

### Pitfall 2: Lost unsaved changes on tab switch
**What goes wrong:** User edits AccountTab, switches to ChartTab — AccountTab unmounts, state is lost.
**Why it happens:** Per-tab state is local; unmounting destroys it.
**How to avoid:** The unsaved-indicator (SETT-04) is the mitigation. The user sees "unsaved" before switching. This is the intended UX — the indicator warns, not blocks. If true persistence is required, the tab must save to `/api/settings` before unmounting, but this is NOT required by SETT-04.
**Warning signs:** If the indicator is missing, users will silently lose edits.

### Pitfall 3: `sm:max-w-2xl` re-introduced via copy-paste
**What goes wrong:** A tab component adds a max-width class internally, re-constraining width.
**Why it happens:** Developers copy the card pattern from the existing page which has the constraint.
**How to avoid:** Remove `sm:max-w-2xl` from the shell's content wrapper (the single point). Tab components should use `w-full` on their sections, not max-width constraints.

### Pitfall 4: Stale `?tab=` initial value after rename
**What goes wrong:** URL has `?tab=display`, component mounts with `initial = "display"`, but `CATEGORIES` no longer has `id: "display"` — falls back to "account".
**Why it happens:** Renaming the category `id` breaks existing bookmarks and the requirement.
**How to avoid:** Keep `id: "display"` in CATEGORIES; only change the `label` field to "Appearance". SETT-05 is fully satisfied.

### Pitfall 5: Admin tab visibility with isAdmin
**What goes wrong:** After extraction, `AdminUsersTab` and `AdminSettingsTab` don't know if the user is admin.
**Why it happens:** `isAdmin` was fetched in the monolith and passed nowhere — now it needs to reach the shell for sidebar filtering AND the admin tabs for their own conditional rendering.
**How to avoid:** Fetch `isAdmin` in the shell (`SettingsContent`) via `GET /api/auth/me`. Pass it as a prop to the sidebar filter and to `AdminUsersTab`/`AdminSettingsTab`. Do NOT re-fetch in each admin tab.

### Pitfall 6: `SortableStrategy` component placement
**What goes wrong:** `SortableStrategy` (the DnD card component, lines 110-194) is defined at file level in `page.tsx`. If it is not moved to `StrategiesTab.tsx`, TypeScript will complain about missing import.
**Why it happens:** It is a local component, not exported.
**How to avoid:** Move `SortableStrategy` into `StrategiesTab.tsx` where it is the only consumer.

---

## Code Examples

### Shared types file
```typescript
// components/settings/types.ts
import type { LucideIcon } from "lucide-react";

export type Category =
  | "account" | "accounts" | "tags" | "templates"
  | "display" | "chart" | "strategies" | "integrations"
  | "broker" | "security" | "data"
  | "admin-users" | "admin-settings";

export interface CategoryDef {
  id: Category;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

// Copy CATEGORIES array from page.tsx verbatim, with label "Display" → "Appearance"
// Keep id: "display" unchanged for SETT-05 compliance
```

### Dirty-state indicator in sidebar
```typescript
// In SettingsContent (shell) sidebar render:
<button
  key={id}
  onClick={() => handleTabChange(id)}
  className={clsx("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left", ...)}
>
  <Icon className="w-4 h-4 shrink-0" />
  {label}
  {dirtyTab === id && (
    <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
  )}
</button>
```

### Full-width layout fix (SETT-01)
```diff
- <div className="flex-1 min-w-0 space-y-6 sm:max-w-2xl min-h-[80vh]">
+ <div className="flex-1 min-w-0 space-y-6 min-h-[80vh]">
```
This is the only change needed for SETT-01. The `flex-1` already fills available space.

---

## Current Tab Inventory

This maps what each tab currently contains so extraction is unambiguous:

| Tab ID | Current Label | Suggested Label | Content Summary |
|--------|--------------|-----------------|-----------------|
| `account` | Account | Account | Starting balance, risk %, commission model/value, daily loss limit, Monte Carlo threshold |
| `accounts` | Accounts | Accounts | Multi-account CRUD (uses `useAccounts()` context + per-account P&L fetch) |
| `tags` | Tags & Mistakes | Tags & Mistakes | Default tags list, default mistakes list (array editing) |
| `templates` | Templates | Trade Templates | Trade template CRUD |
| `display` | Display | Appearance | Heatmap thresholds, collapse-charts toggle, default privacy mode |
| `chart` | Chart | Chart | TradingView feature toggles (6 checkboxes), default studies/indicators |
| `strategies` | Strategies | Strategies | DnD strategy list with checklist items; uses `@dnd-kit` |
| `integrations` | Integrations | Integrations | Discord webhooks (×2 with test buttons), FMP API key, Gemini API key |
| `broker` | Broker | Broker | IBKR host/port/client_id, connection test, account mapping, sync |
| `security` | Security | Security | 2FA enable/disable flow, backup codes |
| `data` | Data | Data | Import (CSV/JSON/IBKR CSV), export (CSV/JSON), symbol cache refresh |
| `admin-users` | Users | Users (Admin) | User list, toggle admin role, delete user, claim admin |
| `admin-settings` | System | System (Admin) | System settings: SMTP config, app_url |

**Key observations:**
- "Display" is vague because it contains heatmap (a data visualization setting) + chart-collapse (a display preference) + privacy mode (a display preference). Renaming to "Appearance" is accurate.
- Broker tab is the most complex extraction: 15+ state variables, 5 useEffect hooks, IBKR API calls. Plan this tab carefully.
- AdminUsersTab requires the `isAdmin` flag from the shell — do not fetch it twice.

---

## State Sharing Analysis

State variables in the current monolith that cross tab boundaries:

| State | Used In Tabs | Resolution |
|-------|-------------|------------|
| `settings` (full object) | All tabs | Split: each tab fetches only its own keys |
| `isAdmin` | Sidebar filter + admin tabs | Fetch once in shell; pass as prop |
| `hasAdmin` | Sidebar "Claim Admin" button | Fetch once in shell from `/api/auth/me` |
| `saving` / `saved` | Global save button | Each tab has its own save button and state |
| `accounts` / `refreshAccounts` | AccountsTab only | Use `useAccounts()` hook directly in AccountsTab |

The existing global save button (lines 2357-2368) must be removed from the shell. Each tab's section already has enough UI space for a local Save button.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Single monolith settings page | Per-tab components | This is the standard pattern for Next.js App Router apps with large settings pages |
| Global settings state | Per-tab state slices | Prevents cross-tab coupling per SETT-02 |
| No dirty-state tracking | Per-tab dirty flag + indicator | Simple boolean, no library needed |

---

## Open Questions

1. **Loading flicker on tab switch**
   - What we know: Per-tab `useEffect` fetch triggers on mount; each tab switch = new fetch
   - What's unclear: Whether the ~50ms fetch delay causes visible flicker on `/api/settings`
   - Recommendation: The STATE.md note "[Phase 13]: Validate that 13 self-fetching section components do not produce visible loading flicker; fall back to parent-owns-state if needed" — the planner should add a verification step: if flicker is observed during implementation, lift settings fetch to the shell and pass data down as props. This is an implementation-time decision, not a planning blocker.

2. **`lib/types.ts` Settings interface**
   - What we know: The `Settings` interface in `lib/types.ts` only has 6 fields (lines 95-102), while the actual settings object used in the page has ~20 fields
   - What's unclear: Whether `lib/types.ts` should be updated as part of this phase
   - Recommendation: Yes — update `Settings` in `lib/types.ts` to match the full set of fields actually used. This is the correct time to do it while extracting shared types.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `app/settings/page.tsx` (all 2380 lines read) — authoritative for all current behavior
- `lib/types.ts` — Account, Settings, TradeStrategy interfaces
- `app/layout.tsx` — Confirms `<main className="sidebar-push px-6 py-6 ...">` with no max-width (page content is responsible for its own width)
- `.planning/REQUIREMENTS.md` — SETT-01 through SETT-05 exact wording
- `CLAUDE.md` — "No unnecessary abstractions", "inline styles and direct state management preferred"

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 13 concern about loading flicker documented
- `REQUIREMENTS.md` Out of Scope — "Splitting settings into separate routes: Breaks existing `?tab=` deep-link pattern" — confirms single-page architecture must be preserved

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, all patterns already exist in codebase
- Architecture: HIGH — extraction pattern is mechanical (comment-blocked sections map 1:1 to components)
- Pitfalls: HIGH — identified from direct code inspection, not speculation
- Tab inventory: HIGH — derived from full read of page.tsx

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable Next.js/React; no external API dependencies)
