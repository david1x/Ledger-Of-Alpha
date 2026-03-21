---
phase: 13-settings-page-overhaul
plan: "01"
subsystem: settings
tags: [refactor, decomposition, settings, components]
dependency_graph:
  requires: []
  provides: [settings-tab-components, settings-types, settings-shell]
  affects: [app/settings/page.tsx]
tech_stack:
  added: []
  patterns: [per-tab-state, self-fetching-components, shared-types-module]
key_files:
  created:
    - components/settings/types.ts
    - components/settings/tabs/AccountTab.tsx
    - components/settings/tabs/AccountsTab.tsx
    - components/settings/tabs/TagsTab.tsx
    - components/settings/tabs/TemplatesTab.tsx
    - components/settings/tabs/AppearanceTab.tsx
    - components/settings/tabs/ChartTab.tsx
    - components/settings/tabs/StrategiesTab.tsx
    - components/settings/tabs/IntegrationsTab.tsx
    - components/settings/tabs/BrokerTab.tsx
    - components/settings/tabs/SecurityTab.tsx
    - components/settings/tabs/DataTab.tsx
    - components/settings/tabs/AdminUsersTab.tsx
    - components/settings/tabs/AdminSettingsTab.tsx
  modified:
    - app/settings/page.tsx
decisions:
  - "Each tab self-fetches its own settings slice via GET /api/settings on mount — avoids prop drilling and enables independent state"
  - "CATEGORIES label for 'display' changed from 'Display' to 'Appearance' as SETT-03 prep (plan 02 can finalize rename)"
  - "AdminUsersTab and AdminSettingsTab receive isAdmin prop from shell — these tabs are only rendered when isAdmin is true"
  - "StrategiesTab wraps SortableStrategy sub-component inline — no need for separate file since it is only used in that tab"
metrics:
  duration: ~45 minutes
  completed: 2026-03-19
  tasks_completed: 2
  files_created: 15
  files_modified: 1
---

# Phase 13 Plan 01: Settings Monolith Decomposition Summary

**One-liner:** Decomposed 2380-line settings monolith into shared `types.ts` + 13 self-fetching per-tab components + 150-line shell page.

## What Was Built

The single `app/settings/page.tsx` file (2380 lines, all global state, one giant component) was replaced by:

- `components/settings/types.ts` — shared types (`Settings`, `Category`, `CategoryDef`, `CATEGORIES`, `AdminUser`, `SystemSettings`, `SYS_DEFAULTS`, `INITIAL_SETTINGS`, CSS constants `INPUT`/`LABEL`/`HINT`)
- 13 tab components in `components/settings/tabs/`:
  - `AccountTab.tsx` — account size, risk, commission, daily loss limit, Monte Carlo, claim-admin flow
  - `AccountsTab.tsx` — multi-account CRUD using `useAccounts()` hook
  - `TagsTab.tsx` — default tags and mistakes arrays
  - `TemplatesTab.tsx` — trade template name/delete management
  - `AppearanceTab.tsx` — heatmap ranges, charts_collapsed, privacy_mode
  - `ChartTab.tsx` — TradingView feature toggles + default studies
  - `StrategiesTab.tsx` — DnD strategy list with checklist items, includes `SortableStrategy` sub-component
  - `IntegrationsTab.tsx` — FMP key, Gemini key, Discord webhooks (chart + alerts)
  - `BrokerTab.tsx` — IBKR host/port/clientId, connection test, account mapping, sync
  - `SecurityTab.tsx` — 2FA enable/disable flow, backup codes
  - `DataTab.tsx` — CSV/JSON/IBKR export/import
  - `AdminUsersTab.tsx` — user list, toggle admin, delete user
  - `AdminSettingsTab.tsx` — SMTP config, app_url, new user defaults
- `app/settings/page.tsx` rewritten as ~150-line shell (sidebar + conditional tab rendering)

## Verification

- `npx tsc --noEmit` — no errors
- `npm run build` — compiled successfully, `/settings` route at 23.1 kB

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Linter injected broken `<div className="grid ...">` wrapper in IntegrationsTab**
- **Found during:** Task 2 build verification
- **Issue:** A linter auto-modified IntegrationsTab.tsx adding an unclosed grid wrapper div, causing webpack syntax errors
- **Fix:** Removed the spurious wrapper div that was added outside the component's existing section structure
- **Files modified:** `components/settings/tabs/IntegrationsTab.tsx`

## Self-Check: PASSED

All 14 new files verified to exist:
- `components/settings/types.ts` — created
- `components/settings/tabs/AccountTab.tsx` — created
- `components/settings/tabs/AccountsTab.tsx` — created
- `components/settings/tabs/TagsTab.tsx` — created
- `components/settings/tabs/TemplatesTab.tsx` — created
- `components/settings/tabs/AppearanceTab.tsx` — created
- `components/settings/tabs/ChartTab.tsx` — created
- `components/settings/tabs/StrategiesTab.tsx` — created
- `components/settings/tabs/IntegrationsTab.tsx` — created
- `components/settings/tabs/BrokerTab.tsx` — created
- `components/settings/tabs/SecurityTab.tsx` — created
- `components/settings/tabs/DataTab.tsx` — created
- `components/settings/tabs/AdminUsersTab.tsx` — created
- `components/settings/tabs/AdminSettingsTab.tsx` — created

`app/settings/page.tsx` — 150 lines (within 150-line target)

Build: PASSED — `/settings` route compiles cleanly
