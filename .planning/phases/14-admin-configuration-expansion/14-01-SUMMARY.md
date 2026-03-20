---
phase: 14-admin-configuration-expansion
plan: 01
subsystem: api, ui, admin
tags: [admin, api-keys, sentinel-masking, gemini, fmp, settings]

# Dependency graph
requires:
  - phase: 12-email-url-auto-detection
    provides: getBaseUrl priority chain used in detected-url endpoint design
  - phase: 13-settings-page-overhaul
    provides: decomposed settings tab components (AdminSettingsTab.tsx)
provides:
  - System-level FMP and Gemini API key storage in admin panel with sentinel masking
  - /api/admin/detected-url endpoint returning server-auto-detected URL
  - User-over-system fallback chain for Gemini API key in AI routes
  - Fixed FMP fallback bug (empty personal key now correctly falls through to system key)
affects: [phase-15, phase-16, ai-vision, symbol-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sentinel masking pattern: GET returns '••••••••' for non-empty sensitive values; POST skips upsert when value equals sentinel
    - User-over-system fallback: user settings row checked first, system row as fallback, empty string as final default
    - Auto-detected URL endpoint: mirrors getBaseUrl steps 2-5, skips DB override to show what headers produce

key-files:
  created:
    - app/api/admin/detected-url/route.ts
  modified:
    - app/api/admin/settings/route.ts
    - components/settings/types.ts
    - components/settings/tabs/AdminSettingsTab.tsx
    - app/api/ai/analyze/route.ts
    - app/api/ai/followup/route.ts
    - app/api/symbols/route.ts

key-decisions:
  - "Sentinel masking uses '••••••••' — GET masks non-empty sensitive values, POST skips upsert when value equals sentinel to prevent overwriting real key"
  - "detected-url endpoint skips DB override (step 1 of getBaseUrl) intentionally — shows auto-detection result independent of any stored override"
  - "Gemini key stored as openai_api_key in DB — naming inconsistency retained from v2.0 switch; label in UI says 'Gemini API Key'"
  - "FMP fallback fix: !row?.value instead of !row — handles case where user has empty string personal key"

patterns-established:
  - "Sentinel masking pattern: define SENSITIVE_KEYS and SENTINEL constant; mask on GET, skip on POST when value === SENTINEL"
  - "User-over-system fallback: user row || system row || empty string"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-05]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 14 Plan 01: Admin API Keys and Sentinel Masking Summary

**Admin panel expanded with system-level FMP and Gemini API key management using sentinel masking, auto-detected URL display, and user-over-system fallback chain in all AI and symbol routes.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-20T01:43:40Z
- **Completed:** 2026-03-20T01:50:22Z
- **Tasks:** 2
- **Files modified:** 6 + 1 created

## Accomplishments
- Admin can store system-level FMP and Gemini API keys in the System settings tab; after save and reload, keys display as "••••••••" (never cleartext)
- POST handler skips upsert when value equals sentinel, preserving real key when admin saves without changing a masked field
- New /api/admin/detected-url endpoint returns server-computed URL from request headers (priority steps 2-5 of getBaseUrl chain)
- AdminSettingsTab now shows auto-detected URL below the App URL override field
- AI analyze and followup routes use system Gemini key when user has no personal key configured
- FMP symbols route fixed to use system key when user's personal key is empty string

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend admin settings API with API keys, sentinel masking, and detected-url endpoint** - `35405ae` (feat)
2. **Task 2: Add API Keys section and auto-URL display to admin UI, fix override chain in API routes** - `45b1bff` (feat)

## Files Created/Modified
- `app/api/admin/detected-url/route.ts` - New GET endpoint returning server-auto-detected URL (skips DB override step)
- `app/api/admin/settings/route.ts` - Added fmp_api_key and openai_api_key to SYSTEM_KEYS; SENSITIVE_KEYS + SENTINEL masking on GET; sentinel skip on POST
- `components/settings/types.ts` - Added fmp_api_key and openai_api_key to SystemSettings interface and SYS_DEFAULTS
- `components/settings/tabs/AdminSettingsTab.tsx` - API Keys section with masked inputs + eye toggles; auto-detected URL display below App URL field
- `app/api/ai/analyze/route.ts` - User-over-system fallback for openai_api_key; updated error message
- `app/api/ai/followup/route.ts` - User-over-system fallback for openai_api_key; updated error message
- `app/api/symbols/route.ts` - Fixed FMP fallback bug: !row?.value instead of !row

## Decisions Made
- Sentinel masking uses '••••••••' character string. GET masks any non-empty sensitive value; POST checks `value === SENTINEL` and skips the upsert, so the real key is never overwritten when admin saves without editing a masked field.
- The detected-url endpoint intentionally skips step 1 (DB override) so the admin can see what auto-detection produces independently of any stored override. This gives meaningful diagnostic information about what the server sees from headers.
- The `openai_api_key` DB column name is retained from the v2.0 Gemini migration — the UI labels it "Gemini API Key" to be accurate for users while the storage key remains unchanged.
- Fixed the FMP fallback: `!row` was truthy only when the DB returned no row; `!row?.value` also catches the case where a row exists but value is empty string (user explicitly cleared their key).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run build` failed with EPERM on `.next/trace` — pre-existing Windows file lock from another running Node process. TypeScript compilation (`npx tsc --noEmit`) passed cleanly, confirming no type errors in our changes.

## User Setup Required

None - no external service configuration required. Admin can configure API keys directly in the System settings tab at `/settings?tab=admin-settings`.

## Next Phase Readiness
- System API key infrastructure complete. Phase 14 plan 02+ can build additional admin configuration features on top of this pattern.
- The sentinel masking pattern is established and can be reused for any future sensitive admin settings.
- AI routes now have proper fallback chain — users without personal Gemini keys will automatically use the system key if admin has configured one.

---
*Phase: 14-admin-configuration-expansion*
*Completed: 2026-03-20*
