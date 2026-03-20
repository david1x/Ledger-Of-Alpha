# Feature Landscape: v2.1 Settings & Polish

**Domain:** Trade journaling platform — settings overhaul, deployment improvements, dashboard templates, strategy/checklist enhancements
**Researched:** 2026-03-19
**Overall confidence:** HIGH for UX patterns (well-established); MEDIUM for URL auto-detection specifics (deployment environment variability)

---

## Domain Overview

This research covers five distinct feature clusters for v2.1. All are improvements to existing surfaces rather than net-new capabilities. The key constraint: everything builds on existing infrastructure (Next.js 15, SQLite, settings API, dashboard_layout JSON). No new external service dependencies are introduced.

---

## Feature Cluster 1: Settings Page Overhaul (Component Split + Full-Width Layout)

### Current State

The settings page is a single `page.tsx` file of ~38,000 tokens with 13 tabs. All tab content is inlined in one component. Layout is sidebar-left + content-right within a constrained max-width container.

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Settings sidebar stays visible on desktop | Standard SaaS pattern (Linear, Vercel, Stripe dashboards) — sidebar persists while content area scrolls | Low | Already have the sidebar nav; just width/layout adjustments |
| Full-width content area on desktop | Admin dashboards like Vercel/PlanetScale use the full viewport; constrained widths feel cramped for dense settings | Low | Remove `max-w-4xl` or equivalent container constraint |
| Each tab is its own visual section | Clear separation between unrelated settings reduces cognitive load | Low | Already exists via tab switching; just needs layout room |
| Save button scoped to visible tab | Users expect to save only what they changed; global save on a 13-tab form is confusing | Medium | Currently single save button covers all settings; per-tab save is the expected pattern |
| Settings persist without page reload | Standard — write to DB, reflect immediately in UI | Low | Already works; stays working after refactor |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-tab save with unsaved-change indicator | "You have unsaved changes" warning before switching tabs | Medium | Requires per-tab dirty state tracking |
| Tab icons in sidebar visible at all sizes | Collapsed sidebar shows icon-only — already pattern in main navbar | Low | Consistent with existing app sidebar |
| Search within settings | "Type to filter settings" — useful at 13+ tabs | High | Overkill for current tab count; defer |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Accordion-based settings (no sidebar) | Collapses the tab structure that already works; harder to navigate at 13 sections | Keep sidebar tab navigation |
| Splitting into multiple routes (`/settings/account`, `/settings/security`) | Breaks existing `?tab=` deep-link pattern used by the codebase | Stay on single route with `?tab=` params |
| Refactoring to separate page files per tab | Increases route complexity for no user-visible benefit | Split into React components, not routes |

### Feature Dependencies

```
Component split → No new API routes needed; all existing settings API endpoints remain
Full-width layout → CSS-only change to container class
Per-tab save → Requires per-tab dirty state; can share single /api/settings PUT endpoint
Existing ?tab= routing → Must be preserved (TradeModal links to ?tab=strategies)
```

### Existing Code Leverage

- `app/settings/page.tsx` — Split into `components/settings/AccountTab.tsx`, `StrategiesTab.tsx`, etc. Keep single route
- `CATEGORIES` array at top of file drives sidebar — stays as-is
- `useSearchParams()` for `?tab=` — stays as-is
- All settings API calls (`/api/settings` GET/PUT) — no changes

### MVP Recommendation

1. Extract each of the 13 tab bodies into `components/settings/[Tab]Tab.tsx` files
2. Update layout to `flex` with full-width content pane (remove width constraint on content area)
3. Keep unified save button for now (per-tab save is a nice-to-have, not launch blocker)
4. Ensure `?tab=` param routing still works

---

## Feature Cluster 2: Email URL Auto-Detection

### Current State

`lib/email.ts` `getAppUrl()` checks DB (`_system` settings `app_url`) then falls back to `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. The admin panel already has an `app_url` field. The gap: when neither is configured, email links break for Docker/Cloudflare tunnel deployments.

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email verification links work without manual URL configuration | Self-hosted apps (Gitea, Plausible, etc.) auto-detect their public URL from request headers | Medium | Requires access to current request object in server context |
| Works behind Cloudflare tunnel | Cloudflare passes `X-Forwarded-Host` and `CF-Connecting-IP`; app must read these | Medium | Header priority: admin DB setting > `X-Forwarded-Proto` + `X-Forwarded-Host` > `Host` > env var > localhost fallback |
| Works in Docker with reverse proxy (nginx) | `X-Forwarded-Host` is the standard header set by nginx proxy_pass | Low | Same logic as Cloudflare |
| Works with npm dev server | `Host: localhost:3000` header is always present | Low | Fallback to `Host` header |
| Admin can override auto-detection | When auto-detection gets it wrong (multi-tenant, custom domain) | Low | Already exists: admin panel `app_url` field overrides all |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Show detected URL in admin panel | Admin sees "Auto-detected: https://trading.mydomain.com" next to the override field | Low | Requires passing detected URL back to client via a status API |
| "Test email" button that shows resolved URL | Sends test email + shows which URL will be used in links | Medium | Useful for diagnosing misconfiguration |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Using `NEXT_PUBLIC_APP_URL` as primary source | `NEXT_PUBLIC` is baked at build time in Docker; runtime URLs may differ | Prefer runtime DB setting and request-header detection |
| Trusting `X-Forwarded-Host` without checking `X-Forwarded-Proto` | Results in `http://` links when site is actually `https://` | Always read both headers together |
| Caching the auto-detected URL globally | URL may differ per request (proxies, dev vs. prod) | Compute per-request in the API route context; cache only the DB override |

### Implementation Pattern

Header resolution priority (in order):
1. Admin DB: `_system` settings `app_url` (non-empty)
2. Request headers: `X-Forwarded-Proto` + `X-Forwarded-Host`
3. Request headers: `Host` header (with protocol assumption from `req.url`)
4. `process.env.NEXT_PUBLIC_APP_URL`
5. `http://localhost:3000` (final fallback)

The `getAppUrl()` function in `lib/email.ts` currently only handles steps 1 and 5. Steps 2-4 require passing a `NextRequest` object, which means the auth API routes (`/api/auth/register`, `/api/auth/forgot-password`) must pass `req` when calling email functions.

### Feature Dependencies

```
getAppUrl(req?) → Accept optional request param; fall through header chain
/api/auth/register → Pass req to email send functions
/api/auth/forgot-password → Pass req to email send functions
Admin UI → Existing app_url field already present; optionally show auto-detected value
No new DB tables needed
```

---

## Feature Cluster 3: Admin Panel as Config Source of Truth

### Current State

Admin panel (`/api/admin/settings`) stores: `account_size`, `risk_per_trade`, `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `smtp_from`, `app_url`. SMTP is read from DB by `lib/email.ts`. But API keys (FMP, Gemini/OpenAI) and Discord webhooks are stored per-user, not in `_system` settings. This is correct for multi-user but creates setup friction for self-hosted single-user deployments.

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All deployment-critical config (SMTP, APP_URL, API keys) editable in admin panel | Self-hosted tools like Plausible, Umami, Gitea allow full config via admin UI — no .env editing needed | Low | DB storage pattern already established |
| DB settings override env vars | Standard pattern: env vars = defaults/fallbacks, DB = runtime overrides | Low | Already done for SMTP; extend to API keys |
| Config changes take effect without restart | DB is read per-request; no restart required (unlike env var changes) | Low | Already works for SMTP |
| Sensitive values masked in UI | SMTP pass, API keys show `****` after save | Low | Standard; show value only during active edit |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Connection test" buttons per integration | "Test SMTP", "Test FMP API", "Test Gemini API" — verify before saving | Medium | Each fires a lightweight API call and reports pass/fail |
| Show env var fallback status | "Using env var fallback" vs "Using admin-configured value" — transparent to admin | Low | Check if DB value is empty; show status label |
| Audit log for admin config changes | Who changed what, when — security-relevant | High | Overkill for single-user self-hosted; defer |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Replacing env vars entirely | Some environments (Docker compose, CI) need env var configuration; remove one without the other | Keep env var fallbacks; DB overrides only when set |
| Exposing SMTP password in GET response | Security risk if admin route ever misconfigures | Return masked value (`••••••••`) for sensitive fields; never return raw |
| Moving per-user API keys to `_system` | On multi-user instances, each user should have their own Gemini key | Keep per-user for AI key; add `_system` fallback if user hasn't set their own |

### What Needs to Move to Admin Config

| Setting | Current Home | Move To |
|---------|-------------|---------|
| SMTP config | `_system` settings | Already there |
| `app_url` | `_system` settings | Already there |
| FMP API key | Per-user settings | Add `_system` fallback |
| Gemini/OpenAI API key | Per-user settings | Add `_system` fallback |
| Discord webhook | Per-user settings | Keep per-user (personal webhooks) |

### Feature Dependencies

```
SYSTEM_KEYS in /api/admin/settings → Add fmp_api_key, openai_api_key (system fallback)
lib/email.ts → Already reads from _system; no changes
AI routes (/api/ai/analyze, /api/ai/followup) → Read openai_api_key from user settings first, fall back to _system
Symbol search (/api/symbols) → Read fmp_api_key from user settings first, fall back to _system
Admin settings UI (admin-settings tab) → Add rows for FMP and AI API keys
No new DB tables; existing _system settings pattern handles it
```

---

## Feature Cluster 4: Dashboard Layout Templates

### Current State

Dashboard layout (`dashboard_layout` setting) stores: `{ order: string[], hidden: string[], sizes: Record<string, WidgetSize> }`. This is a single layout per user. Users cannot save named presets or switch between "performance review mode" vs "daily monitoring mode".

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Save current layout as a named template | "Save this as 'Morning Routine'" — expected once users discover layout customization | Low | Store array of named layouts in settings |
| Load a saved template | Click to restore a saved layout configuration | Low | Replace active `dashboard_layout` with template data |
| See list of saved templates | Visible somewhere in the dashboard (edit mode toolbar or settings tab) | Low | Dropdown or list panel |
| Delete a saved template | Remove no-longer-needed presets | Low | Standard CRUD |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Built-in templates (e.g., "Performance Review", "Risk Monitor", "Minimal") | New users get value immediately without configuring layout from scratch | Medium | Hardcode 2-3 preset configurations using existing widget IDs |
| Template preview thumbnail | See what a template looks like before loading it | High | Requires screenshot or CSS mini-preview; overkill for now |
| Share template via URL or code | Copy layout config as JSON for sharing in community | Medium | Nice differentiator; low urgency |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Template system in a separate settings tab | Templates are dashboard-specific; keep template controls in the dashboard edit mode toolbar | In-dashboard UI: "Save Template" and "Load Template" buttons in edit mode |
| Complex template editor | Don't build a separate layout editor page | Templates are just named snapshots of the existing layout state |
| Cloud-synced template sharing | Requires backend infrastructure beyond this app's scope | Local templates stored in user settings only |

### Data Model

```typescript
interface LayoutTemplate {
  id: string;          // UUID
  name: string;        // User-defined name
  layout: {
    order: string[];
    hidden: string[];
    sizes: Record<string, WidgetSize>;
  };
  createdAt: string;   // ISO string
}

// Stored as settings key: dashboard_templates (JSON string of LayoutTemplate[])
// Active layout stays in: dashboard_layout (unchanged)
```

### Feature Dependencies

```
New settings key: dashboard_templates (array of LayoutTemplate)
DashboardShell edit mode toolbar → Add "Save Template" button + "Load Template" dropdown
/api/settings PUT → Already handles arbitrary key-value; no route changes
Existing dashboard_layout → Stays as active layout; templates are separate
Built-in templates → Hardcoded in DashboardShell, not from DB
```

### Built-in Template Recommendations

Based on widget IDs already in the codebase:

- **Performance Review**: cumulative P&L area chart (large) + win rate + expectancy + trades by setup table + drawdown chart — all analytics-focused
- **Daily Monitoring**: weekly calendar (large) + heatmap + today's open positions (IBKR widget) — time-focused
- **Minimal Stats**: 4-6 stat widgets in compact mode — clean, information-dense

### MVP Recommendation

1. "Save Template" button in edit mode → prompt for name → store to `dashboard_templates`
2. "Load Template" dropdown in edit mode → select from saved + built-in templates → apply layout
3. Delete button per saved template
4. 2-3 hardcoded built-in templates

Defer: Preview thumbnails, URL sharing

---

## Feature Cluster 5: Strategy + Checklist Enhancements

### Current State

Strategies are stored as JSON in `settings.strategies`. Each strategy has a `name` and `checklist: string[]`. In TradeModal, `StrategyChecklist` component shows the selected strategy's checklist as read-only checkboxes. The checked state is stored as `checklist_items` (comma-delimited string of ticked item names). Per-trade checklist editing is not supported — users get the strategy's predefined checklist, nothing more.

Gaps identified:
- No per-trade checklist modifications (can't add a custom item for a specific trade)
- No ad-hoc checklist (freeform items not tied to any strategy)
- Strategy defaults are hardcoded in `TradeModal.tsx` (duplicated from settings defaults)
- Strategy order is set in settings but the TradeModal uses a find-first approach tied to "buy"/"sell" in the ID

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Built-in default strategies ship with the app | New users should not see an empty strategies list | Low | 5 strategies already hardcoded in both settings and modal; consolidate to one source |
| Strategy selection auto-matches trade direction | Long trade → suggest buy-side strategy; short → sell-side | Low | Already partially implemented; needs robustness |
| Checklist items remain visible after trade saved | Reviewing a trade shows which items were checked | Low | Already stored in `checklist_items`; display in trade detail view |
| Per-trade custom checklist additions | Add an item to the checklist for just this trade without editing the strategy template | Medium | New `checklist_custom` field or append to existing `checklist_items` with a `*` prefix |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ad-hoc checklist (no strategy selected) | "I just want a quick freeform checklist without picking a strategy" — reduces friction for casual use | Low | Allow checklist items when `strategy_id` is null; show simple text-input add-item UI |
| Edit strategy template directly from trade modal | "This item doesn't apply to this trade type; let me remove it from the template" — context-aware editing | High | Opens settings in a modal or side panel; risk of complexity |
| Checklist completion score on trade card | Show "7/9 checks" badge on trade cards in journal view | Low | Already stored in `checklist_items`; can be computed at display time |
| Per-strategy performance breakdown | "Your Wyckoff trades: 68% win rate vs 52% for Momentum Breakout" | Medium | GROUP BY strategy_id on trades; already have strategy_id column |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Forcing strategy selection before save | Traders in the moment don't want mandatory structured input | Keep strategy optional; default to first strategy but allow deselect |
| Editable checklist items inside trade modal (template edits) | Confuses per-trade customization with template editing | Separate: per-trade additions are stored separately; template edits happen in settings |
| Storing custom checklist items in the checklist_items string blob | Makes parsing fragile (item names with commas break the comma-delimiter) | Use JSON column instead; migrate `checklist_items` to JSON array |
| Multiple checklist systems (wyckoff_checklist + checklist_items) | Already have two overlapping systems; adding a third creates confusion | Deprecate `wyckoff_checklist` column; consolidate to `checklist_items` |

### Feature Dependencies

```
Built-in defaults consolidation:
  DEFAULT_STRATEGIES in TradeModal.tsx → Move to lib/strategies.ts as single source
  settings.tsx default strategies → Import from lib/strategies.ts

Per-trade custom checklist:
  Option A: New DB column checklist_custom TEXT (JSON array) — clean separation
  Option B: Add prefix marker in existing checklist_items string — hack, fragile
  Recommendation: Option A with migration 022

Ad-hoc checklist (no strategy):
  StrategyChecklist component → Add "No Strategy / Ad-hoc" option in select
  When selected: show text input to add freeform items, stored in checklist_items JSON

checklist_items format migration:
  Current: comma-delimited string ("Item 1, Item 2")
  Target: JSON array (["Item 1", "Item 2"])
  Risk: Existing data needs migration; ~migration 023
```

### MVP Recommendation

Phase this as:
1. **Consolidate defaults** — single source of truth in `lib/strategies.ts`, remove duplication (no DB changes)
2. **Ad-hoc checklist** — "No Strategy" option that shows freeform add-item UI (no DB changes if using existing `checklist_items`)
3. **Per-trade custom items** — new `checklist_custom` JSON column via migration; shown as "Additional items" section below strategy checklist
4. **Checklist score badge** — computed display in journal trade cards (no new data)

Defer: In-modal template editing, per-strategy performance breakdown (easy but separate feature)

---

## Feature Cluster 6: Fibonacci Calculator Cleanup — RESOLVED (Phase 17)

**Status:** Complete. Component deleted, orphaned code removed, no dead references remain.

### Resolution Summary

`FibCalculator.tsx` was deleted. All orphaned `fibonacciLevels` code was removed from `lib/calculators.ts`. Dead references in `app/tools/page.tsx` and any routing files were cleaned up. Build passes cleanly. Descoped by user decision — 5 of 6 original calculators remain on /tools page.

### Historical Context

`FibCalculator.tsx` was deleted after v2.0 verification passed. The `fibonacciLevels` function had remained in `lib/calculators.ts` as orphaned code. Dead references may also have existed in routing, the tools page, or index files. This cleanup task was tracked as TOOLS-06 in MILESTONES.md.

### What Was Done

| Task | Complexity | Notes |
|------|------------|-------|
| Audit tools page for dead Fibonacci import/tab | Low | Removed from `app/tools/page.tsx` |
| Remove orphaned `fibonacciLevels` from `lib/calculators.ts` | Low | Confirmed removed — grep returns zero matches |
| Verify build passes cleanly | Low | `npm run build` passes |

This was a cleanup task, not a feature. Zero user-facing work.

---

## Cross-Feature Dependencies

```
Settings page overhaul
  └─ Component split first → Then add layout templates UI section within display tab or dashboard
  └─ Admin panel as config source → Lives in admin-settings tab (existing)

Email URL auto-detection
  └─ lib/email.ts getAppUrl() → Extend to accept optional request
  └─ /api/auth/* routes → Pass req to email functions
  └─ No settings UI changes needed (admin app_url field already exists)

Admin panel as config source
  └─ SYSTEM_KEYS array in /api/admin/settings/route.ts → Extend
  └─ AI and symbol search routes → Add _system fallback reads

Dashboard layout templates
  └─ DashboardShell.tsx → Add template UI in edit mode toolbar
  └─ New settings key dashboard_templates (no schema change)
  └─ Load/save via existing /api/settings PUT

Strategy/checklist enhancements
  └─ lib/strategies.ts (new) → Consolidate DEFAULT_STRATEGIES
  └─ DB migration 022 → checklist_custom JSON column
  └─ DB migration 023 → checklist_items format change (comma string → JSON array)
  └─ StrategyChecklist component → Add "No Strategy" + custom items section
```

---

## Complexity vs Value Matrix

| Feature | User Value | Implementation Complexity | Build Order |
|---------|------------|--------------------------|-------------|
| Fibonacci cleanup | Low (hygiene) | Very Low | Resolved in Phase 17 |
| Email URL auto-detection | High (fixes real deployments) | Low | Early |
| Admin panel API keys fallback | High (self-hosted UX) | Low | Early |
| Settings component split | Medium (DX, maintainability) | Medium | Mid |
| Settings full-width layout | Low-Medium (polish) | Very Low | Same pass as split |
| Dashboard layout templates | Medium (power user) | Low-Medium | Mid |
| Strategy defaults consolidation | Medium (correctness) | Low | Early |
| Ad-hoc checklist (no strategy) | Medium | Low | Mid |
| Per-trade custom checklist items | Medium | Medium (migration needed) | Later |
| Checklist score badge | Low (nice) | Very Low | Later |
| Built-in dashboard templates | Medium (onboarding) | Low | With templates |

---

## Sources

- Codebase analysis: `app/settings/page.tsx`, `components/TradeModal.tsx`, `lib/email.ts`, `lib/db.ts`, `app/api/admin/settings/route.ts`, `components/dashboard/DashboardShell.tsx`
- TradesViz per-trade checklist UX patterns: [TradesViz Blog — Trade Plans](https://www.tradesviz.com/blog/trading-plan-checklist/) — MEDIUM confidence (competitor analysis)
- Next.js X-Forwarded-Host header behavior: [Next.js Discussion #34571](https://github.com/vercel/next.js/discussions/34571), [Cloudflare HTTP headers docs](https://developers.cloudflare.com/fundamentals/reference/http-headers/) — MEDIUM confidence (deployment-environment dependent)
- Admin panel config override pattern: [WorkAdventure self-hosting docs](https://docs.workadventu.re/admin/admin-self-hosting/) — MEDIUM confidence (confirms established pattern)
- Settings sidebar navigation best practices: [UX Planet sidebar guide](https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2) — MEDIUM confidence (general UX consensus)
- Dashboard template/preset UX: Market pattern from Notion, Linear, Retool — HIGH confidence for the concept; LOW for trading-specific implementations
