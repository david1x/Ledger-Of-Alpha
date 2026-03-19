---
phase: 11-ibkr-broker-sync
plan: "01"
subsystem: broker-integration
tags: [ibkr, broker-sync, api-routes, db-migrations, types]
dependency_graph:
  requires: []
  provides:
    - lib/ibkr-client.ts
    - app/api/broker/ibkr/status
    - app/api/broker/ibkr/accounts
    - app/api/broker/ibkr/sync
    - app/api/broker/ibkr/positions
    - DB migrations 020 + 021
  affects:
    - lib/db.ts
    - lib/types.ts
tech_stack:
  added:
    - undici (SSL-bypass Agent for self-signed gateway certs)
  patterns:
    - INSERT OR IGNORE with partial UNIQUE index for idempotent dedup
    - undici Agent dispatcher for SSL toggle on fetch
    - Sequential windowed API calls with 1s delay to avoid rate limiting
    - Paginated fetch loop (30-item page boundary detection)
key_files:
  created:
    - lib/ibkr-client.ts
    - app/api/broker/ibkr/status/route.ts
    - app/api/broker/ibkr/accounts/route.ts
    - app/api/broker/ibkr/sync/route.ts
    - app/api/broker/ibkr/positions/route.ts
  modified:
    - lib/db.ts (migrations 020, 021)
    - lib/types.ts (ibkr_exec_id, source on Trade interface)
    - package.json (undici dependency)
decisions:
  - undici installed for self-signed cert support; plan specified it but it was not pre-installed
  - Build EPERM on .next/trace accepted as environment artifact (running dev server locks file); tsc --noEmit passes clean
metrics:
  duration: 389s
  completed: "2026-03-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 3
---

# Phase 11 Plan 01: IBKR Backend Foundation Summary

IBKR Client Portal REST proxy with gateway client library, DB migrations for trade deduplication (ibkr_exec_id partial UNIQUE index), Trade type extensions (ibkr_exec_id + source), and four server-side API routes (status, accounts, sync, positions).

## Tasks Completed

| Task | Name | Commit | Key Outputs |
|------|------|--------|-------------|
| 1 | DB migrations, types, IBKR client library | 20a89f5 | lib/db.ts (020+021), lib/types.ts, lib/ibkr-client.ts |
| 2 | IBKR API proxy routes | 9b78760 | 4 route files under app/api/broker/ibkr/ |

## What Was Built

### lib/ibkr-client.ts

Gateway HTTP wrapper with three exports:

- `ibkrFetch(gatewayUrl, path, sslVerify, init?)` — prepends `/v1/api`, uses undici `Agent({ connect: { rejectUnauthorized: false } })` when `sslVerify=false` for self-signed cert environments; falls back to native fetch when `sslVerify=true`.
- `getIbkrSettings(db, userId)` — reads `ibkr_gateway_url`, `ibkr_ssl_verify`, `ibkr_account_mappings` from per-user settings; returns safe defaults (empty string, false, []).
- `mapSide(side)` — normalizes IBKR side codes (B/BOT/BUY → "long", S/SLD/SELL → "short").

Exports `IbkrExecution` and `IbkrPosition` interfaces.

### DB Migrations

- **020_ibkr_exec_id**: Adds `ibkr_exec_id TEXT` and `source TEXT` to trades table; creates partial UNIQUE index `idx_trades_ibkr_exec_id ON trades(ibkr_exec_id) WHERE ibkr_exec_id IS NOT NULL` for silent duplicate skipping.
- **021_ibkr_settings**: Placeholder migration (ibkr_* settings are per-user, no system defaults needed).

### API Routes

- **GET /api/broker/ibkr/status**: Pings `/iserver/accounts` to check gateway connectivity, returns `{ connected, accounts?, error? }`.
- **GET /api/broker/ibkr/accounts**: Fetches `/portfolio/accounts` + `/portfolio/subaccounts` in parallel, merges with deduplication by account id.
- **POST /api/broker/ibkr/sync**: Initializes brokerage session, fetches executions with 7d (single call) or 30d (5 sequential 7-day windows with 1s delay), inserts with `INSERT OR IGNORE`, tracks new/dup/err counts, updates `ibkr_last_sync` and `ibkr_last_sync_status` settings.
- **GET /api/broker/ibkr/positions**: Fetches positions per mapped IBKR account with pagination (30-item boundary), maps to `{ symbol, quantity, unrealizedPnl, pnlPercent, direction, mktPrice, avgPrice, ibkrAccountId }`.

All routes: auth-gated (getSessionUser), guest-blocked (isGuest), settings read via getIbkrSettings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] undici not installed**
- **Found during:** Task 1 setup
- **Issue:** `undici` was listed in plan interfaces and STATE.md as a known package but was not in package.json
- **Fix:** `npm install undici`
- **Files modified:** package.json, package-lock.json
- **Commit:** 20a89f5

**2. [Environment - Non-blocking] npm run build EPERM**
- **Found during:** Task 2 verification
- **Issue:** Windows `.next/trace` file locked by running dev server (process ID 30392, started 10:46 PM). `Remove-Item` on `.next` returned exit 1.
- **Resolution:** `npx tsc --noEmit` confirmed zero type errors. Build EPERM is a Windows environment artifact unrelated to code correctness. Per project memory, node processes must not be killed.

## Self-Check

**Files created/exist:**
- lib/ibkr-client.ts: EXISTS
- app/api/broker/ibkr/status/route.ts: EXISTS
- app/api/broker/ibkr/accounts/route.ts: EXISTS
- app/api/broker/ibkr/sync/route.ts: EXISTS
- app/api/broker/ibkr/positions/route.ts: EXISTS

**Commits exist:**
- 20a89f5: Task 1 — DB migrations + types + ibkr-client.ts
- 9b78760: Task 2 — 4 IBKR API proxy routes

## Self-Check: PASSED
