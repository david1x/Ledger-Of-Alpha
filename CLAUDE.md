# Ledger Of Alpha — Claude Instructions

## Quick Start
```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build (also type-checks)
```

## Stack
Next.js 15 (App Router), TypeScript, Tailwind CSS v3, better-sqlite3, recharts, lightweight-charts@4, @dnd-kit (core/sortable/utilities), next-themes, lucide-react

## Project Structure
- `app/` — Next.js App Router pages + API routes
- `components/` — React components (all client-side "use client")
- `lib/` — Server utilities (db.ts, auth.ts, rate-limit.ts)
- `data/` — SQLite database (auto-created on first API call)
- `migrations/` — SQL migration files (001–006b)

## Key Files
- `components/PersistentChart.tsx` — Chart page shell (~1100 lines). Contains watchlist sidebar, TradingView widget, Add Trade panel, Discord integration, tab system. This is the largest and most complex component.
- `components/SetupChart.tsx` — Interactive lightweight-charts candlestick chart for trade setup
- `components/MiniChart.tsx` — Read-only mini chart for journal cards and trade hover
- `lib/db.ts` — Database initialization + migrations
- `lib/auth.ts` — JWT auth, 2FA, requireAdmin helper
- `middleware.ts` — Route protection, security headers

## Architecture Notes

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
- SQLite with auto-migrations on first connection
- `serverExternalPackages: ["better-sqlite3", "nodemailer", "bcryptjs"]` in next.config

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
