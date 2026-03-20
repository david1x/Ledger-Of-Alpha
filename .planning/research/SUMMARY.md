# Project Research Summary

**Project:** Ledger Of Alpha v2.1 — Settings & Polish
**Domain:** Self-hosted trade journaling platform — settings overhaul, deployment improvements, dashboard templates, strategy/checklist enhancements
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Ledger Of Alpha v2.1 is a pure polish and refinement milestone applied to an existing, validated trading journal built on Next.js 15, TypeScript, Tailwind CSS v3, and SQLite (better-sqlite3). All five feature clusters target improvements to existing surfaces — there are no net-new capabilities, no new npm packages to install, and no new database tables required beyond a single optional column (`checklist_state` on the `trades` table via migration 022). The foundational stack is already proven in production; this milestone's complexity is entirely in integration discipline rather than technology selection.

The recommended execution approach is to work feature-by-feature in dependency order: email URL auto-detection first (server-only, zero UI risk, high deployment value), followed by settings component extraction (the largest mechanical refactor), then dashboard layout templates (self-contained in DashboardShell), then per-trade checklist editing (moderate DB concern). Each feature integrates into a clearly identified extension point in the existing codebase with no structural rewrites. The admin panel config expansion is a minor additive change best done as a final cleanup pass.

The primary risks are all integration-level rather than architectural: the settings monolith split requires careful management of shared state to prevent data loss; email URL auto-detection must implement the correct header priority chain to handle Docker and Cloudflare Tunnel deployments; and per-trade checklist editing must snapshot item text at trade-creation time rather than referencing the mutable strategy template. Every pitfall has a documented prevention pattern derived from direct codebase analysis. This milestone has no external unknowns.

## Key Findings

### Recommended Stack

**Zero new dependencies.** Every v2.1 feature is implementable with the existing dependency set: Next.js 15 Route Handlers (`NextRequest.headers`), built-in `crypto.randomUUID()`, SQLite via better-sqlite3, `@dnd-kit` (already installed), and `lucide-react`. The stack is unchanged from v2.0. One DB migration is required — additive only: migration 022 adds `checklist_state TEXT` to the `trades` table. Dashboard templates require no DB migration (stored in the existing settings JSON key pattern).

**Core technologies (unchanged from v2.0):**
- **Next.js 15 (App Router):** Route Handlers with `NextRequest.headers` power email URL auto-detection — documented, synchronous API
- **better-sqlite3:** Additive migration via `lib/db.ts` inline pattern; no schema restructuring needed
- **@dnd-kit:** Already installed; reused for checklist item reordering in TradeModal
- **Tailwind CSS v3:** Full-width settings layout requires removing a single class (`sm:max-w-2xl`)
- **`crypto.randomUUID()`:** Built-in browser/Node.js API; used for template IDs with no external UUID package needed

### Expected Features

**Must have (table stakes):**
- Settings sidebar navigation and `?tab=` deep-link routing must survive the component split intact — external links from TradeModal and Navbar depend on this
- Email verification links work in Docker and Cloudflare Tunnel deployments without manual URL configuration
- Admin panel is the single source for deployment-critical config (SMTP, app_url) with no .env editing required for runtime changes
- Built-in default strategies ship with the app so new users never see an empty strategies list
- Per-trade checklist state is preserved independently for each trade, not shared via the global strategy template
- FibCalculator dead references removed from tools page and routing (completed in Phase 17)

**Should have (differentiators):**
- Dashboard layout templates with named presets (save/load/delete) surfaced in edit mode toolbar
- Ad-hoc checklist support on trades with no strategy selected
- "Auto-detected URL" read-only display in admin panel showing what the system resolved
- Built-in dashboard template presets (Performance Review, Daily Monitoring, Minimal Stats)
- Checklist completion score badge on trade cards (computed from stored data, no new columns)

**Defer to v2.2+:**
- Search within settings (useful at 13+ tabs but overkill at current count)
- Per-tab save with unsaved-change indicator (single save button is acceptable for launch)
- Dashboard template preview thumbnails and URL sharing
- In-modal strategy template editing (high complexity, conflates per-trade and template concerns)
- Per-strategy performance breakdown (GROUP BY strategy_id — easy but a separate feature scope)
- Audit log for admin config changes

### Architecture Approach

All features integrate into existing extension points with no structural rewrites. The settings monolith (`app/settings/page.tsx`, ~2380 lines) splits into 13 self-contained section components under `components/settings/`, each owning its own data fetching and save lifecycle — the parent shell retains navigation and `isAdmin` state only. Email URL detection is centralized in a new `lib/request-url.ts` helper (`getRequestBaseUrl(req)`) that implements a five-level priority chain and is called from auth API route handlers. Dashboard templates follow the exact pattern already used for strategies: JSON array stored in a settings key (`dashboard_layout_templates`), with no new API route or DB table. Per-trade checklists store a snapshot of item text at creation time in a new `checklist_state` column, preventing drift when strategy templates are later edited.

**Major components:**
1. `components/settings/*Section.tsx` (x13, new) — Extracted section components; each self-contained with local state and own `/api/settings` GET/PUT calls
2. `lib/request-url.ts` (new) — `getRequestBaseUrl(req)`: five-level URL priority chain for email link generation
3. `components/dashboard/DashboardShell.tsx` (modified) — Template save/load/apply UI added to edit mode header; `dashboard_layout_templates` settings key
4. `components/TradeModal.tsx` (modified) — Inline checklist editor with ad-hoc item support; reads/writes `checklist_state` on the trade record
5. `app/api/admin/settings/route.ts` (optional minor modification) — SYSTEM_KEYS expansion for API key system-level fallbacks

**Key patterns to follow:**
- Each settings section component owns its own data lifecycle (fetch on mount, save on demand) — no shared global settings state across sections
- JSON-in-settings for simple collections (templates follow the strategies pattern exactly)
- Backward-compatible JSON field evolution via a `parseChecklistItems()` reader that handles both legacy `Record<string, boolean>` and new `{ items: Array<{text, checked}>, customized: bool }` formats
- Request-aware URL resolution: API route handler calls `getRequestBaseUrl(req)`, passes result to email functions as optional `baseUrl` param

### Critical Pitfalls

1. **Admin SMTP fields lost during settings split** — The `SystemSettings` interface and `loadSysSettings`/`saveSysSettings` functions must be audited before splitting begins. Every field in `SYS_DEFAULTS` (account_size, risk_per_trade, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, app_url) must appear in the extracted `AdminSystemSection`. The `SYSTEM_KEYS` allowlist in the admin API must match the UI form fields exactly — any mismatch causes silently ignored POSTs.

2. **Dashboard template apply overwrites user layout with no undo** — Templates must live under a separate settings key (`dashboard_templates`), never in `dashboard_layout`. Applying a template requires a confirmation dialog. The existing new-widget merge logic in DashboardShell must also run on template application to handle widget IDs added since the template was saved.

3. **Email URL Docker networking mismatch** — In Docker Compose, `req.headers.get('host')` returns the container service name (e.g., `app:3000`), not the public hostname. The priority chain must be enforced: `app_url` DB setting > `x-forwarded-host` + `x-forwarded-proto` > `host` header > env var > localhost fallback. Expose the auto-detected URL read-only in the admin UI so admins can see what was resolved and override it.

4. **Per-trade checklist state mixed with strategy template** — Completion state must be stored on the trade record (`checklist_state` JSON column with text snapshots at creation time), never in the global `strategies` settings key. This prevents cross-trade contamination and ensures checklist items remain readable even after strategy templates are edited or deleted.

5. **Settings split shared state divergence** — The parent shell retains the single `settings` state object; sub-components receive only their required slice via props. Alternatively, each section self-fetches on mount (acceptable at SQLite speeds). Do not duplicate state across section components — whichever tab saves last silently wins, corrupting other tabs' pending changes.

## Implications for Roadmap

The four main features have no cross-dependencies and can be executed in any order. The recommended sequence is ordered by risk profile (lowest-risk, highest-value first) and avoids merge conflicts between phases.

### Phase 1: Email URL Auto-Detection

**Rationale:** Lowest risk (server-only, no UI changes), highest deployment value, and fastest to verify. Delivering this first validates the `lib/request-url.ts` helper in isolation before other phases begin and gives Docker/tunnel users working email links immediately.

**Delivers:** Email verification, password reset, and OTP links that work correctly in Docker, Cloudflare Tunnel, and nginx reverse proxy deployments without manual URL configuration. Optional: read-only "Auto-detected URL" display in admin panel.

**Addresses:** Feature Cluster 2 from FEATURES.md (Email URL auto-detection).

**Avoids:** Pitfall 3 (Docker `host` header returning container service name). Implement the full five-level priority chain; show detected URL in admin UI for transparency.

**Research flag:** SKIP — standard Next.js Route Handler header API; ~30 lines across 4 files.

---

### Phase 2: Settings Page Component Split + Full-Width Layout

**Rationale:** The largest mechanical change in the milestone. Must be done before any individual section content is modified (e.g., Strategies section in Phase 4) to prevent merge conflicts. Full-width layout is a single class removal applied in the same pass.

**Delivers:** Settings page split into 13 self-contained section components under `components/settings/`; full-width desktop layout; `?tab=` routing unchanged; `lib/settings-types.ts` with shared type interfaces extracted first.

**Addresses:** Feature Cluster 1 from FEATURES.md (Settings page overhaul — component split, full-width layout, tab reorganization if needed).

**Avoids:** Pitfall 1 (admin SMTP fields lost — pre-split audit of `SYS_DEFAULTS` fields required); Pitfall 5 (shared state divergence — parent shell owns state, sections receive props); Pitfall 9 (`?tab=` URL links breaking — Category type values must remain unchanged); Pitfall 12 (TypeScript types lost — extract to `lib/settings-types.ts` before splitting); Pitfall 14 (13 categories in horizontal layout overflowing — keep vertical sidebar nav).

**Mandatory pre-split checklist:** Audit `SystemSettings` interface; list all `SYS_DEFAULTS` fields; extract types to `lib/settings-types.ts`; search for all `?tab=` usages; run `npm run build` after each section extraction.

**Research flag:** SKIP — pure component decomposition of existing code. Risk is in execution discipline, not unknowns.

---

### Phase 3: Dashboard Layout Templates

**Rationale:** Self-contained within `DashboardShell.tsx`. No auth or email concerns. Delivers visible user-facing value (named presets) using the exact same JSON-in-settings pattern already proven for strategies, trade templates, and watchlists.

**Delivers:** Save/load/delete named dashboard layout presets; 2-3 built-in template presets (Performance Review, Daily Monitoring, Minimal Stats); template controls in edit mode header dropdown.

**Addresses:** Feature Cluster 4 from FEATURES.md (Dashboard layout templates). Defers preview thumbnails and URL sharing.

**Avoids:** Pitfall 2 (template apply overwrites user layout — separate `dashboard_templates` key + confirmation dialog); Pitfall 10 (stale widget IDs — filter template order array against current `ALL_WIDGETS` on apply); Pitfall 13 (name collision — use UUID as template ID, name is display-only).

**Research flag:** SKIP — identical to strategies JSON-in-settings pattern; already proven in codebase.

---

### Phase 4: Strategy + Checklist Enhancements

**Rationale:** Requires the only DB migration in the milestone (`checklist_state` column, migration 022). Depends on the Strategies section being accessible (stabilized in Phase 2). Most nuanced data-correctness requirements of any phase — must clearly distinguish per-trade state from template definition.

**Delivers:** Built-in default strategies from a single source of truth (`lib/strategies.ts`); per-trade checklist editing with text snapshots in `checklist_state`; ad-hoc checklists for trades with no strategy selected; graceful "[Strategy Deleted]" rendering for deleted strategy references.

**Addresses:** Feature Cluster 5 from FEATURES.md (Strategy + checklist enhancements). Defers checklist score badge and per-strategy performance breakdown.

**Avoids:** Pitfall 4 (per-trade state mixed with template — `checklist_state` column with text snapshot, not global strategies settings); Pitfall 7 (built-in defaults overwriting user customizations — client-side fallback only, never seeded via migration); Pitfall 8 (deleted strategy breaks checklist rendering — render from `checklist_state` snapshot, not from live strategy lookup); Pitfall 15 (migration number conflict — verify next available number in `lib/db.ts` before assigning 022).

**Research flag:** SKIP for strategy defaults consolidation and ad-hoc checklists. Flag the existing `checklist_items` column format — confirm whether actual stored data is `Record<string, boolean>` or comma-delimited string before writing the backward-compat parser.

---

### Phase 5: Admin Panel Config Expansion + Cleanup

**Rationale:** Minor additive change. Expanding `SYSTEM_KEYS` for API key system-level fallbacks is the remaining low-risk cleanup task after the larger refactors are stable and verified. (FibCalculator dead code was resolved earlier in Phase 17.)

**Delivers:** FMP and Gemini API key system-level fallbacks in admin panel (optional, per deployment preference); `NEXT_PUBLIC_APP_URL` marked deprecated/optional in `.env.example`. (FibCalculator dead references were resolved in Phase 17.)

**Addresses:** Feature Cluster 3 (admin panel as config source) and Feature Cluster 6 (FibCalculator cleanup) from FEATURES.md.

**Avoids:** Pitfall 6 (build-time vs. runtime env var confusion — `app_url` and any admin-sourced config must remain server-only, never add `NEXT_PUBLIC_` prefix); Pitfall 11 (nodemailer transport created per-request — acceptable at this email volume, do not cache as singleton that persists stale SMTP credentials).

**Research flag:** SKIP — entirely additive to established `SYSTEM_KEYS` pattern.

---

### Phase Ordering Rationale

- **Email first:** Server-only, no UI risk, immediately verifiable in any deployment with email enabled. Establishes `lib/request-url.ts` in isolation.
- **Settings split second:** Largest mechanical change; completing it before any section content is modified prevents merge conflicts in Phase 4 (Strategies section). Foundational for the milestone.
- **Dashboard templates third:** Self-contained in one file; delivers user-visible value with no data migration risk; safe to ship while Phase 4 is being planned.
- **Checklist enhancements fourth:** Only phase with a DB migration (022); doing it later ensures the codebase is stable and the migration can be cleanly verified against a known schema state.
- **Admin cleanup last:** Lowest urgency, no blocking dependencies; a polish pass after all features are stable.

### Research Flags

Phases requiring `/gsd:research-phase` during planning:
- **None.** All features build on patterns already implemented and verified in the existing codebase. Research confidence is HIGH across all four files.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Email URL):** Standard Next.js Route Handler header reading; 30-line implementation across 4 files.
- **Phase 2 (Settings split):** Component extraction following established React patterns; risk is execution discipline only.
- **Phase 3 (Dashboard templates):** Identical to strategies JSON-in-settings pattern; already proven in production.
- **Phase 4 (Checklist):** DB migration following established inline pattern; data model is straightforward.
- **Phase 5 (Admin cleanup):** Additive to existing SYSTEM_KEYS; no new patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed; all required APIs are existing browser/Node.js built-ins or already-installed packages |
| Features | HIGH | Derived from direct codebase analysis of exact files being modified; MEDIUM only for URL auto-detection specifics in non-standard proxy configs |
| Architecture | HIGH | All patterns derived from reading the exact code being modified; no external architectural unknowns |
| Pitfalls | HIGH | All pitfalls identified from direct codebase analysis, not training-data assumptions; each has a concrete prevention strategy |

**Overall confidence:** HIGH

### Gaps to Address

- **Docker/Cloudflare Tunnel URL detection in practice:** The `x-forwarded-host` header behavior varies by proxy configuration. The admin UI displaying the auto-detected URL is the mitigation — surface it clearly and document that `app_url` should always be explicitly set in Docker deployments. Validate with a real Docker Compose setup during Phase 1 execution.
- **Settings split component interface — fetch strategy:** Research files recommend each section self-fetches on mount for independence, but this causes 13 separate settings fetches on tab switch. Confirm this does not produce visible loading flickers before committing to the pattern; if it does, the parent-owns-state prop-drilling alternative is acceptable.
- **Existing `checklist_items` stored format:** The column is described as likely `Record<string, boolean>` but the actual format was not confirmed from codebase read. Inspect real stored values in the SQLite database before writing the backward-compat `parseChecklistItems()` function in Phase 4.
- **FibCalculator dead references:** Confirmed resolved in Phase 17. Component file deleted, orphaned code removed from `lib/calculators.ts`, all dead references in `app/tools/page.tsx` removed.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `app/settings/page.tsx`, `lib/email.ts`, `lib/db.ts`, `app/api/admin/settings/route.ts`, `components/dashboard/DashboardShell.tsx`, `components/TradeModal.tsx`, `app/api/auth/register/route.ts` — read directly in full or in relevant sections
- Next.js 15 Route Handler documentation — `NextRequest.headers` and `req.headers.get()` are the standard, synchronous API for reading headers in App Router route handlers
- RFC 7239 and reverse proxy conventions — `x-forwarded-proto` / `x-forwarded-host` behavior is widely implemented by nginx, Traefik, and Cloudflare Tunnel

### Secondary (MEDIUM confidence)
- Cloudflare HTTP headers documentation — `x-forwarded-proto` and `x-forwarded-host` behavior documented; actual forwarding requires tunnel configuration (not default)
- Next.js Discussion #34571 — `X-Forwarded-Host` header behavior in Next.js App Router
- TradesViz per-trade checklist UX patterns — competitor analysis confirming per-trade checklist state as expected user behavior
- UX Planet sidebar guide — settings sidebar navigation best practices (confirms keeping vertical sidebar nav over accordion or horizontal tabs at 13+ sections)

### Tertiary (LOW confidence — validate during execution)
- Dashboard template/preset UX patterns — inferred from Notion, Linear, Retool; trading-journal-specific implementations sparse but concept is sound

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
