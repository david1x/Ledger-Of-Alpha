# Ledger Of Alpha Roadmap

## Milestones

- [v1.0.0 (SHIPPED)](.planning/milestones/v1.0.0-ROADMAP.md) — Core Architecture, Journaling, & Analytics (2026-03-14)
- [v2.0 (SHIPPED)](.planning/milestones/v2.0-ROADMAP.md) — Intelligence & Automation (2026-03-19)

---

### v2.1 Settings & Polish (In Progress)

**Milestone Goal:** Overhaul the settings experience, fix deployment pain points, and enhance strategy workflows. Every feature targets an existing surface — no net-new capabilities, no new packages.

## Phases

- [x] **Phase 12: Email URL Auto-Detection** - Email links work correctly across npm dev, Docker, and Cloudflare Tunnel without manual URL config (completed 2026-03-19)
- [ ] **Phase 13: Settings Page Overhaul** - Settings page split into per-tab components, full-width desktop layout, reorganized tabs
- [x] **Phase 14: Admin Configuration Expansion** - Admin panel becomes the single source of truth for runtime config (API keys, SMTP, App URL) (completed 2026-03-20)
- [x] **Phase 15: Dashboard Layout Templates** - Users can save, load, and delete named dashboard layout presets with built-in defaults (completed 2026-03-20)
- [ ] **Phase 16: Strategy & Checklist Enhancements** - Per-trade checklist editing, ad-hoc checklists, built-in default strategies, checklist score badges
- [ ] **Phase 17: Cleanup** - Fibonacci orphaned code removed, planning docs cleaned up

## Phase Details

### Phase 12: Email URL Auto-Detection
**Goal**: Email verification, password reset, and alert links resolve the correct public URL automatically in every deployment environment
**Depends on**: Nothing (first phase of milestone)
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03
**Success Criteria** (what must be TRUE):
  1. Clicking an email verification link received via Docker deployment opens the correct public URL (not the container service name)
  2. Clicking an email link received via Cloudflare Tunnel resolves to the tunnel's public hostname
  3. URL resolution follows the documented priority chain: admin DB override > x-forwarded-host + x-forwarded-proto > host header > env var > localhost fallback
  4. All email-sending routes (register, password reset, alerts) use the auto-detected URL without manual configuration
**Plans**: 1 plan

Plans:
- [ ] 12-01: Implement `lib/request-url.ts` and wire into all email-sending API routes

### Phase 13: Settings Page Overhaul
**Goal**: The settings page is maintainable, full-width, and clearly organized — the 2380-line monolith is replaced by focused per-tab components
**Depends on**: Phase 12
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, SETT-05
**Success Criteria** (what must be TRUE):
  1. Settings content fills the full desktop width (no max-w-2xl constraint visible on wide screens)
  2. Each settings tab is a self-contained component — editing one tab's state does not affect another's
  3. Navigating away from a tab with unsaved changes shows a visible indicator before leaving
  4. Visiting `/settings?tab=accounts` (or any existing tab value) still navigates to the correct section
  5. Tab names in the sidebar are descriptive and unambiguous (no "Display" catch-all)
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md — Extract shared types and split 2380-line monolith into 13 per-tab components + thin shell
- [ ] 13-02-PLAN.md — Apply full-width layout, rename Display to Appearance, add unsaved-change indicator

### Phase 14: Admin Configuration Expansion
**Goal**: The admin panel is the single source of truth for runtime configuration — operators can set API keys, SMTP, and App URL without touching environment variables
**Depends on**: Phase 13
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. Admin can enter FMP and Gemini API keys in the admin panel and they are used as system-wide fallbacks when users have no personal key set
  2. A user's personal API key in their settings overrides the system-level key from the admin panel
  3. Admin panel shows an auto-detected App URL field alongside the manual override, reflecting what the server would use for email links
  4. Admin can click "Test" buttons for SMTP, FMP API, and Gemini API and receive a pass/fail result
  5. API keys and SMTP password appear masked (e.g., `••••••••`) after being saved
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Expand SYSTEM_KEYS with API key fallbacks, sentinel masking, auto-detected URL endpoint, and override chain fixes
- [ ] 14-02-PLAN.md — Add connection test buttons for SMTP, FMP, and Gemini in admin panel

### Phase 15: Dashboard Layout Templates
**Goal**: Users can save their current dashboard arrangement as a named template and restore it at any time
**Depends on**: Phase 13
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. In dashboard edit mode, user can type a name and save the current widget layout as a template
  2. User can select a saved template from a list and apply it to replace the current layout (with a confirmation step)
  3. User can delete a named template from the list
  4. At least 2 built-in preset templates (e.g., Performance Review, Daily Monitoring) appear in the template list on a fresh install
  5. Template controls (save, load, delete) are accessible from the edit mode toolbar without leaving the dashboard
**Plans**: 2 plans

Plans:
- [ ] 15-01-PLAN.md — Per-account layout storage refactor, built-in preset constants, template state and handlers
- [ ] 15-02-PLAN.md — TemplatePanel dropdown UI component and edit mode toolbar integration

### Phase 16: Strategy & Checklist Enhancements
**Goal**: Traders can customize checklists for individual trades and always have useful default strategies available out of the box
**Depends on**: Phase 13
**Requirements**: STRAT-01, STRAT-02, STRAT-03, STRAT-04, STRAT-05
**Success Criteria** (what must be TRUE):
  1. User can add, remove, or edit checklist items on a specific trade without changing the underlying strategy template
  2. User can add ad-hoc checklist items to a trade that has no strategy selected
  3. A fresh install shows pre-populated built-in strategies (not an empty strategies list), and user edits do not overwrite them on restart
  4. Trade and journal cards display a checklist completion score (e.g., "4/5 checks") computed from the trade's saved state
  5. Default strategy definitions exist in exactly one place in the codebase (`lib/strategies.ts`)
**Plans**: TBD

Plans:
- [ ] 16-01: Consolidate strategies to `lib/strategies.ts`, add DB migration 022 for `checklist_state`, implement per-trade checklist editing and ad-hoc support
- [ ] 16-02: Add checklist completion score badge to trade cards and journal cards

### Phase 17: Cleanup
**Goal**: Orphaned Fibonacci code and planning doc references are removed, leaving no dead code in the codebase
**Depends on**: Phase 16
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. `lib/calculators.ts` contains no `fibonacciLevels` function or other Fibonacci-related exports
  2. No planning or milestone documents reference the Fibonacci calculator as a current or planned feature
**Plans**: TBD

Plans:
- [ ] 17-01: Remove `fibonacciLevels` from `lib/calculators.ts` and clean up all Fibonacci references in planning docs

## Progress

**Execution Order:** 12 → 13 → 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Email URL Auto-Detection | 1/1 | Complete    | 2026-03-19 | - |
| 13. Settings Page Overhaul | 1/2 | In Progress|  | - |
| 14. Admin Configuration Expansion | 2/2 | Complete   | 2026-03-20 | - |
| 15. Dashboard Layout Templates | 2/2 | Complete    | 2026-03-20 | - |
| 16. Strategy & Checklist Enhancements | v2.1 | 0/2 | Not started | - |
| 17. Cleanup | v2.1 | 0/1 | Not started | - |

---
*Phase numbering continues from v2.0 (phases 1-11). v2.1 uses phases 12-17.*
