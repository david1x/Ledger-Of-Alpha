---
phase: 14-admin-configuration-expansion
plan: 02
subsystem: api, ui, admin
tags: [admin, connection-test, smtp, fmp, gemini, nodemailer]

# Dependency graph
requires:
  - phase: 14-admin-configuration-expansion
    plan: 01
    provides: Admin settings DB infrastructure with _system user row and sentinel masking for FMP and Gemini keys
affects: [phase-15, phase-16]

provides:
  - POST /api/admin/test-smtp — verifies SMTP connection using nodemailer.verify() against DB-stored settings
  - POST /api/admin/test-fmp — validates FMP API key by hitting the symbol search endpoint
  - POST /api/admin/test-gemini — validates Gemini key via minimal generateContent call
  - Test Connection button in SMTP section of admin panel with loading spinner + inline green/red result
  - Test buttons alongside FMP and Gemini key inputs in API Keys section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Connection test endpoint pattern: requireAdmin guard, read from _system DB, attempt connection, return { ok: true } or { ok: false, error: string }
    - Shared runTest() helper: loading state, fetch, map response to result, auto-clear with setTimeout(5000)

key-files:
  created:
    - app/api/admin/test-smtp/route.ts
    - app/api/admin/test-fmp/route.ts
    - app/api/admin/test-gemini/route.ts
  modified:
    - components/settings/tabs/AdminSettingsTab.tsx

key-decisions:
  - "Test endpoints read credentials directly from _system DB — never from request body. Guards against testing unsaved in-memory edits."
  - "SMTP test uses nodemailer.verify() which opens a socket to the SMTP server — most accurate test short of sending a real message"
  - "FMP test hits the search-symbol endpoint for AAPL with AbortSignal.timeout(5000) to prevent hanging on slow DNS"
  - "Gemini test calls model.generateContent('Say OK') — consumes minimal quota, acceptable for admin-only manual test"

patterns-established:
  - "Connection test pattern: read from DB -> check configured -> attempt -> return { ok, error }"
  - "runTest() helper pattern: loading flag, fetch POST, map ok/error to typed result, auto-clear after 5s"

requirements-completed: [ADMIN-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 14 Plan 02: Connection Test Endpoints Summary

**Three admin test endpoints (SMTP nodemailer.verify, FMP symbol search, Gemini generateContent) with inline Test buttons in the admin panel showing green/red results and auto-clearing after 5 seconds.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T13:12:37Z
- **Completed:** 2026-03-20T13:17:24Z
- **Tasks:** 2
- **Files modified:** 1 + 3 created

## Accomplishments
- Admin can click "Test Connection" in the SMTP section to verify the saved SMTP credentials connect successfully via nodemailer
- Admin can click "Test" next to the FMP API Key to validate it against the Financial Modeling Prep symbol search endpoint
- Admin can click "Test" next to the Gemini API Key to validate it by generating a minimal response
- All test buttons show a Loader2 spinner while in-flight and display green ("Connection successful") or red (error message) results that auto-clear after 5 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SMTP, FMP, and Gemini test API endpoints** - `e3db229` (feat)
2. **Task 2: Add Test buttons to AdminSettingsTab for SMTP, FMP, and Gemini** - `84f7bb4` (feat)

## Files Created/Modified
- `app/api/admin/test-smtp/route.ts` - POST handler: reads smtp_host/user/pass from _system DB, calls nodemailer.createTransport().verify()
- `app/api/admin/test-fmp/route.ts` - POST handler: reads fmp_api_key from _system DB, fetches FMP search-symbol endpoint, checks for Error Message field
- `app/api/admin/test-gemini/route.ts` - POST handler: reads openai_api_key from _system DB, calls GoogleGenerativeAI gemini-2.5-flash generateContent
- `components/settings/tabs/AdminSettingsTab.tsx` - Added 3 test state objects, shared runTest() helper, Test Connection button in SMTP section, Test buttons alongside FMP/Gemini key inputs

## Decisions Made
- Test endpoints read credentials from _system DB, never from request body — ensures admin is testing the actual saved configuration, not an unsaved in-memory edit.
- SMTP uses `nodemailer.verify()` which opens a real TCP socket to the mail server for the most accurate connection test possible without sending an actual message.
- FMP test uses `AbortSignal.timeout(5000)` to prevent hanging on slow DNS or network.
- Gemini test calls `model.generateContent("Say OK")` consuming minimal quota — this is an explicit admin action so acceptable.
- Used shared `runTest()` helper inside the component (not extracted to a separate file) to avoid over-abstraction for three similar but locally-used functions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three connection test endpoints are live and guarded by requireAdmin.
- Admin can now verify their SMTP, FMP, and Gemini configuration works before relying on it for real user flows.
- Phase 14 plan 03+ can build additional admin features on top of the established infrastructure.

---
*Phase: 14-admin-configuration-expansion*
*Completed: 2026-03-20*
