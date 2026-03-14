# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Client-server monolith with Next.js App Router (full-stack). Layered architecture with clear separation between client components, API routes, and database/auth utilities.

**Key Characteristics:**
- All frontend code is client-side ("use client" directives throughout)
- All backend logic resides in API routes (`app/api/`) with utility functions in `lib/`
- Single SQLite database with WAL mode for persistence
- JWT session-based authentication with optional 2FA
- Settings persistence via key-value table scoped to user/system
- No custom middleware framework — uses Next.js middleware for route protection

## Layers

**Presentation Layer (Client Components):**
- Purpose: Render UI, manage local state, handle user interactions
- Location: `components/` directory
- Contains: React components with "use client" directives (100% client)
- Depends on: API routes (via fetch), types from `lib/types.ts`, utility functions
- Used by: Next.js pages in `app/`

**API Layer (Route Handlers):**
- Purpose: Handle HTTP requests, enforce auth, call database, return JSON
- Location: `app/api/` (Next.js App Router)
- Contains: Route handlers for trades, settings, auth, symbols, quotes, alerts, etc.
- Depends on: Database (`lib/db.ts`), Auth (`lib/auth.ts`), Types (`lib/types.ts`), Validation helpers
- Used by: Client components via fetch requests

**Server Utility Layer (Lib Functions):**
- Purpose: Reusable server logic: auth, database access, validation, email, CSV handling
- Location: `lib/` directory
- Key modules:
  - `lib/db.ts`: SQLite connection, schema initialization, migrations
  - `lib/auth.ts`: JWT operations, session verification, password hashing (bcrypt)
  - `lib/types.ts`: TypeScript interfaces for all entities
  - `lib/validate-trade.ts`: Trade field validation
  - `lib/trade-utils.ts`: Trade calculations (P&L, drawdown, win rate, etc.)
  - `lib/email.ts`: Email sending via nodemailer
  - `lib/csv.ts`: CSV import/export for trades
  - `lib/rate-limit.ts`: Request rate limiting
  - `lib/demo-data.ts`: Demo/guest mode data

**Data Access Layer (SQLite):**
- Purpose: Persist all application state
- Location: `data/ledger-of-alpha.db` (created at runtime, gitignored)
- Schema: Tracks migrations via `_migrations` table; inline schema in `lib/db.ts`
- Tables: users, trades, settings, symbols, email_tokens, alerts, accounts
- Mode: WAL (Write-Ahead Logging) for concurrency; foreign_keys enabled

**Routing Layer (Pages):**
- Purpose: Define URL structure and compose components
- Location: `app/` (Next.js App Router file-based routing)
- Key routes: `/` (dashboard), `/trades`, `/journal`, `/chart`, `/settings`, `/admin/*`, `/login`, `/register`, `/verify-2fa`
- Auth: Protected by middleware (`middleware.ts`); public routes bypass protection

## Data Flow

**Authenticated User Trade Create:**

1. Client component opens `TradeModal` (form component)
2. User submits form → POST to `/api/trades`
3. API route validates JWT from session cookie (via `getSessionUser`)
4. Route calls `validateTradeFields()` from `lib/validate-trade.ts`
5. If valid, inserts into `trades` table with `user_id` → returns created trade
6. Client component receives response, updates local state
7. Dashboard and charts reactively update filtered trade data

**Settings Persistence:**

1. Client component reads settings via GET `/api/settings`
2. API returns user-specific settings merged with system defaults (via SQL UNION)
3. Client caches in React state; optionally reads from `localStorage` for UI state (sidebar width, chart tabs, etc.)
4. User modifies setting → PUT `/api/settings` with key-value pairs
5. Server performs upsert into `settings` table (user_id, key, value)
6. Client confirms, updates local state

**Authentication Flow:**

1. Unauth user → redirected to `/login` by middleware
2. User submits email + password → POST `/api/auth/login`
3. Route looks up user, verifies password (bcrypt), checks email verified
4. If 2FA enabled: returns `requires2fa` response, sets short-lived `pending_2fa` cookie
5. Client redirects to `/verify-2fa`, prompts for TOTP code
6. Code submitted → POST `/api/auth/2fa/verify`
7. If correct, route issues full session JWT, sets `session` cookie (7d expiry)
8. Middleware checks `session` cookie on every request, allows through if valid
9. For admin routes, `requireAdmin()` helper re-verifies admin status in DB (prevents stale JWT)

**Guest Mode:**

1. Unauth user without login clicks "Try as Guest" or accesses with guest cookie
2. Middleware allows request if `guest=true` cookie present
3. API routes check `isGuest(req)` — return `DEMO_TRADES` and `DEMO_SETTINGS` instead of querying DB
4. Buttons to create/delete trades return 403 (guests cannot modify)

**State Management:**

- **Client-side Local State:** React `useState` in components (form inputs, modals, filters)
- **Global Client State:** AccountProvider (`lib/account-context.tsx`) — holds active account and account list
- **Server State:** SQLite database; fetched on-demand via API routes
- **UI Preferences:** Persisted in `settings` table (dashboard layout, watchlist config) — also cached in `localStorage` for quick access
- **Session:** JWT in `session` cookie verified by middleware and API routes

## Key Abstractions

**Trade:**
- Purpose: Represents a single buy/sell entry and exit
- Examples: `lib/types.ts` (Trade interface), `app/api/trades/route.ts` (CRUD), `lib/trade-utils.ts` (calculations)
- Pattern: Data class with validation; calculations separated from storage

**Settings:**
- Purpose: Persist key-value pairs (system-wide and per-user)
- Examples: `discord_webhook`, `fmp_api_key`, `account_size`, `dashboard_layout`, `chart_tabs`
- Pattern: Lazy loading with system defaults; user overrides take precedence

**Account:**
- Purpose: Group trades under a trading account (allows multi-account tracking)
- Examples: Account A (live trading), Account B (paper trading)
- Pattern: Every trade references an `account_id`; settings and queries filter by account

**Watchlist & Tab (in PersistentChart):**
- Purpose: User-defined lists of symbols to monitor; tabs to hold different chart configs
- Pattern: Stored as JSON strings in settings; reconstructed on app load
- Backward Compat: Old format (symbols array) migrated to new (WatchlistItem[] with sectors)

**Alert:**
- Purpose: Trigger price notifications
- Pattern: Stored in `alerts` table; checked server-side or client-side; can be repeating or one-time

## Entry Points

**App Root (`app/page.tsx`):**
- Location: `app/page.tsx`
- Triggers: Direct navigation to `/` or authenticated user landing
- Responsibilities: Renders dashboard; imports `DashboardShell` component

**Chart Page (`app/chart/page.tsx`):**
- Location: `app/chart/page.tsx`
- Triggers: User clicks "Chart" in navbar
- Responsibilities: Renders `PersistentChart` with watchlist, TradingView widget, trade panel

**Trades Page (`app/trades/page.tsx`):**
- Location: `app/trades/page.tsx`
- Triggers: User clicks "Trades" in navbar
- Responsibilities: Renders trade table with filters, create/edit modals

**Settings Page (`app/settings/page.tsx`):**
- Location: `app/settings/page.tsx`
- Triggers: User clicks "Settings" in navbar
- Responsibilities: Renders tabbed settings interface (account, integrations, security, etc.)

**API Entry Points:**
- `/api/auth/*` — Login, register, 2FA, email verification
- `/api/trades` — CRUD operations for trades
- `/api/trades/import` — Bulk CSV import
- `/api/settings` — Get/update user settings
- `/api/quotes` — Live stock prices (Yahoo Finance)
- `/api/ohlcv` — Candlestick data for charts
- `/api/symbols` — Symbol search (FMP)
- `/api/alerts` — Alert CRUD and trigger checks
- `/api/discord` — Send chart snapshots to Discord webhook
- `/api/accounts` — Account CRUD

## Error Handling

**Strategy:** Return appropriate HTTP status codes; client shows toasts/alerts; no thrown errors bubble up

**Patterns:**
- **Validation Error:** 400 (Bad Request) with error message
- **Auth Failure:** 401 (Unauthorized) or 403 (Forbidden) depending on context
- **Not Found:** 404 (Not Found)
- **Server Error:** 500 (Internal Server Error) with console.error log
- **Client:** Catch fetch errors, display toast, allow user to retry

**Examples:**
- `lib/validate-trade.ts`: Validates trade fields, throws on invalid input (caught by API route)
- API routes wrap try-catch to return 500 on unexpected errors
- Client components wrap fetch calls in try-catch, show error UI

## Cross-Cutting Concerns

**Logging:** No structured logging framework. Uses `console.error()` in API routes for debugging; client-side errors logged to console.

**Validation:**
- Input validation in API routes before DB write
- `lib/validate-trade.ts` validates trade fields (symbol, direction, price, shares, etc.)
- Form validation on client (HTML5 + custom)

**Authentication:**
- Session JWT checked by middleware on every request
- JWT payload includes user id, email, 2FA status, admin flag
- `getSessionUser()` extracts user from session cookie; `requireAdmin()` re-verifies admin in DB
- Guest mode uses `guest=true` cookie; API returns demo data instead of querying

**Authorization:**
- Middleware enforces `/admin` routes only for `isAdmin` flag
- API routes check `getSessionUser()` and reject if null
- Some routes (create/delete trades) reject guests with 403

**Rate Limiting:**
- `lib/rate-limit.ts`: In-memory rate limit per IP/email (login attempts)
- Used in `/api/auth/login` (10 attempts per 15 minutes per email)

**CORS:** Not explicitly configured; API and UI are same-origin (monolith)

**Security Headers:** Set by `next.config.ts` — X-Content-Type-Options, X-Frame-Options, CSP, etc.

---

*Architecture analysis: 2026-03-14*
