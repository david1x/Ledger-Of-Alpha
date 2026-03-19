---
phase: 12-email-url-auto-detection
plan: "01"
subsystem: auth
tags: [email, url-detection, reverse-proxy, cloudflare-tunnel, docker, nextjs]

# Dependency graph
requires: []
provides:
  - "lib/request-url.ts — getBaseUrl(req) 5-level priority chain URL resolver"
  - "lib/email.ts — sendVerificationEmail, sendPasswordResetEmail, sendAlertEmail accept optional baseUrl param"
  - "lib/notifications.ts — sendAlertNotifications accepts optional baseUrl, passes to sendAlertEmail"
  - "All 4 email-sending API routes derive and pass request-context baseUrl"
affects: [phase-13, phase-14, phase-15, phase-16, phase-17, any-future-email-sending-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getBaseUrl(req) called at route handler entry, passed down through email helper chain"
    - "Optional baseUrl? as last parameter on email helpers — backward compatible, existing callers unaffected"
    - "getAppUrl() retained as internal fallback in lib/email.ts for non-request contexts"

key-files:
  created:
    - lib/request-url.ts
  modified:
    - lib/email.ts
    - lib/notifications.ts
    - app/api/auth/register/route.ts
    - app/api/auth/resend-verification/route.ts
    - app/api/alerts/trigger/route.ts
    - app/api/alerts/check-prices/route.ts

key-decisions:
  - "Priority chain: DB override > x-forwarded-host/proto > host header > env var > localhost:3000 — handles npm dev, Docker, Cloudflare Tunnel without config"
  - "Optional baseUrl? as last arg rather than required — preserves all existing callers, no breaking changes"
  - "getAppUrl() internal fallback retained in lib/email.ts — callers without request context still work"
  - "baseUrl derived once before loop in check-prices — avoids per-alert overhead"
  - "sendOtpEmail unchanged — contains no URLs so no baseUrl needed"

patterns-established:
  - "URL derivation pattern: import getBaseUrl, call before email send, pass as last arg"
  - "x-forwarded-host takes priority over host header — correct for all proxy/tunnel scenarios"

requirements-completed: [EMAIL-01, EMAIL-02, EMAIL-03]

# Metrics
duration: 3min
completed: "2026-03-19"
---

# Phase 12 Plan 01: Email URL Auto-Detection Summary

**Request-aware getBaseUrl(req) utility with 5-level priority chain wired into all email-sending routes, fixing wrong URLs behind reverse proxies and Cloudflare Tunnel**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-19T12:08:46Z
- **Completed:** 2026-03-19T12:11:01Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Created `lib/request-url.ts` with `getBaseUrl(req)` implementing 5-level priority chain (DB override > x-forwarded-host/proto > host header > env var > localhost fallback)
- Updated `lib/email.ts` to accept optional `baseUrl?` on `sendVerificationEmail`, `sendPasswordResetEmail`, and `sendAlertEmail`; `sendOtpEmail` unchanged
- Updated `lib/notifications.ts` to accept and pass through `baseUrl?` in `sendAlertNotifications`
- Wired `getBaseUrl(req)` into all 4 email-sending API routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/request-url.ts and update email/notification signatures** - `b4347ef` (feat)
2. **Task 2: Wire getBaseUrl into all email-sending API routes** - `0fda8f5` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `lib/request-url.ts` - New utility: getBaseUrl(req) 5-level priority chain URL resolver
- `lib/email.ts` - Added optional baseUrl? to sendVerificationEmail, sendPasswordResetEmail, sendAlertEmail
- `lib/notifications.ts` - Added optional baseUrl? to sendAlertNotifications, passes to sendAlertEmail
- `app/api/auth/register/route.ts` - Imports getBaseUrl, derives baseUrl, passes to sendVerificationEmail
- `app/api/auth/resend-verification/route.ts` - Imports getBaseUrl, derives baseUrl, passes to sendVerificationEmail
- `app/api/alerts/trigger/route.ts` - Imports getBaseUrl, derives baseUrl per iteration, passes to sendAlertNotifications
- `app/api/alerts/check-prices/route.ts` - Imports getBaseUrl, derives baseUrl once before loop, passes to sendAlertNotifications

## Decisions Made

- Used `require("./db")` pattern in `getBaseUrl` (same as existing `getAppUrl()`) to avoid circular-import issues at module scope
- `x-forwarded-proto` defaults to `"https"` when absent but `x-forwarded-host` is present — correct for Cloudflare Tunnel which always terminates TLS
- `localhost`/`127.*` hostnames infer `http`, all others infer `https` for the host-header fallback
- `baseUrl` derived once before the for-loop in `check-prices` (not per-alert) to avoid repeated header parsing overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Dev server was running and held a lock on `.next/trace`, preventing `npm run build`. Used `npx tsc --noEmit` instead, which is the underlying TypeScript check that `npm run build` runs. All types passed cleanly. Grep verification confirmed correct wiring.

## User Setup Required

None - no external service configuration required. The priority chain works automatically from request headers; no env vars need to be added (existing `NEXT_PUBLIC_APP_URL` and admin `app_url` DB setting continue to work as overrides).

## Next Phase Readiness

- Phase 12 complete. Email verification and alert links now auto-detect the correct public URL from request headers.
- Any future email-sending routes should follow the same pattern: `import { getBaseUrl } from "@/lib/request-url"`, then `const baseUrl = getBaseUrl(req)` before the email call.

---
*Phase: 12-email-url-auto-detection*
*Completed: 2026-03-19*
