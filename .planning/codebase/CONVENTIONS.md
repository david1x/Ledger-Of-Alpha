# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- kebab-case for filenames: `demo-data.ts`, `trade-utils.ts`, `validate-trade.ts`, `AccountBanner.tsx`, `DashboardShell.tsx`
- Components: PascalCase (e.g., `AccountBanner.tsx`, `TradeModal.tsx`)
- Library/utility files: kebab-case (e.g., `auth.ts`, `db.ts`, `types.ts`, `trade-utils.ts`)
- No file extensions in imports — use path aliases via `@/` (e.g., `@/lib/auth`, `@/components/Tooltip`)

**Functions:**
- camelCase for all function names: `getDb()`, `verifyPassword()`, `signJwt()`, `formatHoldDuration()`
- Helper functions prefixed with single operation: `calc*`, `format*`, `validate*`, `get*`, `is*`
- Examples: `calcRRAchieved()`, `calcPercentReturn()`, `formatHoldDuration()`, `validateTradeFields()`, `getSessionUser()`, `isGuest()`, `isPublic()`

**Variables:**
- camelCase for all variables: `accountSize`, `startingBalance`, `totalPnl`, `currentBalance`
- Constants in UPPER_SNAKE_CASE: `DUMMY_HASH`, `BCRYPT_ROUNDS`, `PUBLIC_PREFIXES`, `MARKET_CONTEXTS`, `TRADE_FIELDS`
- Boolean variables prefixed with `is`, `has`, `can`, `should`: `isGuest`, `hasLive`, `emailVerified`, `twoFactorEnabled`
- Abbreviated: `fmt` (format function), `db`, `cols`, `refs`

**Types & Interfaces:**
- PascalCase for all types and interfaces: `User`, `SessionUser`, `Trade`, `RiskCalcResult`, `PositionSizeResult`
- Props interfaces named `Props`: `interface Props { trades: Trade[]; quotes?: QuoteMap; ... }`
- Type aliases use camelCase for compound names: `TradeDirection`, `TradeStatus`, `MarketContext`, `AlertCondition`, `QuoteMap`
- Union types in lowercase: `"long" | "short"`, `"planned" | "open" | "closed"`

## Code Style

**Formatting:**
- No explicit prettier/eslint config detected
- Use standard formatting (spaces, 2-space indentation implied by Next.js defaults)
- Tailwind CSS classes on same line or broken across multiple lines for readability
- Dark mode first: `dark:bg-slate-900/80 bg-white` pattern (dark variant first, then light fallback)

**Linting:**
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- Type annotations required for function parameters and return types
- No implicit `any` types

## Import Organization

**Order:**
1. External libraries (React, Next.js, third-party packages): `import { useEffect, useState } from "react"; import Database from "better-sqlite3";`
2. Type imports from external libraries: `import type { NextRequest } from "next/server"; import type { JWTPayload } from "jose";`
3. Internal library imports: `import { getDb } from "@/lib/db"; import { verifyPassword } from "@/lib/auth";`
4. Internal component imports: `import TradeTable from "@/components/TradeTable"; import { DndContext } from "@dnd-kit/core";`
5. Type imports from local files: `import type { Trade } from "@/lib/types"; import type { SessionUser } from "@/lib/types";`

**Path Aliases:**
- Use `@/` alias for all imports (configured in `tsconfig.json`)
- Always prefer absolute paths via `@/` over relative paths

**Client Components:**
- Files using React hooks start with `"use client";` directive: See `AccountBanner.tsx`, `DashboardShell.tsx`, `Tooltip.tsx`
- Server utilities (in `lib/`) do NOT have `"use client"` — they're inherently server-side via Node.js imports

## Error Handling

**Patterns:**
- Standard try/catch blocks in API routes:
```typescript
export async function POST(req: NextRequest) {
  try {
    // Handler logic
  } catch (e) {
    console.error("route name error:", e);
    return NextResponse.json({ error: "Human-readable message" }, { status: 500 });
  }
}
```
- Error responses always return `{ error: "message" }` JSON shape
- HTTP status codes: `400` (bad input), `401` (unauthorized), `403` (forbidden), `404` (not found), `500` (server error)
- Validation errors caught early and returned as `400` with descriptive messages
- No error throwing in components — state management for failures
- Database errors logged to console and returned as generic `500` to client

## Logging

**Framework:** console (built-in Node.js/browser console)

**Patterns:**
- Errors: `console.error("context:", error)` in try/catch blocks (`lib/auth.ts`, `app/api/trades/route.ts`)
- Warnings: `console.warn("⚠️  WARNING: message")` for dev-time alerts (`lib/auth.ts` JWT secret warning)
- Info: `console.log("message")` for setup completion (`lib/db.ts` admin promotion, `lib/email.ts` email fallback display)
- No structured logging framework — console is the standard

## Comments

**When to Comment:**
- Security-related logic: `// Always run bcrypt to prevent timing-based email enumeration` in `app/api/auth/login/route.ts`
- Non-obvious algorithm or business logic: `// Compute achieved R:R — (exit - entry) / (entry - stop), adjusted for direction` in `lib/trade-utils.ts`
- Migration notes and important caveats: `// IMPORTANT: must run before 005...` in `lib/db.ts`
- Section headers using `// ── Section Name ──────────────────` pattern throughout

**JSDoc/TSDoc:**
- Used extensively for function and interface documentation
- Single-line JSDoc: `/** Pre-computed bcrypt hash for timing attack mitigation — used when user not found. */`
- Multi-line JSDoc for complex functions:
```typescript
/**
 * Validates trade fields. Returns an error string if invalid, or null if valid.
 */
export function validateTradeFields(body: Record<string, unknown>): string | null
```
- Interface/type documentation above each property
- No `@param` or `@returns` tags — documentation embedded in the comment

## Function Design

**Size:** Keep functions focused and under 100 lines when practical. Longer functions (e.g., `runMigrations()` in `lib/db.ts`) are acceptable when implementing sequential logic like database migrations.

**Parameters:**
- Use destructuring for object parameters: `function AccountBanner({ trades, quotes, accountSize, hidden, onToggleHidden }: Props)`
- Use Props interface pattern for React components
- Single parameter object for API route handlers: `async function POST(req: NextRequest)`
- Optional parameters marked with `?`: `quotes?: QuoteMap`

**Return Values:**
- Explicit return types on all functions: `-> Promise<string>`, `-> number | null`, `-> NextResponse`
- Nullable returns: Use `| null` (not `| undefined`): `getSessionUser() -> Promise<SessionUser | null>`
- Array returns use typed arrays: `Trade[]`, `string[]`
- Object returns use interface types: `RiskCalcResult`, `PositionSizeResult`

## Module Design

**Exports:**
- Named exports for utilities and functions: `export function calcRRAchieved()`, `export const TRADE_FIELDS`
- Default exports for React components: `export default function AccountBanner()`
- Type exports use `export type`: `export type TradeDirection = "long" | "short"`
- Re-exports not used — each file is self-contained

**Barrel Files:**
- Not used — import directly from source files
- Example: `import { getDb } from "@/lib/db"` (not from an index.ts)

## Database Naming

**Column names:** snake_case throughout: `email_verified`, `two_factor_secret`, `password_hash`, `entry_price`, `stop_loss`, `take_profit`, `exit_date`, `user_id`, `account_id`, `created_at`

**Table names:** lowercase singular: `users`, `trades`, `settings`, `email_tokens`, `symbols`

**Constraints:** Inline CHECK constraints in CREATE TABLE, foreign key constraints via REFERENCES, indices named explicitly: `idx_trades_user_id`

## Tailwind CSS Patterns

**Color/Dark Mode:**
- Dark mode first pattern: `dark:bg-slate-900/80 bg-white` means "dark slate with 80% opacity in dark mode, white in light"
- Slate color palette primary: `slate-300`, `slate-400`, `slate-500`, `slate-700`, `slate-900`
- Semantic colors: `emerald-400` (positive/profit), `red-400` (negative/loss), `yellow-400` (warning)
- Text colors: `dark:text-slate-400 text-slate-500` (always pair dark and light variants)

**Spacing & Layout:**
- Flex layouts: `flex items-center gap-2`, `flex flex-wrap`, `flex-col`
- Grid: `grid grid-cols-1 md:grid-cols-6` for responsive dashboards
- Padding: `px-4 py-3`, `p-6` (consistent spacing units)

**Common Classes:**
- Rounding: `rounded-lg`, `rounded-xl`
- Shadows: `shadow-lg`
- Borders: `border`, `border-l`, `dark:border-slate-700`
- Opacity: `opacity-50`, `hover:opacity-75`

---

*Convention analysis: 2026-03-14*
