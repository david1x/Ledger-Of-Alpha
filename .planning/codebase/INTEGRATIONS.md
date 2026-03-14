# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Market Data:**
- Yahoo Finance - Live quotes and OHLCV data
  - Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/`
  - Used by: `/api/quotes/route.ts` (1-minute quote caching), `/api/ohlcv/route.ts` (candlestick data)
  - Auth: None (public endpoint)
  - Cache: 60 seconds for quotes, 5 minutes for OHLCV
  - Headers: User-Agent required to prevent rate limiting

- Financial Modeling Prep - Symbol search
  - Endpoint: `https://financialmodelingprep.com/stable/search-symbol`
  - Used by: `/api/symbols/route.ts`
  - Auth: `fmp_api_key` (per-user setting or system fallback)
  - Env var: None (stored in `settings` table)
  - Fallback: Local static symbol database if FMP key unavailable
  - Implementation: `lib/symbols-static.ts` contains hardcoded US exchange symbols

- CNN Fear & Greed Index - Market sentiment
  - Endpoint: `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
  - Used by: `/api/fear-greed/route.ts`
  - Auth: None (public, with Referer header spoofing)
  - Cache: 10 minutes
  - Headers: User-Agent + Referer required (CNN blocks requests without them)

- Market Overview Indices (S&P 500, NASDAQ, DOW)
  - Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/`
  - Used by: `/api/market-overview/route.ts`
  - Auth: None (public endpoint)
  - Cache: 5 minutes
  - Symbols: %5EGSPC (S&P), %5EIXIC (NASDAQ), %5EDJI (DOW)

- VIX (Volatility Index)
  - Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX`
  - Used by: `/api/vix/route.ts`
  - Auth: None (public endpoint)

## Data Storage

**Primary Database:**
- SQLite 3 (better-sqlite3 client)
  - Path: `data/ledger-of-alpha.db` or `DB_PATH` env var
  - Mode: WAL (Write-Ahead Logging)
  - Foreign keys: Enabled
  - Schema: Inline migrations in `lib/db.ts` (no separate migration files)

**Database Tables:**
- `users` - User accounts with password hashes, 2FA secrets, email verification status
- `trades` - Trading journal entries (symbol, P&L, entry/exit prices, timestamps, emotions, tags)
- `email_tokens` - Verification, reset, and OTP tokens (type-specific, single-use)
- `alerts` - Price alerts (above/below/crosses conditions, repeating or one-shot)
- `symbols` - Cached symbol list (auto-populated from FMP or static defaults, market cap)
- `settings` - Key-value store (user-specific and system-wide settings)
- `_migrations` - Migration tracking (name, ran_at timestamp)

**Settings Keys (stored in `settings` table):**
- User-specific: `dashboard_layout`, `dashboard_time_filter`, `chart_tabs`, `watchlists`, `watchlist_width`, `panel_width`, `fmp_api_key`, `discord_webhook`, `alert_discord_webhook`
- System-wide (`user_id='_system'`): `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `smtp_from`, `app_url`, `tv_*` (TradingView widget settings), `account_size`, `risk_per_trade`, `commission_per_trade`

**File Storage:**
- None - No external file storage service (S3, GCS, etc.)
- Chart snapshots: Base64 encoded images sent directly to Discord via multipart form data
- TradingView snapshots: Lightweight URL sharing (auto-embedded by Discord)

**Caching:**
- In-memory Maps: `quoteCache` (60s TTL), OHLCV cache (5m TTL), Fear & Greed cache (10m TTL), Market overview cache (5m TTL)
- Database query results: No ORM caching, all queries are direct via better-sqlite3

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Issuer: Internal (via `jose` library)
  - Storage: `session` cookie (httpOnly, sameSite=strict, secure flag based on `NEXT_PUBLIC_APP_URL`)
  - Algorithm: HS256 with `JWT_SECRET` (min 32 characters)
  - Lifetime: 7 days (default in `signJwt()`)
  - Implementation: `lib/auth.ts`

**Password Security:**
- Algorithm: bcryptjs with 12 rounds (BCRYPT_ROUNDS constant)
- Timing attack mitigation: DUMMY_HASH pre-computed for failed login attempts
- Reset flow: Email token with 1-hour expiration

**Two-Factor Authentication:**
- Type: TOTP (Time-based One-Time Password)
- Backup: Email OTP as fallback (10-minute expiration)
- Setup: `/api/auth/2fa/setup/route.ts` generates QR code (via `qrcode` library)
- Verify: `/api/auth/2fa/verify/route.ts` validates TOTP
- Email OTP: `/api/auth/2fa/email-otp/route.ts` sends 6-digit code
- Secrets stored in: `users.two_factor_secret`, `users.two_factor_backup_codes`

**Guest Mode:**
- Cookie-based: `guest=true` cookie (no session required)
- Returns demo data for all API endpoints
- Restricted from: Settings, admin, webhook testing, trade imports

**Session Payload (JWT):**
```typescript
{
  sub: string;           // user ID
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorDone: boolean;
  isAdmin: boolean;
  iat: number;          // issued at
  exp: number;          // expiration (7 days)
}
```

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar integration
- Errors logged to console via `console.error()`

**Logs:**
- Console output in development
- No structured logging service integration
- Per-request error logging in API routes (e.g., "discord API error:", "symbols API error:")
- Email template rendering falls back to console output if SMTP not configured

**Performance Monitoring:**
- None detected - No analytics or APM service

## CI/CD & Deployment

**Hosting:**
- Docker-ready via `output: "standalone"` (self-contained build)
- Deployment target: Any environment with Node.js 22+ (Docker, VPS, Vercel, Railway, etc.)
- Local dev: `npm run dev` (Next.js dev server on port 3000)

**CI Pipeline:**
- None detected in codebase
- `npm run build` is the primary validation (TypeScript type-checking)
- No lint or test commands configured (per CLAUDE.md)
- E2E testing possible with Playwright but not in CI config

**Build Commands:**
```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build (type-check included)
npm run start        # Start production server
```

## Environment Configuration

**Required env vars:**
- `JWT_SECRET` (min 32 characters) - Session signing key
- `NEXT_PUBLIC_APP_URL` (optional, defaults to `http://localhost:3000`) - Public URL for email links and redirects

**Optional env vars:**
- `DB_PATH` - SQLite database location (defaults to `data/ledger-of-alpha.db`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` - Email configuration
  - Without SMTP: Emails print to console in development
  - Per-user/system override: Via admin settings panel (stored in `settings` table)

**Secrets location:**
- `.env.local` file (development)
- Environment variables (production/Docker)
- Nodemailer credentials stored in `settings` table for admin panel configuration
- Never committed to git (`.env*` in `.gitignore`)

**Public Client Variables (prefixed `NEXT_PUBLIC_`):**
- `NEXT_PUBLIC_APP_URL` - Used for email verification links, password resets, OAuth redirects

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/verify-email?token=...` - Email verification callback
- `/api/auth/reset-password?token=...` (frontend route, not API) - Password reset link target
- No external webhook ingestion (read-only integrations only)

**Outgoing:**
- Discord Webhook (user-configured)
  - Endpoint: Stored in `settings.discord_webhook` (per-user or system-wide fallback)
  - Used by: `/api/discord/route.ts` (chart snapshots), `/api/alerts/trigger/route.ts` (price alerts)
  - Auth: Discord webhook URL (validates format `https://discord.com/api/webhooks/...`)
  - Test endpoint: `/api/discord/test/route.ts` (requires user session)
  - Payload: JSON with username + content, or multipart form data with PNG image
  - Alert webhook fallback: `alert_discord_webhook` setting (separate from general `discord_webhook`)

**External URLs Embedded:**
- TradingView widget URLs (embedded in `lightweight-charts`)
- Trade setup snapshots (Discord-embedded via TradingView snapshot URLs)

---

*Integration audit: 2026-03-14*
