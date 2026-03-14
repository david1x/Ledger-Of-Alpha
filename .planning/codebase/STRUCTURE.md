# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
Ledger-Of-Alpha/
├── app/                       # Next.js App Router — pages and API routes
│   ├── layout.tsx            # Root layout: Navbar, ThemeProvider, AccountProvider
│   ├── page.tsx              # Dashboard landing (/)
│   ├── (auth)/               # Authentication pages
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── verify-2fa/page.tsx
│   ├── trades/page.tsx       # Trades table and management
│   ├── journal/page.tsx      # Trade journal/review
│   ├── chart/page.tsx        # TradingView chart with watchlist
│   ├── alerts/page.tsx       # Alerts management
│   ├── settings/page.tsx     # Settings and admin panels
│   ├── admin/                # Admin-only routes
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Admin dashboard
│   │   ├── users/page.tsx    # User management
│   │   └── settings/page.tsx # System settings
│   └── api/                  # REST API routes
│       ├── auth/             # Authentication (login, register, 2FA, verify-email)
│       ├── trades/           # Trade CRUD and import
│       ├── settings/         # User settings key-value store
│       ├── accounts/         # Account CRUD
│       ├── alerts/           # Alert management
│       ├── quotes/           # Live stock prices
│       ├── ohlcv/            # Candlestick data
│       ├── symbols/          # Symbol search
│       ├── discord/          # Discord webhook integration
│       ├── fear-greed/       # Fear & Greed Index
│       ├── vix/              # VIX Index
│       ├── market-overview/  # Market overview data
│       └── admin/            # Admin endpoints
│
├── components/               # React client components (all "use client")
│   ├── Navbar.tsx           # Top navigation bar with menu, user dropdown
│   ├── PersistentChart.tsx  # Chart page shell: watchlist, TradingView, trade panel
│   ├── TradeModal.tsx       # Form to create/edit trades
│   ├── TradeTable.tsx       # Filterable table of trades
│   ├── AccountBanner.tsx    # Account stats banner (balance, P&L, win rate)
│   ├── AlertModal.tsx       # Price alert creation/editing
│   ├── SetupChart.tsx       # Interactive lightweight-charts candlestick chart
│   ├── MiniChart.tsx        # Read-only trade chart preview
│   ├── TradingViewWidget.tsx # TradingView iframe integration
│   ├── SymbolSearch.tsx     # Autocomplete symbol search
│   ├── PositionSizer.tsx    # Risk calculator for position sizing
│   ├── RiskCalculator.tsx   # R:R and stop-loss calculator
│   ├── PnLChart.tsx         # P&L line chart
│   ├── StatsCards.tsx       # Performance metric cards
│   ├── Tooltip.tsx          # Reusable hover tooltip
│   ├── ThemeToggle.tsx      # Dark/light mode switch
│   ├── Logo.tsx             # App logo/branding
│   │
│   └── dashboard/           # Dashboard widgets
│       ├── DashboardShell.tsx           # Main dashboard orchestrator (~770 lines)
│       ├── ChartWidgets.tsx             # AreaChart and BarChart renderers
│       ├── ComparisonWidget.tsx         # Side-by-side stat comparison cards
│       ├── StatWidget.tsx               # Single metric display
│       ├── PerfTableWidget.tsx          # Performance breakdown tables
│       ├── WeeklyCalendar.tsx           # Weekly P&L calendar strip
│       ├── HeatmapWidget.tsx            # Monthly activity heatmap
│       ├── SymbolPnlWidget.tsx          # Horizontal bar chart (P&L by symbol)
│       ├── FearGreedWidget.tsx          # Fear & Greed Index display
│       ├── VixWidget.tsx                # VIX Index display
│       └── MarketOverviewWidget.tsx     # Market overview stats
│
├── lib/                     # Server utilities and shared types
│   ├── db.ts               # SQLite connection, schema, migrations
│   ├── auth.ts             # JWT, password hashing, session helpers
│   ├── types.ts            # TypeScript interfaces (User, Trade, Settings, etc.)
│   ├── validate-trade.ts   # Trade field validation
│   ├── trade-utils.ts      # Trade calculations (P&L, drawdown, win %, etc.)
│   ├── account-context.tsx # React context for account selection
│   ├── csv.ts              # CSV import/export for trades
│   ├── email.ts            # Email sending via nodemailer
│   ├── rate-limit.ts       # In-memory rate limiting
│   ├── demo-data.ts        # Demo trades and settings for guest mode
│   ├── commission.ts       # Commission calculation
│   ├── totp.ts             # TOTP 2FA implementation
│   ├── symbols-static.ts   # Static symbol list fallback
│
├── middleware.ts            # Route protection, auth enforcement
├── next.config.ts          # Next.js configuration (security headers, serverExternalPackages)
├── tsconfig.json           # TypeScript configuration (@ path alias)
├── package.json            # Dependencies, scripts
├── tailwind.config.ts      # Tailwind CSS configuration
├── postcss.config.ts       # PostCSS with Tailwind
│
├── public/                 # Static assets
│   └── favicon.svg
│
├── data/                   # SQLite database (gitignored, created at runtime)
│   └── ledger-of-alpha.db
│
├── .env.example            # Environment variable template
└── CLAUDE.md               # Developer guide
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router structure — defines all pages and API routes
- Contains: Page files (page.tsx), API handlers (route.ts), layouts
- Key files:
  - `app/layout.tsx`: Root layout with global providers
  - `app/page.tsx`: Dashboard landing
  - `app/api/`: All REST endpoints

**`components/`:**
- Purpose: Reusable React components for the UI
- Contains: Client-side React components (all marked "use client")
- Key files:
  - `components/Navbar.tsx`: Main navigation
  - `components/PersistentChart.tsx`: Chart page (~1100 lines)
  - `components/TradeModal.tsx`: Trade creation/editing form
  - `components/dashboard/DashboardShell.tsx`: Dashboard orchestrator (~770 lines)

**`lib/`:**
- Purpose: Server utilities, types, and client context
- Contains: Non-component logic — database, auth, validation, calculations
- Key files:
  - `lib/db.ts`: SQLite setup (migrations inline)
  - `lib/auth.ts`: JWT and session management
  - `lib/types.ts`: TypeScript interfaces (source of truth for data shapes)
  - `lib/trade-utils.ts`: Trade calculations (P&L, drawdown, win %)

**`public/`:**
- Purpose: Static assets served directly
- Contains: Images, fonts, favicons
- Files: `favicon.svg`

**`data/`:**
- Purpose: SQLite database storage
- Created at runtime: `ledger-of-alpha.db`
- Ignored by git (`.gitignore` entry)

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Dashboard landing
- `app/chart/page.tsx`: Chart page with watchlist
- `app/trades/page.tsx`: Trades table
- `app/settings/page.tsx`: Settings hub
- `app/layout.tsx`: Root layout with global providers
- `middleware.ts`: Request protection

**Configuration:**
- `next.config.ts`: Security headers, serverExternalPackages, output mode
- `tsconfig.json`: TypeScript settings, @ path alias
- `package.json`: Dependencies (Next.js, Tailwind, @dnd-kit, recharts, better-sqlite3)
- `tailwind.config.ts`: Tailwind CSS theming

**Core Logic:**
- `lib/db.ts`: Database initialization, schema, migrations
- `lib/auth.ts`: JWT verification, password hashing, session extraction
- `lib/types.ts`: All TypeScript interfaces (User, Trade, Account, Settings, Alert)
- `lib/validate-trade.ts`: Trade field validation rules
- `lib/trade-utils.ts`: Calculations — P&L, drawdown, win rate, expectancy, R:R

**API Routes (by responsibility):**
- `/api/auth/*`: Login, register, 2FA, email verification
- `/api/trades`: List, create, update, delete trades
- `/api/trades/import`: Bulk CSV import
- `/api/settings`: Get/update user preferences
- `/api/accounts`: Account CRUD (multi-account support)
- `/api/quotes`: Live prices (Yahoo Finance)
- `/api/ohlcv`: Candlestick data (Yahoo Finance)
- `/api/symbols`: Symbol search (FMP)
- `/api/alerts`: Alert management and trigger checks
- `/api/discord`: Webhook integration for chart snapshots
- `/api/admin/*`: User and system settings management

**Testing:**
- No test files in codebase
- `playwright` in devDependencies (not configured)

**Documentation:**
- `CLAUDE.md`: Project guide for AI assistants
- `README.md` (if present): Project overview

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `DashboardShell.tsx`, `TradeModal.tsx`)
- Pages: lowercase with directory structure (e.g., `app/trades/page.tsx`)
- API routes: lowercase by convention (e.g., `app/api/trades/route.ts`)
- Utilities: lowercase or camelCase (e.g., `validate-trade.ts`, `trade-utils.ts`)

**Directories:**
- Feature-based grouping: `app/api/trades/`, `components/dashboard/`, `lib/`
- Dynamic routes: square brackets (e.g., `app/api/trades/[id]/route.ts`)
- Grouped layouts: parentheses (e.g., `app/(auth)/login/page.tsx`)

**React Components:**
- Functional components with hooks
- "use client" directive for client components
- Props typed with TypeScript interfaces
- All components in `components/` are client-side

**Functions & Variables:**
- camelCase for function names (e.g., `getSessionUser`, `validateTradeFields`, `calcRRAchieved`)
- UPPER_SNAKE_CASE for constants (e.g., `DEFAULT_TABS`, `PUBLIC_PREFIXES`, `BCRYPT_ROUNDS`)
- Type prefixes for TypeScript (e.g., `User`, `Trade`, `Alert`)

**Database:**
- snake_case for column names (e.g., `user_id`, `entry_price`, `exit_date`)
- Tables named plural (e.g., `trades`, `users`, `settings`)
- Indexed columns: `idx_tablename_column` (e.g., `idx_trades_user_id`)

## Where to Add New Code

**New Feature (e.g., "Add daily loss limit"):**
- Primary code: `lib/trade-utils.ts` for calculations, `app/api/trades/route.ts` for API
- Database: Add column to trades table via migration in `lib/db.ts`
- UI: Create widget in `components/dashboard/` or form field in `TradeModal.tsx`
- Tests: No test framework configured; add Playwright tests if needed

**New Component/Module:**
- If UI: Create in `components/` as `.tsx` with "use client" directive
- If server logic: Create in `lib/` as `.ts` and import from API routes
- If API endpoint: Create `app/api/[feature]/route.ts` with GET/POST/PUT/DELETE handlers

**Utilities:**
- Shared helpers: Place in `lib/` (e.g., CSV parsing, trade calculations)
- Date/time logic: Use native JavaScript (no date library imported)
- Formatting: Inline in components or in `lib/trade-utils.ts`

**Database Additions:**
- Add migration function in `lib/db.ts` inside `runMigrations()`
- Use unique migration name (e.g., "004_my_feature")
- Call `markMigration()` when complete
- Test against existing databases (migrations run once)

**Settings Storage:**
- Store in `settings` table with `(user_id, key)` as composite primary key
- Retrieve via API: GET `/api/settings`
- Update via API: PUT `/api/settings` with JSON body
- Example: `{ "dashboard_layout": "[...]", "watchlist_width": "250" }`

**API Routes:**
- All routes follow pattern: Get session → Validate → Query/Modify → Return JSON
- Always check `getSessionUser()` first (raises 401 if missing)
- Check `isGuest()` for guest-only endpoints (return demo data)
- Catch errors and return appropriate status codes (400, 403, 500)
- Example: `app/api/[feature]/route.ts`

## Special Directories

**`app/api/`:**
- Purpose: All REST endpoints
- Pattern: Each route is a `route.ts` file exporting GET, POST, PUT, DELETE functions
- Generated: No
- Committed: Yes

**`data/`:**
- Purpose: SQLite database file storage
- Generated: Yes (created at runtime on first API call)
- Committed: No (`.gitignore` entry)

**`.next/`:**
- Purpose: Next.js build output and type stubs
- Generated: Yes (from `npm run build`)
- Committed: No (`.gitignore` entry)
- Note: Clear this directory after deleting pages (stale type stubs cause 500 errors)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (from `npm install`)
- Committed: No (`.gitignore` entry)

---

*Structure analysis: 2026-03-14*
