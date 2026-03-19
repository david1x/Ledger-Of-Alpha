# Domain Pitfalls

**Domain:** Settings page restructuring, email URL auto-detection, dashboard layout templates, strategy/checklist enhancements, admin panel as config source — added to existing Next.js 15 + SQLite trading journal
**Researched:** 2026-03-19
**Confidence:** HIGH (direct codebase analysis of the exact files being modified)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or feature failure.

---

### Pitfall 1: Deleting SMTP/Email Settings During the Admin Panel Refactor

**What goes wrong:** The `admin-settings` tab in the existing settings page renders fields for `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `smtp_from`, and `app_url`. These are stored in the `_system` user_id row of the settings table (migration 005). When the settings page is split into sub-components or tabs are reorganised, a developer who doesn't realise these fields already exist may omit them from the new structure, leaving admin email config permanently missing from the UI. The DB rows remain intact but there is no way for the admin to edit them.

**Why it happens:** The settings page is 2380+ lines of interleaved state, rendering, and event handlers. During component extraction it is easy to assume "I'll wire up the admin section later" and then forget which fields live in `SystemSettings` vs `Settings` interface, or drop the `loadSysSettings` / `saveSysSettings` calls when the file is split.

**Consequences:**
- Email verification, password reset, and 2FA OTP emails continue to work (lib/email.ts reads from DB) but the admin can no longer update the configuration.
- SMTP config must be changed via raw SQLite query or by re-seeding migration 005.
- If `app_url` disappears from the UI, email links silently fall back to `process.env.NEXT_PUBLIC_APP_URL` (line 59 of lib/email.ts) which may be wrong or unset in Docker deployments.

**Prevention:**
- Identify the `SystemSettings` interface (lines 92-102 of settings/page.tsx) and `loadSysSettings` / `saveSysSettings` functions before the refactor begins. These must survive the split intact.
- The `admin-settings` tab content and the `SYSTEM_KEYS` allowlist in `app/api/admin/settings/route.ts` must match exactly — any key present in the UI form must be in `SYSTEM_KEYS` or the POST silently ignores it.
- Write a checklist before refactor: every field in `SYS_DEFAULTS` (account_size, risk_per_trade, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, app_url) must appear in the extracted admin settings component.

**Detection:** After refactor, open Settings > System tab and verify all SMTP fields and the APP URL field are present and saveable. Test round-trip: save a value, reload the page, confirm the value is still shown.

**Phase:** Settings overhaul phase (highest risk).

---

### Pitfall 2: dashboard_layout Backwards Compatibility — Templates Must Not Overwrite User Order

**What goes wrong:** The `dashboard_layout` setting stores JSON with three keys: `order` (string[]), `hidden` (string[]), and `sizes` (Record<string, WidgetSize>). The DashboardShell already has migration logic for this format (lines 360-380 of DashboardShell.tsx). Dashboard layout templates are a new feature that saves and loads named presets of this same JSON. The pitfall: if applying a template overwrites the `dashboard_layout` settings key directly, the user's current layout is gone with no undo.

**Why it happens:** The simplest implementation of "apply template" is `PUT /api/settings { dashboard_layout: templateJson }`, which is exactly what the current save mechanism does. The template feature reuses the same key — and the same save path — so applying a template is indistinguishable from a user manually reordering widgets. After a page refresh, the user's prior layout is permanently replaced.

**Consequences:**
- No recovery path. SQLite has no row versioning. The previous layout JSON was in the settings row that was just overwritten.
- Users who spent time customising their 24+ widget layout will lose it entirely if they accidentally apply the wrong template.

**Prevention:**
- Templates are stored under a **separate settings key** (`dashboard_templates`), never in `dashboard_layout`. Format: `{ templates: Array<{ id: string; name: string; layout: DashboardLayout }> }`.
- Applying a template calls the existing `saveLayout()` path (which writes to `dashboard_layout`) — this is correct. The user is choosing to replace their layout. Add a confirmation dialog: "Apply template '[name]'? Your current layout will be replaced."
- Offer a "Save current as template" action that reads the current layout state and appends it to `dashboard_templates` — never the reverse.
- The DashboardShell's merge logic (lines 362-379) that handles new widgets added since the last save must also run when a template is applied, so newly added widget IDs are not lost.

**Detection:** Apply a template, then verify (a) the dashboard reflects the template layout and (b) the user's previous layout could have been preserved as a named template if desired.

**Phase:** Dashboard layout templates phase.

---

### Pitfall 3: Email URL Auto-Detection Using request.headers Host — Docker Networking Mismatch

**What goes wrong:** The natural implementation of email URL auto-detection reads the `host` or `x-forwarded-host` header from the incoming request: `const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')`. In a Docker Compose setup where the Next.js container is addressed as `app:3000` internally, the `host` header received by the Node process may be the Docker service name, not the externally accessible hostname. Emails sent using this detected URL contain links like `http://app:3000/verify-email?token=X` that are unreachable from the user's browser.

**Why it happens:** During local development, `req.headers.get('host')` returns `localhost:3000`, which is correct. In Docker, it depends on how the reverse proxy (Nginx, Traefik, Cloudflare tunnel) sets headers. Cloudflare tunnel always provides `x-forwarded-host` with the public hostname, but only if the tunnel is configured to pass headers — a non-default behaviour.

**Consequences:**
- Email verification links are broken in Docker deployments without extra config.
- Cloudflare tunnel URLs work only if the tunnel is configured to forward the `Host` header, which requires an explicit rule.
- The fallback chain in `lib/email.ts` line 59 (`process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`) is the safety net but is ENV-based and defeats the purpose of auto-detection.

**Prevention:**
- Implement a priority chain for URL resolution, evaluated in order:
  1. `app_url` setting in `_system` settings (admin-configured, explicit, highest priority)
  2. `x-forwarded-host` header with scheme from `x-forwarded-proto`
  3. `host` header with scheme inferred from TLS state
  4. `NEXT_PUBLIC_APP_URL` env var
  5. `http://localhost:3000` (last resort fallback)
- Expose the detected URL in the admin settings UI so the admin can see what the system resolved and override it with the `app_url` setting key if wrong. Show: "Auto-detected: http://app:3000 — Override below if incorrect."
- Document in the admin UI that `app_url` should always be set in Docker and Cloudflare tunnel deployments — auto-detection from headers is unreliable in those modes.
- The `getAppUrl()` function in lib/email.ts (line 52) already implements the DB-then-env fallback. The auto-detection from request headers requires a separate helper that accepts a `NextRequest` parameter and is called from API routes (not from lib/email.ts directly, which has no request context).

**Detection:** Deploy behind a Docker Compose setup (or Cloudflare tunnel) with `app_url` unset in admin settings. Register a new user and click the verification link — it must load correctly.

**Phase:** Email URL auto-detection phase.

---

### Pitfall 4: Per-Trade Checklist Editing — Storing Completed State vs Template State

**What goes wrong:** The existing strategy system stores checklist items as `string[]` per strategy (e.g. `["Downside objective accomplished", "Activity bullish"]`). Per-trade checklists add a checked/unchecked state per item. The pitfall is storing the completion state in the same `strategies` settings key, mixed with the template definition. If a trade's checklist responses are saved back to the global strategies setting, every trade using that strategy shows the same completed items — the last trade's responses.

**Why it happens:** The quickest approach is to add a `completed: boolean[]` parallel array to the strategy object in settings JSON. This conflates two separate concerns: the template definition (what items exist) and the per-trade state (which items were checked for a specific trade).

**Consequences:**
- Opening any trade using "Wyckoff Buying Tests" shows whatever checkboxes the last completed trade checked. Prior trades look like they're checked differently depending on which trade was opened last.
- If the user updates a checklist template (adds/removes an item), all saved per-trade states become misaligned — indices shift.

**Prevention:**
- Per-trade checklist state is stored on the **trade record itself** (a new `checklist_state` TEXT column on the `trades` table, storing JSON). Format: `{ strategyId: string; items: Array<{ text: string; checked: boolean }> }`. The `text` field is a snapshot of the item text at the time the trade was created — this makes it immutable even if the template is later edited.
- The global `strategies` setting remains a pure template: `{ id, name, checklist: string[] }`. No completion state ever touches it.
- When opening the trade modal with an existing trade, load `checklist_state` from the trade record. When creating a new trade with a selected strategy, initialise `checklist_state` from the current template (snapshot the item texts at that moment).
- Migration required: `ALTER TABLE trades ADD COLUMN checklist_state TEXT` (migration 022 or next available number).

**Detection:** Create two trades using the same strategy, check different boxes on each. Reopen both trades and verify each shows its own checklist state.

**Phase:** Strategy/checklist enhancements phase.

---

### Pitfall 5: Settings Page Split — One Giant State Object Shared Across All Tabs

**What goes wrong:** The entire settings page operates from a single `settings` state object of type `Settings` (the interface at lines 31-57). The `save()` function sends the entire object with `PUT /api/settings`. When the page is split into sub-components, each sub-component needs to read from and write to this shared state. Developers who pass the full `settings` object and `setSettings` setter down as props create tightly coupled components that cannot be loaded or tested independently. Developers who duplicate state per-component produce silent divergence — the "Account" tab's local copy of `account_size` drifts from the "Integrations" tab's copy, and whichever tab saves last wins.

**Why it happens:** The monolith works because everything is in one closure. Splitting it without a strategy produces the N-props antipattern or duplicated state.

**Prevention:**
- Before splitting, audit which settings keys belong to which tab and ensure each key appears in exactly one tab's UI. Use the existing `CATEGORIES` array as the canonical grouping.
- Each extracted sub-component receives only the slice of settings it needs: e.g., `IntegrationsTab` receives `{ discord_webhook, alert_discord_webhook, fmp_api_key, openai_api_key }` and an `onChange` callback that merges back into parent state.
- The parent `SettingsContent` component retains the single `settings` state and the single `save()` call. Sub-components are purely presentational — they display and emit changes, they do not own state or call the API.
- The admin system settings (`sysSettings` state, `loadSysSettings`, `saveSysSettings`) are already separate state — keep them separate. Do not merge them into the main `settings` object.
- The 2FA state, IBKR state, and accounts state are also already isolated — keep them in the parent or in per-section state, not in the main `settings` object.

**Detection:** Change a value in tab A, switch to tab B, switch back to tab A, click Save. The value changed in tab A must still be present in the saved payload.

**Phase:** Settings overhaul phase.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-visible bugs but don't require fundamental redesigns.

---

### Pitfall 6: Admin Panel as Config Source — env Vars Read at Build Time vs Runtime

**What goes wrong:** When migrating from `.env`-based config to DB-based config (admin panel as source of truth), some config values that used to be in `.env` may have been referenced in `next.config.ts` or used at build time. Build-time env vars are baked into the Next.js bundle at `npm run build` time. If `NEXT_PUBLIC_APP_URL` was previously used in client-side code (the `NEXT_PUBLIC_` prefix makes it client-readable), switching to a DB-sourced value requires an API call — it cannot be substituted transparently.

**Why it happens:** `NEXT_PUBLIC_APP_URL` is referenced in lib/email.ts line 59 as a fallback. If client-side components or email templates are updated to also call an API to fetch the app URL dynamically, but the build still has the old `NEXT_PUBLIC_APP_URL` baked in, you get inconsistent behaviour between build-time and runtime resolution.

**Prevention:**
- `app_url` is a server-side-only value used in email link construction. It is never needed in client-side code. Do not add `NEXT_PUBLIC_` prefix to any admin-panel-sourced config values.
- The existing `getAppUrl()` function in lib/email.ts is server-only (it calls `getDb()`). Keep all URL resolution there.
- After the migration, `NEXT_PUBLIC_APP_URL` in `.env.example` can be marked as deprecated/optional with a comment pointing to the admin panel setting.
- `serverExternalPackages` in `next.config.ts` does not need modification — admin panel settings are read at request time via the existing API route and DB layer.

**Detection:** Run `npm run build` with `NEXT_PUBLIC_APP_URL` unset. The build should succeed. Email links should still work based on DB config alone (if `app_url` is set in admin panel) or fall back to localhost gracefully.

**Phase:** Admin panel config source phase.

---

### Pitfall 7: Strategy Enhancements — Built-In Default Strategies Overwriting User Customisations

**What goes wrong:** The five built-in default strategies (Wyckoff Buying/Selling Tests, Momentum Breakout, Mean Reversion, EMA Pullback) are currently hardcoded as the initial value of the `settings` state in `SettingsContent` (lines 208-214 of settings/page.tsx). They are written to the DB only when the user saves settings. If a user has customised these strategies (renamed them, added items, deleted one), and a future code change re-seeds them via a database migration or `INSERT OR IGNORE` logic, the user's customisations would be overwritten.

**Why it happens:** Developers adding "built-in default strategies" as a feature might implement it as a migration that `INSERT OR IGNORE`s the default strategies into the settings table. If the user has never saved their strategies settings key to the DB, the key is absent and the migration creates it — this is safe. But if the user has saved it, the migration should skip it. `INSERT OR IGNORE` handles this correctly only if the key is the same.

**Prevention:**
- Default strategies are a **client-side fallback only** — the hardcoded initial state in `SettingsContent`. They are never written to the DB by migrations.
- If the feature requires "restore defaults" functionality, implement it as an explicit user action (a "Reset to defaults" button), never as an automatic migration.
- New built-in strategies added in a future version should be merged into the user's existing list (appended if their ID is not already present), not replace the entire list.
- If a `strategies` DB row does not exist for a user, `GET /api/settings` returns no value and the client falls back to the hardcoded defaults — this is the current correct behaviour.

**Detection:** Save custom strategy modifications, restart the app (or run any migrations), and verify the customised strategies are still present.

**Phase:** Strategy enhancements phase.

---

### Pitfall 8: Ad-Hoc Checklists — No Strategy Selected Edge Case in Trade Modal

**What goes wrong:** Strategies currently drive the Wyckoff checklist in the trade modal. The v2.1 enhancement adds ad-hoc checklists — checklist items the trader can add on a per-trade basis without selecting a named strategy. The edge case: if a trade has both a `strategy_id` pointing to a deleted strategy and ad-hoc checklist items in `checklist_state`, the rendering must handle the case where the strategy template no longer exists.

**Why it happens:** Strategies are soft data (stored as JSON in the `strategies` settings key). Deleting a strategy from settings does not cascade to trade records that referenced it. `checklist_state` stores a snapshot of item texts, so the items themselves are preserved — but the strategy name and ID are dangling references.

**Prevention:**
- Render `checklist_state` from the trade record, not by looking up the strategy in current settings. Since `checklist_state` snapshots the item text at trade creation time, the UI can always show the checklist regardless of whether the strategy template still exists.
- When the strategy referenced by `strategy_id` no longer exists in the `strategies` settings, label the checklist as "[Strategy Deleted]" rather than hiding it or throwing an error.
- The `strategy_id` column on trades (or whichever field stores this link) should be treated as a display hint only, not a foreign key dependency for checklist rendering.

**Detection:** Create a trade with strategy "Wyckoff Buying Tests" and some boxes checked. Delete the strategy from settings. Reopen the trade — the checklist items must still be visible.

**Phase:** Strategy/checklist enhancements phase.

---

### Pitfall 9: Settings Page Full-Width Layout — Sidebar Navigation on Small Screens

**What goes wrong:** The v2.1 settings overhaul changes from a sidebar layout to a full-width desktop layout. The existing settings page uses `?tab=` query params for navigation and a vertical sidebar of categories. If the full-width layout removes the sidebar in favour of horizontal tabs or a top nav, the existing external links that use `?tab=account`, `?tab=admin-settings`, etc. (found in Navbar.tsx, the admin claim redirect, and any in-app "go to settings" buttons) will break if the tab ID scheme changes.

**Why it happens:** Redesigning a page layout often involves renaming navigation items or restructuring tabs. If `category === "admin-settings"` becomes `section === "system"` in the new layout, any URL with `?tab=admin-settings` navigates to the wrong section silently (falling back to the first tab).

**Prevention:**
- Keep the `?tab=` query parameter scheme and the Category type values unchanged. The full-width layout is a visual restructuring, not a URL/navigation restructuring.
- Search for all usages of `?tab=` before the refactor: `grep -r 'tab=' app/ components/ lib/` — every one must be verified still works after the change.
- The line `const initialCategory = (searchParams.get("tab") ?? "account") as Category` (line 198) must remain unchanged in the new structure.
- The account claim redirect on line 455 (`window.location.href = "/admin"`) assumes an `/admin` route exists. If the admin panel moves into the settings page, update this redirect.

**Detection:** Visit `/settings?tab=admin-settings` after the refactor and confirm the System settings tab loads directly.

**Phase:** Settings overhaul phase.

---

### Pitfall 10: Dashboard Layout Templates — Template Widget IDs Referencing Removed Widgets

**What goes wrong:** The `ALL_WIDGETS` array in DashboardShell.tsx defines the canonical set of 39 widget IDs. If a saved template references a widget ID that no longer exists (e.g., a widget is renamed or removed in a future version), loading the template produces a hidden widget that renders nothing or an order array with a dangling ID.

**Why it happens:** The existing `dashboard_layout` already has this problem — the merge logic on lines 362-379 handles it by filtering unknown IDs. Template storage introduces the same risk on a longer timescale (templates persist indefinitely).

**Prevention:**
- Reuse the existing merge logic when applying a template: filter out any widget IDs not present in the current `ALL_WIDGETS` array before applying the template layout.
- The template save timestamp should be stored with the template so developers can detect "stale" templates on a future widget restructure.
- Template application uses `saveLayout()` which already writes to `dashboard_layout` — the existing new-widget-merge logic will run on next page load, adding any new widgets not in the template.

**Detection:** Save a template. Remove a widget ID from `ALL_WIDGETS` (simulating a future widget removal). Apply the template — the removed widget ID must not appear in the order array and the dashboard must render without error.

**Phase:** Dashboard layout templates phase.

---

### Pitfall 11: Admin Panel Config Source — Nodemailer Transport Created Per-Request Without Caching

**What goes wrong:** `lib/email.ts` calls `getSmtpConfig()` which queries the DB on every `send()` call, then creates a new `nodemailer.createTransport()` instance per email sent. This is fine for the current usage (registration, password reset, price alerts — all low frequency). But the admin panel "Test SMTP" feature, if implemented naively, may call `send()` in a loop or fire multiple rapid test emails. Each call re-queries the DB and creates a new transport — not a correctness issue, but an unnecessary overhead pattern.

**Prevention:**
- The current pattern (DB query per send) is acceptable for this application's email volume. Do not cache the transport as a module-level singleton — the admin can change SMTP config via the panel, and a cached transport would use stale credentials.
- For the "Test SMTP" feature, send exactly one test email and show the result. Do not provide a "send multiple" option.
- If caching is added in future, invalidate the cache when the admin panel saves new SMTP settings.

**Phase:** Admin panel config source phase.

---

### Pitfall 12: Settings Page Split — TypeScript Type Coverage Lost During Component Extraction

**What goes wrong:** The monolithic `SettingsContent` function has the full `Settings` and `SystemSettings` interfaces defined at the top of the file. When extracting sub-components into separate files, developers who copy the component code without the type interfaces get implicit `any` types on props. With `strict: false` in tsconfig or the build passing without type errors (because the interfaces are re-inferred), the type safety is silently lost.

**Prevention:**
- Move `Settings`, `SystemSettings`, `Category`, `CATEGORIES`, `AdminUser`, and `SYS_DEFAULTS` to a shared `lib/settings-types.ts` file before splitting. Import from there in both the parent page and all sub-components.
- Run `npm run build` after each component extraction step — TypeScript errors surface immediately.
- Do not use `any` in props types for the extracted components. Each component props interface should be explicit.

**Detection:** Run `npm run build` on the split result with zero TypeScript errors.

**Phase:** Settings overhaul phase.

---

## Minor Pitfalls

---

### Pitfall 13: Template Naming — Collision with Reserved Names

**What goes wrong:** If the template storage format uses the template name as its key, two templates named the same thing silently overwrite each other.

**Prevention:** Templates use `crypto.randomUUID()` as their `id` (consistent with how strategies are handled in the existing code). The `name` is display-only and can be duplicated without consequence.

**Phase:** Dashboard layout templates phase.

---

### Pitfall 14: Full-Width Settings Layout — Long Category List Not Scrollable on Short Screens

**What goes wrong:** The current settings sidebar has 13 categories. A full-width layout that renders them as horizontal tabs may overflow on screens narrower than 1200px, hiding the rightmost tabs behind the viewport edge with no scroll affordance.

**Prevention:** Horizontal tab rows for 13+ items need either (a) horizontal scroll with visible overflow, (b) a dropdown overflow for excess tabs, or (c) grouping tabs into sections. Decide on the approach in the design phase, not during implementation.

**Phase:** Settings overhaul phase.

---

### Pitfall 15: Per-Trade Checklist — Migration Number Conflict

**What goes wrong:** The DB is through migration 021. If two phases of v2.1 both add migrations and the developer uses the same migration name or number, one migration never runs (due to the `hasMigration` guard using the name as the dedup key).

**Prevention:** Assign migration names sequentially from 022. Use descriptive names: `022_trade_checklist_state`, `023_dashboard_templates`, etc. Check `lib/db.ts` migration list before every new migration to confirm the name is unused.

**Phase:** Every phase adding a migration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Settings overhaul — component split | Admin SMTP/email fields lost during extraction | Audit `SystemSettings` interface before splitting; verify all fields survive |
| Settings overhaul — component split | Shared state diverges across sub-components | Parent owns all state; sub-components receive slices via props |
| Settings overhaul — layout redesign | `?tab=` external links break if Category IDs change | Keep Category type values unchanged; search for all `?tab=` usages first |
| Settings overhaul — TypeScript | Implicit `any` when types not co-located with sub-components | Extract type interfaces to `lib/settings-types.ts` before splitting |
| Email URL auto-detection | Docker `host` header is container service name, not public hostname | Priority chain: DB app_url > x-forwarded-host > host header > env var |
| Email URL auto-detection | Cloudflare tunnel needs explicit header forwarding config | Show detected URL in admin UI; document Docker/tunnel override |
| Admin panel as config source | env vars read at build time vs runtime | `app_url` is server-only; never add NEXT_PUBLIC_ prefix to admin-sourced config |
| Admin panel as config source | SYSTEM_KEYS allowlist and UI fields out of sync | Every UI field must map to a key in SYSTEM_KEYS; verify on both sides |
| Dashboard layout templates | Applying template overwrites user layout with no undo | Separate `dashboard_templates` key; confirmation dialog before applying |
| Dashboard layout templates | Template stores deleted widget IDs | Filter template order array against current ALL_WIDGETS on apply |
| Dashboard layout templates | Template name collision | Use UUID as template ID; name is display-only |
| Strategy enhancements — defaults | Built-in defaults overwrite user customisations via migration | Defaults are client-side fallback only; never seed via migration |
| Strategy enhancements — per-trade checklist | Completion state mixed with template definition | `checklist_state` on trade record; `strategies` setting is template-only |
| Strategy enhancements — ad-hoc checklists | Deleted strategy breaks checklist rendering | Render from `checklist_state` snapshot, not from current strategy lookup |
| All phases — migrations | Migration number/name conflict | Assign sequentially from 022; check lib/db.ts before every new migration |

---

## Sources

- Direct codebase analysis: `app/settings/page.tsx` (lines 1-500), `lib/email.ts`, `lib/db.ts` (migrations 001-021), `app/api/admin/settings/route.ts`, `components/dashboard/DashboardShell.tsx` (lines 1-430), `app/api/auth/register/route.ts`
- Confidence: HIGH — all pitfalls derived from reading the exact code that will be modified, not from training data assumptions
