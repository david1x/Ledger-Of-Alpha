# Requirements: Ledger Of Alpha

**Defined:** 2026-03-19
**Core Value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics.

## v2.1 Requirements

Requirements for v2.1 Settings & Polish milestone. Each maps to roadmap phases.

### Email & Deployment

- [ ] **EMAIL-01**: Email verification links auto-detect the correct URL from request headers (works across npm dev, Docker, Cloudflare tunnel)
- [ ] **EMAIL-02**: URL detection follows priority chain: admin DB override > X-Forwarded-Proto/Host > Host header > env var > localhost fallback
- [ ] **EMAIL-03**: All email-sending API routes (register, password reset, alerts) pass request context for URL detection

### Settings Overhaul

- [ ] **SETT-01**: Settings page content area uses full available width on desktop (no max-w-2xl constraint)
- [ ] **SETT-02**: Settings page is split into per-tab components (extracted from 2380-line monolith)
- [ ] **SETT-03**: Settings tabs are reorganized with clear, descriptive names (especially replacing vague "Display" tab)
- [ ] **SETT-04**: Each settings tab shows unsaved-change indicator before switching away
- [ ] **SETT-05**: Existing `?tab=` URL routing continues to work after reorganization

### Admin Configuration

- [ ] **ADMIN-01**: Admin panel manages system-level API keys (FMP, Gemini) as fallback defaults
- [ ] **ADMIN-02**: Per-user API keys override system-level keys when set
- [ ] **ADMIN-03**: Admin panel shows auto-detected App URL alongside the manual override field
- [ ] **ADMIN-04**: Connection test buttons verify SMTP, FMP API, and Gemini API configuration
- [ ] **ADMIN-05**: Sensitive values (API keys, SMTP password) are masked in the admin UI after save

### Dashboard Templates

- [ ] **DASH-01**: User can save current dashboard layout as a named template
- [ ] **DASH-02**: User can load a saved template to replace active layout
- [ ] **DASH-03**: User can delete saved templates
- [ ] **DASH-04**: 2-3 built-in preset templates ship with the app (e.g., Performance Review, Daily Monitoring, Minimal)
- [ ] **DASH-05**: Template controls are accessible from dashboard edit mode toolbar

### Strategy & Checklists

- [ ] **STRAT-01**: User can add/remove/modify checklist items for a specific trade without changing the strategy template
- [ ] **STRAT-02**: User can create ad-hoc checklist items when no strategy is selected
- [ ] **STRAT-03**: App ships with enriched built-in default strategies (max 5 strategies, each with max 5 checklist items)
- [ ] **STRAT-04**: Trade and journal cards show checklist completion score (e.g., "4/5 checks")
- [ ] **STRAT-05**: Default strategies are consolidated to a single source (lib/strategies.ts), not duplicated

### Cleanup

- [ ] **CLEAN-01**: Fibonacci calculator orphaned code removed from lib/calculators.ts
- [ ] **CLEAN-02**: Fibonacci references removed from all planning/milestone docs

## Future Requirements

Deferred to later milestones.

### Dashboard Enhancements

- **DASH-F01**: User can adjust widget card height (in addition to width)
- **DASH-F02**: Template preview thumbnails before loading
- **DASH-F03**: Share templates via URL or export code

### Strategy Enhancements

- **STRAT-F01**: Per-strategy performance breakdown (win rate, avg P&L by strategy)
- **STRAT-F02**: Settings search/filter across all tabs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Widget height adjustment | Explicitly deferred to later milestone per user |
| Template sharing/export | No multi-user sharing infrastructure needed yet |
| Audit log for admin changes | Overkill for self-hosted single-user deployment |
| Splitting settings into separate routes | Breaks existing `?tab=` deep-link pattern |
| Removing env var support | Docker Compose and CI rely on env vars; DB overrides only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMAIL-01 | Phase 12 | Pending |
| EMAIL-02 | Phase 12 | Pending |
| EMAIL-03 | Phase 12 | Pending |
| SETT-01 | Phase 13 | Pending |
| SETT-02 | Phase 13 | Pending |
| SETT-03 | Phase 13 | Pending |
| SETT-04 | Phase 13 | Pending |
| SETT-05 | Phase 13 | Pending |
| ADMIN-01 | Phase 14 | Pending |
| ADMIN-02 | Phase 14 | Pending |
| ADMIN-03 | Phase 14 | Pending |
| ADMIN-04 | Phase 14 | Pending |
| ADMIN-05 | Phase 14 | Pending |
| DASH-01 | Phase 15 | Pending |
| DASH-02 | Phase 15 | Pending |
| DASH-03 | Phase 15 | Pending |
| DASH-04 | Phase 15 | Pending |
| DASH-05 | Phase 15 | Pending |
| STRAT-01 | Phase 16 | Pending |
| STRAT-02 | Phase 16 | Pending |
| STRAT-03 | Phase 16 | Pending |
| STRAT-04 | Phase 16 | Pending |
| STRAT-05 | Phase 16 | Pending |
| CLEAN-01 | Phase 17 | Pending |
| CLEAN-02 | Phase 17 | Pending |

**Coverage:**
- v2.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
