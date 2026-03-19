# Technology Stack — v2.1 Settings & Polish

**Project:** Ledger Of Alpha v2.1 — Settings & Polish
**Researched:** 2026-03-19
**Scope:** NEW capabilities only. Existing validated stack (Next.js 15, TypeScript, Tailwind CSS v3, better-sqlite3, recharts, lightweight-charts, @dnd-kit, next-themes, lucide-react, nodemailer, jose JWT, Gemini 2.5 Flash, IBKR Client Portal API) is unchanged.

---

## Executive Finding

**Zero new npm packages required.** Every feature in v2.1 is implementable with the existing dependency set plus built-in browser and Node.js APIs. This is a pure refactoring and UI enhancement milestone.

---

## Feature-by-Feature Analysis

### 1. Email URL Auto-Detection (npm / Docker / Cloudflare Tunnel)

**Problem:** `lib/email.ts` `getAppUrl()` falls back to `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. Users behind Docker or Cloudflare Tunnel forget to set this env var, so verification email links break.

**Solution: Request-header inference in API routes**

Next.js 15 Route Handlers have direct access to the `NextRequest` object, which carries the full header set from the HTTP client. The detection cascade is:

```
1. DB setting `app_url` (admin-configured, highest priority — already implemented)
2. `x-forwarded-proto` + `x-forwarded-host` headers (Cloudflare Tunnel, nginx, Docker reverse proxy)
3. `host` header (direct npm dev/start)
4. `NEXT_PUBLIC_APP_URL` env var (Docker compose explicit config)
5. `http://localhost:3000` (absolute last resort)
```

**What each deployment mode sends:**

| Mode | Headers Available |
|------|------------------|
| `npm run dev` / `npm start` | `host: localhost:3000` |
| Docker (no reverse proxy) | `host: localhost:5555` |
| Cloudflare Tunnel | `x-forwarded-proto: https`, `x-forwarded-host: your-domain.com` |
| nginx / Traefik | `x-forwarded-proto`, `x-forwarded-host` or `x-forwarded-for` |

**Implementation:** The `getAppUrl()` function in `lib/email.ts` currently has no access to request headers because it is called from within the email-sending functions (not directly in route handlers). The cleanest approach is to add an optional `req?: NextRequest` parameter to `getAppUrl()` and thread the request object from the calling route handler (e.g., `app/api/auth/register/route.ts`).

```typescript
// lib/email.ts — updated signature
function getAppUrl(req?: NextRequest): string {
  // 1. DB admin override (already exists)
  // 2. Request headers
  if (req) {
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) return `${proto}://${host}`;
  }
  // 3. Env var / default
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
```

**Libraries needed:** None. `NextRequest` is already imported in all calling route handlers. `request.headers.get()` is the standard Web API.

**Confidence:** HIGH — Next.js 15 `NextRequest.headers` is the documented API for reading request headers in Route Handlers. Cloudflare Tunnel sending `x-forwarded-proto` + `x-forwarded-host` is documented behavior (Cloudflare Fundamentals docs).

**Caveat:** `x-forwarded-host` is not guaranteed by all proxies. The cascade order above handles degraded cases. Admin-panel `app_url` setting (already wired in DB + `lib/email.ts`) remains the recommended override for unusual proxy setups.

---

### 2. Settings Page Overhaul (Component Split, Full-Width Layout, Tab Reorganization)

**Problem:** `app/settings/page.tsx` is a monolithic ~2400-line single file. All tab panels are inline. Full-width desktop layout requires restructuring from a narrow centered column.

**Solution: Pure refactoring — no new libraries**

The page already uses every tool it needs:
- Tab navigation via `useSearchParams` + `?tab=` query param (already implemented)
- Icon set: `lucide-react` (already installed)
- Drag-reorder: `@dnd-kit` (already installed, used for strategy ordering)
- Styling: Tailwind CSS v3 (already installed)

**Extraction plan:**
- Split each `activeCategory` panel into a separate `components/settings/` file
- `SettingsLayout.tsx` — full-width two-column layout (sidebar nav + content area)
- Individual panel components: `AccountPanel.tsx`, `AccountsPanel.tsx`, `StrategiesPanel.tsx`, `AdminSystemPanel.tsx`, etc.
- Pass shared `settings` state + save handlers as props

**Libraries needed:** None.

**Confidence:** HIGH — this is pure component decomposition of existing code.

---

### 3. Admin Panel as Single Source of Truth for Env Config

**Problem:** Admin panel at `app/api/admin/settings/route.ts` currently manages: `smtp_*`, `app_url`. Users still need `NEXT_PUBLIC_APP_URL` and `JWT_SECRET` in `.env`. The goal is to eliminate `.env` dependency for runtime config (excluding secrets that must remain env vars for security).

**Solution: Extend existing `_system` settings pattern**

The `_system` user_id row pattern in the `settings` table is already established and working. `lib/email.ts` already reads `smtp_*` and `app_url` from DB with env-var fallback.

**What to add to `SYSTEM_KEYS` in `app/api/admin/settings/route.ts`:**

| Key | Purpose | Notes |
|-----|---------|-------|
| `gemini_api_key` | Override `openai_api_key` setting name confusion | Stored in settings already as `openai_api_key`; admin panel should expose it clearly |
| `fmp_api_key` | FMP symbol search | Currently per-user setting; promote to system-level with user override |
| `discord_default_webhook` | Default Discord webhook for alerts | System default, users can override |

**What must stay in `.env` (cannot be in DB for security/bootstrap reasons):**

| Var | Why |
|-----|-----|
| `JWT_SECRET` | Read at startup before DB is available; changing requires all sessions to re-login |
| `DB_PATH` | Needed before DB connection is established |

**Libraries needed:** None. All infrastructure (DB upsert, `_system` partition, admin auth) already exists.

**Confidence:** HIGH — the pattern is already implemented and proven for SMTP + app_url.

---

### 4. Dashboard Layout Templates (Saveable Presets)

**Problem:** Users configure their 25-widget dashboard (order, visibility, sizes) and want to save named presets (e.g., "Day Trading View", "Review Mode").

**Solution: Extend existing `dashboard_layout` settings key with a presets array**

The current `dashboard_layout` structure stored in the `settings` table:
```json
{ "order": [...], "hidden": [...], "sizes": {...} }
```

Extend to a parallel `dashboard_layout_presets` settings key:
```json
[
  { "id": "uuid", "name": "Day Trading View", "layout": { "order": [...], "hidden": [...], "sizes": {...} } },
  { "id": "uuid", "name": "Review Mode", "layout": {...} }
]
```

**Built-in preset definitions** (hardcoded in component, not stored in DB):
- "Default" — the hardcoded `DEFAULT_ORDER` / `DEFAULT_SIZES` from `DashboardShell.tsx`
- "Compact" — all widgets at compact size, full order
- "Trading View" — only P&L, open positions, daily stats visible

User can save current layout as a preset, load a preset (replacing active layout), delete presets. The "Apply" action writes to `dashboard_layout` via existing `/api/settings` POST.

**Libraries needed:** None. Uses existing `/api/settings` endpoint, `crypto.randomUUID()` for IDs, and `@dnd-kit` if preset list needs drag-reorder (already installed).

**Confidence:** HIGH — identical pattern to how strategies are stored (JSON array in a settings key).

---

### 5. Strategy Enhancements: Per-Trade Checklist Editing and Ad-Hoc Checklists

**Problem:**
- Strategies with checklists are defined globally in settings. When a trade is entered, the user selects a strategy and its checklist is shown — but they cannot edit the checklist items for that specific trade (only the global template).
- No way to add a one-off checklist item for a specific trade without modifying the global strategy template.

**Solution A: Per-trade checklist state in TradeModal**

The `TradeModal.tsx` component already has a strategy selector. Add checklist state that:
1. Loads the selected strategy's checklist items as initial state
2. Allows the user to check/uncheck, add ad-hoc items, and reorder — all local to that trade
3. Saves the resulting checklist state to a `trade_checklist` JSON column on the `trades` table (new DB column via migration 022)

**Solution B: Built-in strategy defaults**

Add a `DEFAULT_STRATEGIES` constant (hardcoded, not in DB) that the strategies settings panel shows when `strategies` is empty. The user can then edit/delete/extend. This eliminates the blank-slate first-run experience. The existing hardcoded defaults already in `page.tsx` (Wyckoff Buy, Wyckoff Sell, Momentum Breakout, etc.) become the constant.

**DB migration needed:**

```sql
ALTER TABLE trades ADD COLUMN checklist TEXT; -- JSON array of {text, checked, adhoc?}
```

This is an additive migration following the established pattern in `lib/db.ts`.

**Libraries needed:** None. Drag-reorder of checklist items uses existing `@dnd-kit` (`useSortable`). The pattern is identical to strategy reordering already in settings.

**Confidence:** HIGH — all required infrastructure (strategy JSON in settings, @dnd-kit, SQLite migration pattern) is already established.

---

## Complete New Dependencies

**None.** Zero packages to install.

```bash
# No npm install needed for v2.1
```

---

## Database Migrations Required

| Migration | Table | Change | Purpose |
|-----------|-------|--------|---------|
| 022 | `trades` | `ADD COLUMN checklist TEXT` | Per-trade checklist state (JSON) |
| 023 | `settings` | No schema change — new `_system` keys via data | Admin panel config expansion |

Both are additive. No existing data affected. Pattern follows established inline migrations in `lib/db.ts`.

---

## Integration Points in Existing Codebase

| Feature | Integration Point | Change Type |
|---------|------------------|-------------|
| Email URL detection | `lib/email.ts` `getAppUrl()` | Add optional `req?: NextRequest` param; thread from auth route handlers |
| Settings split | `app/settings/page.tsx` → `components/settings/*.tsx` | Extract + decompose; zero logic change |
| Admin config expansion | `app/api/admin/settings/route.ts` `SYSTEM_KEYS` | Add 2-3 new keys |
| Layout presets | `components/dashboard/DashboardShell.tsx` | Add preset save/load UI; new `dashboard_layout_presets` settings key |
| Per-trade checklist | `components/TradeModal.tsx` + `lib/db.ts` | Add checklist state + migration 022 |
| Built-in strategy defaults | `app/settings/page.tsx` strategy section | Promote hardcoded array to named constant |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| URL detection | Native `NextRequest.headers` | `forwarded` npm package | Package adds abstraction over 5 lines of code; not worth the dependency |
| URL detection | Request-header cascade | Force users to set env var | This is the current situation — the exact pain point being solved |
| Layout presets | Extend settings key | Separate DB table | Overkill; presets are user preferences, same tier as other settings keys |
| Per-trade checklist | JSON column on `trades` | Separate `trade_checklist_items` table | Normalized table adds join complexity for a simple list; JSON column is sufficient at this scale |
| Settings decomposition | Extract to `components/settings/` | Keep monolithic | Maintainability; the monolith is already causing navigation difficulty |
| Built-in strategy defaults | Hardcoded constant | DB seeding on first run | DB seeding is complex; constant in code is simpler and survives data wipes |

---

## What NOT to Add

| Temptation | Why to Avoid |
|------------|-------------|
| `react-hook-form` or `formik` | Settings forms are simple controlled inputs; no validation library needed |
| `immer` for immutable state | State updates in settings are already manageable with spread; immer adds indirection without benefit at this scale |
| `zustand` / `jotai` state management | Settings page props drilling is shallow; React state + props is sufficient after component extraction |
| Separate layout preset DB table | `settings` key with JSON array matches every other user preference in the app; consistent pattern |
| `forwarded` npm package | The header cascade is 5 lines of code; a dedicated package is not warranted |
| `uuid` npm package | `crypto.randomUUID()` is available in all modern browsers and Node.js 14.17+; no external UUID library needed |

---

## Sources

- [Next.js 15 `headers()` function documentation](https://nextjs.org/docs/app/api-reference/functions/headers) — confirmed async in Next.js 15, `NextRequest.headers` available synchronously in Route Handlers — HIGH confidence
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — `request.headers.get()` is the standard pattern — HIGH confidence
- [Cloudflare HTTP headers documentation](https://developers.cloudflare.com/fundamentals/reference/http-headers/) — `x-forwarded-proto` and `x-forwarded-host` behavior — MEDIUM confidence (not all proxies guarantee `x-forwarded-host`)
- [Next.js Dynamic APIs are Asynchronous](https://nextjs.org/docs/messages/sync-dynamic-apis) — Next.js 15 async header access guidance — HIGH confidence
- Existing codebase: `lib/email.ts`, `app/api/admin/settings/route.ts`, `app/settings/page.tsx`, `components/dashboard/DashboardShell.tsx` — reviewed directly — HIGH confidence
