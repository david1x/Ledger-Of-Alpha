# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start
```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build (also type-checks)
npm run start        # Start production server
```
No lint or test commands are configured. `npm run build` is the primary validation step (runs TypeScript type-checking).

## Stack
Next.js 15 (App Router), TypeScript, Tailwind CSS v3, better-sqlite3, recharts, lightweight-charts@4, @dnd-kit (core/sortable/utilities), next-themes, lucide-react

## Project Structure
- `app/` — Next.js App Router pages + API routes
- `components/` — React components (all client-side "use client")
- `lib/` — Server utilities (db.ts, auth.ts, rate-limit.ts, validate-trade.ts, csv.ts, demo-data.ts, account-context.tsx)
- `data/` — SQLite database (auto-created on first API call, gitignored)

## Key Files
- `components/dashboard/DashboardShell.tsx` — Main dashboard orchestrator (~770 lines). 24 widget cards with drag-reorder, hide/show, 3 size modes (large/medium/compact), time filtering (30/60/90/All), layout persistence via settings API. Account-aware: scopes data by active account.
- `components/dashboard/WeeklyCalendar.tsx` — Weekly calendar strip with daily P&L, trade counts, click-to-popup trade details
- `components/dashboard/HeatmapWidget.tsx` — Monthly calendar heatmap with click-to-popup trade details
- `components/dashboard/ChartWidgets.tsx` — Area/Bar chart widget renderers (cumulative P&L, drawdown, win%, etc.)
- `components/dashboard/ComparisonWidget.tsx` — Two-value side-by-side comparison cards
- `components/dashboard/PerfTableWidget.tsx` — Performance breakdown tables with pagination
- `components/dashboard/StatWidget.tsx` — Single stat display cards
- `components/dashboard/SymbolPnlWidget.tsx` — Horizontal bar chart for P&L by symbol
- `components/AccountBanner.tsx` — Shared account banner (balance, P&L, win rate, expectancy) used on trades + journal pages
- `components/PersistentChart.tsx` — Chart page shell (~1100 lines). Contains watchlist sidebar, TradingView widget, Add Trade panel, Discord integration, tab system.
- `components/SetupChart.tsx` — Interactive lightweight-charts candlestick chart for trade setup
- `components/MiniChart.tsx` — Read-only mini chart for journal cards and trade hover
- `components/Tooltip.tsx` — Reusable hover tooltip with auto-positioning
- `components/Navbar.tsx` — Sidebar navigation with account switcher dropdown (Wallet icon)
- `components/TradeModal.tsx` — Trade create/edit modal with account selector
- `lib/db.ts` — Database initialization + inline migrations (no separate migration files)
- `lib/auth.ts` — JWT auth (via `jose`), 2FA (TOTP), requireAdmin helper
- `lib/account-context.tsx` — React context for multi-account state (accounts, activeAccountId, switcher)
- `middleware.ts` — Route protection (JWT session + guest cookie), admin guards, 2FA enforcement

## Architecture Notes

### Auth Flow
- JWT sessions stored in `session` cookie, verified via `jose` library
- Guest mode uses a simple `guest=true` cookie — API routes return demo data for guests
- 2FA: if enabled but not verified this session, middleware redirects to `/verify-2fa`
- **Default admin**: On first startup (no admins exist), a local admin is seeded: `ledger@local` / `ledger`. Change password after first login.
- Admin routes (`/admin`, `/api/admin`) gated in middleware; `/api/admin/claim` is exempt (bootstraps first admin)
- Public routes: `/login`, `/register`, `/verify-2fa`, `/api/auth/*`

### API Routes
All API routes live under `app/api/`. Key patterns:
- `accounts/` — CRUD for trading accounts; `accounts/[id]/` for single account ops (GET/PUT/DELETE)
- `trades/` — CRUD for trades (account-scoped via `?account_id=`); `trades/import/` for bulk import; `trades/[id]/` for single trade
- `settings/` — Key-value store for all app + UI settings
- `quotes/` — Live prices via Yahoo Finance; `ohlcv/` — candle data for charts
- `symbols/` — FMP-powered symbol search with local cache
- `discord/` — Posts chart snapshots to configured webhook
- `auth/` — Login, register, logout, email verification, 2FA setup/verify

### PersistentChart.tsx
- Watchlist data model uses `WatchlistItem = WatchlistSymbol | WatchlistSector` (backwards-compatible migration from old `symbols` array)
- Separate save timer refs for tabs (`saveTabsTimer`) and watchlists (`saveWlTimer`) — do not merge them
- Sidebar resize uses a transparent overlay div during drag to prevent TradingView iframe from stealing mouse events
- Both sidebars (watchlist + trade panel) are resizable with persisted widths (`watchlist_width`, `panel_width` settings)
- Sectors are inserted at the TOP of the items list (user preference)

### Analytics Dashboard
- `app/page.tsx` is minimal — imports `DashboardShell` from `components/dashboard/`
- **24 widget cards**: area charts, comparison cards, performance tables, single stats, heatmap, symbol P&L
- **6-column CSS grid** (`grid-cols-1 md:grid-cols-6`) with 3 size modes per widget: large (3 cols), medium (2 cols), compact (1 col)
- **Edit mode**: drag-reorder via @dnd-kit, hide/show widgets, cycle card sizes — all persisted as `dashboard_layout` setting
- **Time filter**: 30/60/90/All days — filters all widget data by exit_date
- **Privacy mode**: Toggle in the header (eye icon) to mask all sensitive numbers.
- **Weekly calendar strip**: shows daily P&L and trade counts, click day to see trade popup
- **Heatmap**: monthly calendar with color-coded P&L, click day for trade popup
- **AccountBanner**: shared component on trades + journal pages (balance, P&L, win rate, expectancy). Now includes a privacy toggle.

### Sidebar / Navbar
- **Permanently collapsed**: Sidebar locked to 64px icon-only mode on desktop. No expand toggle.
- **Hover tooltips**: All nav icons show custom tooltips (dark bg, ring border, scale-in animation, 100ms delay) on hover.
- **Account Switcher**: Dropdown between logo and nav links (Wallet icon). Shows current account name or "All Accounts". Includes "Manage Accounts" link to settings.
- **Admin Panel**: Accessible via the User Dropdown menu (for admins).
- **Color**: `dark:bg-slate-900 bg-slate-100` — matches the trades filter bar.

### Trades Page Layout
- **Filter bar**: Sticky navbar-style bar at top (`h-16`, bottom border only, `dark:bg-slate-900`). Contains filter dropdowns, SavedViews, Clear button, import/export (icon-only), and New Trade button.
- **No filter chips**: Active filters indicated by colored dropdown buttons; "Clear" button appears when any filter is active.
- **Stats cards**: Full-width row of 3 cards (Cumulative Return, P/L Ratio, Win %) with dual-color sparklines (line + fill use different colors).
- **Table + Sidebar**: Flex row filling remaining viewport height. Table scrolls vertically and horizontally independently. No page-level scroll.
- **Stats sidebar**: 430px wide, always visible (no collapse toggle), top aligned with trade table frame. Setups panel limited to 7 items with "Show more" expand button.
- **Trade table**: Font size `text-sm` for data cells. Direction/status badges use `rounded-md ring-1 ring-inset` with white text. Symbol color is `text-violet-400`.
- **Column config cog**: Floating at top-right of table, overlapping the header row.

### Multi-Account System
- Each user can have multiple trading accounts (e.g. "Main", "Paper Trading", "Futures")
- **`accounts` table**: id, user_id, name, starting_balance, risk_per_trade, commission_value, is_default, created_at
- **`account_id` on trades**: every trade belongs to an account; migration 015 backfills existing trades
- **AccountProvider** (`lib/account-context.tsx`): React context wrapping the app in `layout.tsx`
  - Provides `accounts`, `activeAccountId`, `activeAccount`, `setActiveAccountId`, `refreshAccounts`
  - `activeAccountId = null` means "All Accounts" aggregate view
  - Persists active selection in `localStorage` key `active_account_id`
- **Account switcher** in Navbar sidebar: dropdown with Wallet icon, lists all accounts + "All Accounts"
- **Account selector** in TradeModal: shown when user has >1 account, defaults to active account
- **Account-aware pages**: Dashboard, Trades, Journal all scope data by active account
- **Accounts management** in Settings: "Accounts" tab for inline editing name/balance/risk/commission, add/delete
- **Guest mode**: single demo account (`DEMO_ACCOUNTS` in `lib/demo-data.ts`)
- **Current balance** is computed client-side as `startingBalance + totalRealizedPnl`
- PositionSizer (chart page + trade modal) uses `currentBalance` for position sizing

### Settings Persistence
All UI state is persisted via `/api/settings` as JSON strings:
- `chart_tabs` — tab configuration
- `watchlists` — watchlist data (items array with symbols + sectors)
- `watchlist_width` — watchlist sidebar width
- `panel_width` — trade panel sidebar width
- `dashboard_layout` — widget order, hidden list, and size per widget
- `dashboard_time_filter` — time period filter (30/60/90/all)

### Settings Page
- Admin pages (Users, System Settings) are integrated into the settings sidebar
- **Accounts tab**: Manage trading accounts (add, edit name/balance/risk/commission, delete). Shows computed current balance per account.
- Uses `?tab=` query param for navigation between sections

### Database
- SQLite with WAL mode and foreign keys enabled
- Schema and migrations are inline in `lib/db.ts` (tracked via `_migrations` table)
- `serverExternalPackages: ["better-sqlite3", "nodemailer", "bcryptjs"]` in next.config
- `output: "standalone"` configured for Docker deployment

### Environment Variables
Copy `.env.example` to `.env.local` for local dev. Key vars:
- `JWT_SECRET` — required for auth (min 32 chars)
- `SMTP_*` — optional email config (without it, emails print to console in dev)
- `NEXT_PUBLIC_APP_URL` — public URL for email links
- `DB_PATH` — optional override for SQLite database location

## Windows Environment
- Use `powershell -Command "Stop-Process -Name node -Force"` to kill Node processes
- Use `powershell -Command "Remove-Item -Recurse -Force '.next'"` to clean build
- Always clear `.next` after deleting pages (stale type stubs cause 500 errors)

## Conventions
- Dark mode first, light mode support via next-themes
- Tailwind classes: `dark:` prefix pattern (e.g., `dark:bg-slate-900 bg-white`)
- Emoji icons in Discord messages only, not in UI (user preference)
- Lucide React for all UI icons
- No unnecessary abstractions — inline styles and direct state management preferred
