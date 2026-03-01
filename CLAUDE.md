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
- `lib/` — Server utilities (db.ts, auth.ts, rate-limit.ts, validate-trade.ts, csv.ts, demo-data.ts)
- `data/` — SQLite database (auto-created on first API call, gitignored)

## Key Files
- `components/PersistentChart.tsx` — Chart page shell (~1100 lines). Contains watchlist sidebar, TradingView widget, Add Trade panel, Discord integration, tab system. This is the largest and most complex component.
- `components/SetupChart.tsx` — Interactive lightweight-charts candlestick chart for trade setup
- `components/MiniChart.tsx` — Read-only mini chart for journal cards and trade hover
- `lib/db.ts` — Database initialization + inline migrations (no separate migration files)
- `lib/auth.ts` — JWT auth (via `jose`), 2FA (TOTP), requireAdmin helper
- `middleware.ts` — Route protection (JWT session + guest cookie), admin guards, 2FA enforcement

## Architecture Notes

### Auth Flow
- JWT sessions stored in `session` cookie, verified via `jose` library
- Guest mode uses a simple `guest=true` cookie — API routes return demo data for guests
- 2FA: if enabled but not verified this session, middleware redirects to `/verify-2fa`
- Admin routes (`/admin`, `/api/admin`) gated in middleware; `/api/admin/claim` is exempt (bootstraps first admin)
- Public routes: `/login`, `/register`, `/verify-2fa`, `/api/auth/*`

### API Routes
All API routes live under `app/api/`. Key patterns:
- `trades/` — CRUD for trades; `trades/import/` for bulk import; `trades/[id]/` for single trade
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

### Settings Persistence
All UI state is persisted via `/api/settings` as JSON strings:
- `chart_tabs` — tab configuration
- `watchlists` — watchlist data (items array with symbols + sectors)
- `watchlist_width` — watchlist sidebar width
- `panel_width` — trade panel sidebar width

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
