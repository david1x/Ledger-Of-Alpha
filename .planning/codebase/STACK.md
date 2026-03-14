# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5 - All application code, type-safe server and client components
- JSX/TSX - React component definitions (client-side and server components)

**Secondary:**
- SQL - SQLite database queries (embedded in TypeScript via better-sqlite3)

## Runtime

**Environment:**
- Node.js 22+ (implied by package.json devDependencies)
- Browser (React 19 - client-side components)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (standard for npm)

## Frameworks

**Core:**
- Next.js 15.1.0 - Full-stack React framework with App Router
  - App Router (`app/` directory structure)
  - API routes (`app/api/`)
  - Server-side rendering and static generation
  - Built-in security headers via `next.config.ts`
- React 19.0.0 - UI component library
- React DOM 19.0.0 - DOM rendering

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS 8 - CSS transformation pipeline
- Autoprefixer 10.0.1 - Vendor prefix handling

**Charts & Visualization:**
- recharts 2.15.0 - React charting library (area charts, bar charts, heatmaps)
- lightweight-charts 4.2.3 - Financial charting library (candlestick, TradingView widget)
- lucide-react - Icon library for UI

**Utilities:**
- clsx 2.1.1 - Conditional className builder (Tailwind patterns)
- next-themes 0.4.4 - Dark mode theme switching
- qrcode 1.5.4 - QR code generation (2FA setup)

## Key Dependencies

**Critical:**
- jose 6.1.3 - JWT signing and verification for session management (`lib/auth.ts`)
- bcryptjs 3.0.3 - Password hashing with 12 rounds (timing-attack resistant)
- better-sqlite3 11.7.0 - SQLite database (server-side only, compiled native module)
- nodemailer 8.0.1 - SMTP email sending (verification, 2FA OTP, password reset)

**UI & Interaction:**
- @dnd-kit/core 6.3.1 - Drag-and-drop core library
- @dnd-kit/sortable 10.0.0 - Sortable collection mixin (dashboard widget reordering)
- @dnd-kit/utilities 3.2.2 - Utility functions for drag-and-drop

**Type Support:**
- @types/bcryptjs 2.4.6 - TypeScript types for bcryptjs
- @types/better-sqlite3 7.6.12 - TypeScript types for better-sqlite3
- @types/node 22 - TypeScript types for Node.js APIs
- @types/nodemailer 7.0.11 - TypeScript types for nodemailer
- @types/qrcode 1.5.6 - TypeScript types for qrcode
- @types/react 19 - TypeScript types for React
- @types/react-dom 19 - TypeScript types for React DOM

**Testing:**
- playwright 1.58.2 - E2E testing framework (browser automation)

## Configuration

**Environment:**
- `.env.local` (per CLAUDE.md) - Local development configuration
- `.env.example` - Template with all required variables
- Variables are read via `process.env` in Node.js, `process.env.NEXT_PUBLIC_*` for client-side

**Key Configuration Files:**
- `tsconfig.json` - TypeScript compiler settings
  - Target: ES2017
  - Module resolution: "bundler" (Next.js specific)
  - Path alias: `@/*` maps to project root
  - Strict mode enabled
- `next.config.ts` - Next.js build and runtime configuration
  - `serverExternalPackages: ["better-sqlite3", "nodemailer", "bcryptjs"]` - Native modules for server
  - `output: "standalone"` - Docker-deployable standalone build
  - Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- `tailwind.config.js` (assumed present) - Tailwind CSS configuration
- `.prettierrc` (if present) - Code formatting rules
- `.eslintrc*` (not mentioned in config files) - Linting rules

## Platform Requirements

**Development:**
- Windows 11 Pro or equivalent (project uses bash shell syntax)
- Node.js 22+
- npm
- SQLite3 (bundled via better-sqlite3)
- Optional: Python for Playwright, email client for SMTP testing

**Production:**
- Docker support via `output: "standalone"` in next.config.ts
- Node.js 22+ runtime
- SQLite database file (persists to `data/ledger-of-alpha.db` or custom `DB_PATH`)
- Email delivery (SMTP server or console fallback in dev)
- Minimum resources: Single-core CPU, 512MB RAM sufficient for typical trading journal use

## Deployment Configuration

**Build Output:**
- `npm run build` → Optimized Next.js build → `.next/` directory
- Type-checking included in build step
- Supports standalone deployment (all dependencies bundled)

**Database:**
- SQLite 3 with WAL mode enabled
- Location: `data/ledger-of-alpha.db` (relative to `process.cwd()`)
- Configurable via `DB_PATH` environment variable
- Inline migrations tracked in `_migrations` table (no separate migration files)

---

*Stack analysis: 2026-03-14*
