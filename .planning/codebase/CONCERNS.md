# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**Large monolithic components:**
- Issue: Several components exceed 1000 lines, making them difficult to maintain and test.
  - `app/settings/page.tsx` — 1702 lines, contains account settings, security, integrations, data management, and admin panels in a single file
  - `components/dashboard/DashboardShell.tsx` — 1090 lines, manages 24 dashboard widgets, drag-reorder, size modes, and time filtering in one component
  - `app/journal/page.tsx` — 1016 lines, combines journal display, filtering, modals, and edit modes
- Files: `app/settings/page.tsx`, `components/dashboard/DashboardShell.tsx`, `app/journal/page.tsx`
- Impact: Difficult to reason about side effects, hard to test individual features, increased cognitive load for new developers, higher chance of regression when modifying shared state
- Fix approach: Extract major feature sections (e.g., Admin panels, Tag management, Settings categories) into separate components with their own state management. Break down DashboardShell by widget type or concern (layout vs. rendering vs. data fetching).

**Debounced save timers without cleanup race conditions:**
- Issue: `PersistentChart.tsx` uses separate debounce timers for tabs and watchlists (`saveTabsTimer` and `saveWlTimer`). If component unmounts during a pending save or state changes rapidly, old timers may fire with stale data or fail to clear properly.
- Files: `components/PersistentChart.tsx` (lines 206-207, 263-277)
- Impact: Settings save may fail silently or persist outdated state; users could lose recent watchlist/tab changes; difficult to debug since failures are swallowed in fetch catch blocks
- Fix approach: Consolidate timer logic into a single utility or use `useCallback` with dependency tracking. Add proper cleanup in useEffect return. Consider storing version numbers in state to detect stale saves and reject them server-side.

**Unhandled promise rejections in settings saves:**
- Issue: Debounced fetch calls in `saveTabs()` and `saveWatchlists()` (lines 266-273, 278-285) have no explicit error handling beyond console.error — failures are silently dropped
- Files: `components/PersistentChart.tsx`
- Impact: Silent data loss; users are unaware that their watchlist/tab edits didn't persist; no user feedback mechanism to retry
- Fix approach: Add explicit error state tracking (`[saveError, setSaveError]`), display toast notifications on save failure, provide manual retry button, implement exponential backoff for retries.

**Client-side privacy mode flag conflicts:**
- Issue: Multiple pages independently manage `localStorage` `privacy_hidden` flag based on settings API response, with no synchronization
- Files: `components/dashboard/DashboardShell.tsx` (264, 320), `components/Navbar.tsx` (116, 267), `app/journal/page.tsx` (77, 114), `app/trades/page.tsx` (87, 143, 388)
- Impact: Privacy state can desync across tabs or pages; toggling in navbar may not update dashboard; users see sensitive data on one page while hidden on another; difficult to debug because state is split between localStorage and settings API
- Fix approach: Centralize privacy mode in a React Context (e.g., `PrivacyContext`), always derive it from settings API with localStorage as fallback, emit change events across browser tabs using BroadcastChannel API.

## Known Bugs

**JWT secret warning only in dev, crashes in production:**
- Symptoms: App logs warning if `JWT_SECRET` is missing or default in dev but throws fatal error in production. Gap: dev doesn't enforce minimum entropy even if NODE_ENV="production" locally
- Files: `lib/auth.ts` (lines 6-16)
- Trigger: Set `NODE_ENV=production` locally without a real JWT_SECRET; auth endpoints will crash at startup
- Workaround: Always set `JWT_SECRET` before deploying; use a secrets management tool in CI/CD to inject it

**Settings sidebar shift when toggling admin tabs:**
- Issue: Admin-only tabs (Users, System) appear/disappear based on user role, causing sidebar width to recalculate
- Files: `app/settings/page.tsx` (lines 45-58)
- Trigger: Admin user switching between admin and non-admin tabs causes visible layout shift
- Workaround: None currently; users notice the bounce

**Cache key collisions in market data endpoints:**
- Symptoms: `/api/fear-greed`, `/api/market-overview`, `/api/ohlcv` all use module-level `cache` variables without namespacing, could collide if multiple requests come in during the same TTL window
- Files: `app/api/fear-greed/route.ts` (4), `app/api/market-overview/route.ts` (line ~15), `app/api/ohlcv/route.ts` (line ~4)
- Trigger: High-concurrency requests to different endpoints at the same time could receive partially initialized or incorrect cached data
- Workaround: None; relies on single-threaded Node.js execution model

## Security Considerations

**FMP API key stored in plaintext in database:**
- Risk: If database is compromised, attacker gains access to FMP API key which can be used for fraud (symbol searches, live quotes, cost $)
- Files: `app/settings/page.tsx` (line 15), `lib/db.ts` (initial schema), `app/api/symbols/route.ts` (line 20)
- Current mitigation: Database is local SQLite with no encryption; environment variable `fmp_api_key` is not used
- Recommendations: (1) Hash API keys if possible, or use OAuth/token-based auth from FMP; (2) Encrypt the database at rest; (3) Add audit logging when API keys are accessed; (4) Implement API key rotation mechanism; (5) Consider storing secrets in OS keychain instead of database

**Discord webhook URL in plaintext database:**
- Risk: If database is compromised, attacker can send arbitrary messages to user's Discord channel
- Files: `app/settings/page.tsx` (13), `app/api/discord/route.ts` (18-26)
- Current mitigation: None
- Recommendations: Encrypt webhook URLs in database before storing; use Discord OAuth to fetch webhook via secure token exchange instead of user copy-paste; rotate webhooks periodically; add IP whitelist on Discord server if possible

**Email OTP tokens stored without rate limiting on verification:**
- Symptoms: No explicit rate limit on `/api/auth/2fa/verify` endpoint
- Files: `app/api/auth/2fa/verify/route.ts`
- Current mitigation: Generic endpoint rate limiting in `rateLimit()` if configured globally
- Recommendations: Implement exponential backoff (3 attempts, then lock account for 15 minutes); log failed attempts; consider CAPTCHA after 2 failures

**Guest mode allows any unauthenticated user to see demo trades:**
- Risk: Codebase relies on isGuest() check scattered across API routes; if one route is missed, guest users gain unauthorized access to real user data
- Files: Middleware checks guest cookie but only rejects on certain routes; many API routes check `isGuest()` but logic is decentralized (e.g., `app/api/trades/route.ts`, `app/api/settings/route.ts`)
- Current mitigation: Middleware redirects to login for protected routes, guest cookie read-only mode
- Recommendations: (1) Implement allowlist pattern in middleware instead of blocklist; (2) Centralize guest mode check in a single authentication wrapper; (3) Add route-level decorators or middleware to mark endpoints as "guest-safe" explicitly; (4) Regular audit of API routes to ensure no data leaks

## Performance Bottlenecks

**Dashboard loads all 24 widgets on every page render:**
- Problem: `DashboardShell.tsx` renders all widgets even if they're hidden, only toggling visibility with CSS
- Files: `components/dashboard/DashboardShell.tsx` (lines 34-67 widget definitions)
- Cause: No lazy loading or code splitting for widgets; each widget fetches and computes data independently without caching
- Improvement path: (1) Implement lazy loading for off-screen widgets using `react-window` or `Intersection Observer`; (2) Use React Query or SWR to cache widget data across re-renders; (3) Memoize expensive calculations in widget components; (4) Consider Server Components for static widget data

**External API calls in series during settings load:**
- Problem: Settings page fetches user settings, system settings, strategies, templates sequentially with no parallel requests
- Files: `app/settings/page.tsx` (lines 94-200 useEffect with sequential fetches)
- Cause: Each fetch depends on the previous one's data or network calls are chained
- Improvement path: Use `Promise.all()` for independent fetches; prefetch less-used tabs; implement optimistic UI updates; cache settings locally with stale-while-revalidate

**Quote cache stores entire symbol mapping in memory indefinitely:**
- Problem: `/api/quotes/route.ts` uses a module-level `Map<string, { price, fetchedAt }>` that grows unbounded as new symbols are queried
- Files: `app/api/quotes/route.ts` (lines 4-51)
- Cause: No cache eviction policy; long-running server processes accumulate stale entries
- Improvement path: (1) Implement LRU cache with max size (e.g., 10,000 entries); (2) Use Redis instead of in-memory map for multi-instance deployments; (3) Add cache metrics/monitoring to track hit rates

**TradingView widget re-renders on tab switch causing full reload:**
- Problem: `resetActiveTab()` increments `resetKeys[activeId]`, forcing the TradingView widget to remount and reload chart data
- Files: `components/PersistentChart.tsx` (lines 179-180, 629-630)
- Cause: Widget is keyed by reset count, so any change unmounts and remounts; prevents native TradingView caching
- Improvement path: Preserve widget instance across tab switches using conditional rendering instead of key-based remounting; implement local IndexedDB cache for OHLCV data

## Fragile Areas

**Migration system lacks rollback capability:**
- Files: `lib/db.ts` (runMigrations function, lines 84-400+)
- Why fragile: Migrations are one-way; if a migration has a bug or data corruption occurs, there's no built-in rollback. Previous migration `003_settings_per_user` attempts to copy old settings to new schema but could fail mid-transaction, leaving database in inconsistent state
- Safe modification: (1) Add migration version tracking beyond just name; (2) Implement down() functions for each migration; (3) Add transaction safety with automatic rollback on error; (4) Test all migrations on a copy of production data before deploying; (5) Keep manual SQL documentation of each schema change
- Test coverage: No unit tests for migrations; risky when updating schema

**Rate limiting relies on in-memory map that grows unbounded:**
- Files: `lib/rate-limit.ts` (likely uses module-level map)
- Why fragile: If rate-limit storage is in-memory and persistent across requests, old entries are never cleaned up; could lead to OOM on long-running server or allow bypass by waiting for process restart
- Safe modification: Implement LRU eviction or Redis backend; add TTL-based cleanup; test with load testing tools
- Test coverage: No explicit rate-limit tests visible in codebase

**Trade import transaction isolation:**
- Files: `app/api/trades/import/route.ts` (lines 65-117)
- Why fragile: Single transaction for bulk import; if any row fails validation, entire batch may be rolled back (or partial success if validation happens row-by-row inside transaction). Current implementation validates before insert but errors are added to array without rolling back successful inserts
- Safe modification: (1) Decide on all-or-nothing vs. best-effort semantics; (2) If best-effort, track which rows succeeded/failed with IDs; (3) Add unique constraint on trade ID/user_id/entry_date to prevent duplicates; (4) Test with large imports (5000 trades) to ensure transaction doesn't timeout
- Test coverage: No visible tests for import edge cases

**Admin user promotion has no verification:**
- Files: `app/api/admin/claim/route.ts`
- Why fragile: First admin is promoted via `/api/admin/claim` with only email check; no confirmation sent or audit log; if someone discovers this endpoint and claims admin before the real owner, account is compromised
- Safe modification: (1) Require email verification before admin claim; (2) Send confirmation email with 24-hour window; (3) Log all admin claims with IP/timestamp; (4) Disable endpoint once first admin is claimed; (5) Require existing admin to approve new admin promotions
- Test coverage: Security logic around admin claim is not tested

## Scaling Limits

**SQLite single-writer limitation:**
- Current capacity: Single Next.js instance works fine; WAL mode allows one writer + multiple readers
- Limit: Multiple Next.js replicas sharing same SQLite database will experience contention; WAL file conflicts; database locks on writes; potential data corruption
- Scaling path: (1) Migrate to PostgreSQL for true multi-instance deployment; (2) Implement read replicas with eventual consistency; (3) Use Redis for cache layer to reduce database load; (4) Implement horizontal sharding by user_id if needed (unlikely until 10K+ users)

**Watchlist and tab state persisted per user with no size limits:**
- Current capacity: Settings table stores unlimited JSON blobs; one user's watchlist could be multi-MB
- Limit: Settings fetches entire serialized state on every page load; large watchlists cause slow renders and high memory usage
- Scaling path: (1) Paginate settings or split into separate entities; (2) Implement server-side query for just the active watchlist; (3) Cache settings in Redis with TTL; (4) Compress settings JSON before storing

**In-process cache for symbols, quotes, market data:**
- Current capacity: Unbounded memory growth for each API route's cache
- Limit: Server will eventually run out of memory on long-running instances; no cache eviction
- Scaling path: (1) Use Redis for shared cache across instances; (2) Implement disk-based LRU; (3) Add process memory monitoring and alert on 80%+ usage; (4) Restart processes daily to clear caches

## Dependencies at Risk

**better-sqlite3 breaks without matching Node.js version:**
- Risk: `better-sqlite3` is a native module; upgrading Node.js version can cause binary incompatibility; requires rebuild on each Node version change
- Impact: Docker builds fail if Node version in Dockerfile doesn't match development; "works on my machine" syndrome
- Migration plan: (1) Pin Node.js version in `.nvmrc` and Dockerfile; (2) Use prebuilt binaries via `npm rebuild` in CI; (3) Consider migrating to pure-JS SQLite (e.g., `sql.js`) for portability if you plan multi-architecture deployments; (4) Add CI check to rebuild binaries and test on target Node version

**TradingView Lightweight Charts @ v4:**
- Risk: Version is pinned to `@^4`; breaking changes in minor versions could silently fail charts
- Impact: Chart rendering breaks silently; users see blank chart area
- Migration plan: Lock to exact version `4.x.y` instead of `^4`; test chart functionality in CI; subscribe to release notes for v4 branch; plan migration to v5 when upstream forces upgrade

**jose (JWT library) is small ecosystem dependency:**
- Risk: Fewer eyes on code, slower security updates than industry standard like jsonwebtoken
- Impact: Hypothetical vuln takes longer to patch
- Migration plan: Monitor GitHub security advisories; consider moving to `jsonwebtoken` if jose stops being maintained (unlikely, it's official Vercel auth library); add integration tests for JWT creation/verification

## Missing Critical Features

**No audit logging for sensitive operations:**
- Problem: Admin actions (user promotion, system settings changes), API key access, trade imports, account deletions are not logged
- Blocks: Compliance audits, security incident investigation, detecting unauthorized access
- Files: `app/api/admin/*`, `app/api/settings/route.ts`, `app/api/trades/import/route.ts`
- Recommendations: (1) Create `audit_logs` table with user_id, action, timestamp, IP, changes made; (2) Log all admin operations, account changes, and API key access; (3) Implement audit log viewer in admin panel; (4) Archive audit logs to immutable storage quarterly

**No session expiration or logout enforcement:**
- Problem: JWT tokens are valid for 7 days; user cannot force logout of other sessions; no device management
- Blocks: Users cannot revoke access if device is compromised; no way to see active sessions
- Files: `lib/auth.ts` (session duration), `app/api/auth/logout/route.ts`
- Recommendations: (1) Store session list in database with device/IP info; (2) Implement server-side token revocation check in `verifyJwt()`; (3) Allow user to logout all sessions; (4) Add "logout other sessions" button in settings

**No password strength requirements or breached password check:**
- Problem: Users can set weak passwords; no validation on length, complexity, or common patterns
- Blocks: Account takeover via brute force or dictionary attacks
- Files: `app/api/auth/register/route.ts`
- Recommendations: (1) Enforce minimum 12 characters; (2) Check against Have I Been Pwned API; (3) Reject common patterns (password123, etc.); (4) Show real-time feedback on password strength

**No data export or backup for users:**
- Problem: Users cannot export their trades in bulk for archival or backup
- Blocks: Data portability, disaster recovery
- Files: `app/settings/page.tsx` has CSV import but no export button
- Recommendations: (1) Add "Export as CSV" button in Data section; (2) Support multiple formats (JSON, Excel); (3) Add scheduled backup option; (4) Implement right-to-data-portability in GDPR compliance section

## Test Coverage Gaps

**Settings save edge cases untested:**
- What's not tested: Concurrent saves to different settings keys, network failures during debounce, partial updates causing state inconsistency
- Files: `components/PersistentChart.tsx`, `app/settings/page.tsx`
- Risk: Silent save failures, stale state persisted
- Priority: High — affects data persistence

**Trade import validation untested:**
- What's not tested: Edge cases like 5000-trade boundary, malformed dates, missing required fields, duplicate entries, concurrent imports
- Files: `app/api/trades/import/route.ts`
- Risk: Silent data corruption, duplicate trades, import hangs on large files
- Priority: High — affects data integrity

**Admin promotion untested:**
- What's not tested: First admin claim, promoting existing users, demoting admins, permission checks
- Files: `app/api/admin/claim/route.ts`, `app/api/admin/users/[id]/route.ts`
- Risk: Admin escalation, data access control bypass
- Priority: Critical — security feature

**Dashboard widget filtering and calculations untested:**
- What's not tested: Time filter (30/60/90/All) affecting all widget data, edge cases like trades on same day with different times, P&L calculations with different commission models
- Files: `components/dashboard/DashboardShell.tsx`, `components/dashboard/*.tsx`
- Risk: Incorrect performance metrics, misleading analytics
- Priority: High — data accuracy

**Authentication flow untested:**
- What's not tested: 2FA setup/verify, email verification flow, JWT expiration, concurrent logins, session invalidation
- Files: `app/api/auth/*`, `lib/auth.ts`, `middleware.ts`
- Risk: Auth bypass, session hijacking, 2FA disabled unexpectedly
- Priority: Critical — security feature

---

*Concerns audit: 2026-03-14*
