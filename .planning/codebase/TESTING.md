# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Status:** Not formally configured

**Installed Dependency:**
- `playwright` 1.58.2 (installed but no config or tests found)

**No active test infrastructure:**
- No Jest config found
- No Vitest config found
- No Playwright config found
- No test files found in codebase (outside of node_modules)

**Validation Method:**
- `npm run build` — Type-checks via TypeScript (primary validation)
- TypeScript strict mode enabled in `tsconfig.json`
- No lint or test npm scripts configured

## Primary Validation

**Type Safety:**
- All code must pass TypeScript strict mode compilation
- Command: `npm run build` runs Next.js build which includes full type-checking
- Return types required on all functions: `-> Promise<string | null>`, `-> NextResponse`, etc.
- No implicit `any` types

**Testing Strategy:**
- Manual testing via `npm run dev` (dev server on port 3000)
- Current approach: Validation at compile-time via TypeScript, not runtime tests
- Database validation via inline migrations in `lib/db.ts`
- API route validation via try/catch blocks with error responses

## Test Data & Fixtures

**Demo Data:**
- File: `lib/demo-data.ts`
- Contains: `DEMO_ACCOUNT`, `DEMO_TRADES`, `DEMO_SETTINGS`
- Used by: Guest mode (returns demo data when `guest=true` cookie is set)
- Pattern:
```typescript
/** Demo account returned to guests. */
export const DEMO_ACCOUNT: Account = {
  id: "demo-account",
  user_id: "guest",
  name: "Demo Account",
  starting_balance: 10000,
  risk_per_trade: 1,
  commission_value: 0,
  is_default: 1,
  created_at: new Date().toISOString(),
};

/** Realistic fake trades returned to guests instead of real DB data. */
export const DEMO_TRADES: Trade[] = [
  {
    id: 1,
    symbol: "AAPL",
    direction: "long",
    status: "closed",
    // ... trade fields
  },
  // ... more trades
];
```

**Usage Pattern:**
- API routes check `isGuest(req)` and return demo data directly
- Example in `app/api/trades/route.ts`:
```typescript
export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    const { searchParams } = new URL(req.url);
    let trades = [...DEMO_TRADES];
    // apply filters
    return NextResponse.json(trades);
  }
  // authenticated user logic
}
```

## Validation Patterns

**Field Validation:**
- File: `lib/validate-trade.ts`
- Function: `validateTradeFields(body: Record<string, unknown>): string | null`
- Returns: Error string if invalid, `null` if valid
- Pattern:
```typescript
export function validateTradeFields(body: Record<string, unknown>): string | null {
  const { symbol, direction, status, notes, tags } = body;

  if (symbol !== undefined && symbol !== null) {
    if (typeof symbol !== "string" || symbol.length === 0 || symbol.length > 20) {
      return "Symbol must be 1-20 characters.";
    }
  }

  if (direction !== undefined && direction !== "long" && direction !== "short") {
    return "Direction must be 'long' or 'short'.";
  }

  if (status !== undefined && !["planned", "open", "closed"].includes(status as string)) {
    return "Status must be 'planned', 'open', or 'closed'.";
  }

  // More field validations...
  return null;
}
```

- Used in API routes:
```typescript
const validationError = validateTradeFields(body);
if (validationError) {
  return NextResponse.json({ error: validationError }, { status: 400 });
}
```

**Database Validation:**
- Inline CHECK constraints in `lib/db.ts`:
```sql
CREATE TABLE trades (
  direction   TEXT NOT NULL CHECK(direction IN ('long', 'short')),
  status      TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'open', 'closed')),
  -- ...
);
```

- Foreign key constraints:
```sql
CREATE TABLE email_tokens (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ...
);
```

## Error Handling in Routes

**Pattern:** All API routes wrap logic in try/catch:
```typescript
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validation
    const validationError = validateTradeFields(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Handler logic
    const result = db.prepare(query).run(...params);
    return NextResponse.json(result);
  } catch (e) {
    console.error("route name error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Error Response Format:**
- Always JSON: `{ error: "Human-readable message" }`
- HTTP status codes: `400` (validation), `401` (auth), `403` (forbidden), `404` (not found), `500` (server error)
- No stack traces exposed to client

## Auth Flow Testing

**Manual Testing Points:**
- Guest mode: Navigate to `/login`, click guest button (sets `guest=true` cookie)
- Login: Submit form at `/login`, receives `session` JWT cookie
- 2FA setup: Admin page at `/admin/users`, enable 2FA for a user
- 2FA verification: Login with 2FA enabled, redirected to `/verify-2fa`
- Admin access: Non-admin users cannot access `/admin` routes (enforced in `middleware.ts`)
- Session expiry: Stale JWT causes redirect to `/login`

**Middleware Guards:**
- File: `middleware.ts`
- Public routes: `/login`, `/register`, `/verify-2fa`, `/api/auth/*`
- Session validation: Checks JWT in `session` cookie
- 2FA enforcement: If `twoFactorEnabled && !twoFactorDone`, redirect to `/verify-2fa`
- Admin checks: Non-admins cannot access `/admin` or `/api/admin` (except `/api/admin/claim`)

## Security Testing Patterns

**Password Hashing:**
- Bcrypt with 12 rounds (`BCRYPT_ROUNDS = 12`)
- Timing attack mitigation: Always hash password even if user not found using `DUMMY_HASH`
- Code in `app/api/auth/login/route.ts`:
```typescript
const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
if (!user || !passwordValid) {
  return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
}
```

**Rate Limiting:**
- File: `lib/rate-limit.ts`
- Applied to login: 10 attempts per 15 minutes per email
- Applied to registration: 5 attempts per hour per IP
- Returns `429` response when exceeded

**CSRF Protection:**
- Implicit via Next.js (SameSite cookies, no CSRF tokens needed for same-origin POST)

**Input Validation:**
- All trade fields validated in `validateTradeFields()`
- Symbol length limited: 1-20 characters
- Notes/lessons limited: 5000 characters max
- SQL injection prevention: All queries use parameterized queries (`db.prepare().run(...params)`)

## Coverage

**Requirements:** No coverage threshold enforced

**What's Tested (via validation):**
- Database schema via inline migrations
- API input validation via try/catch + `validateTradeFields()`
- Authentication via JWT validation
- Authorization via middleware role checks

**What's NOT Tested:**
- React component rendering (no Jest/Vitest)
- Component user interactions (no Playwright E2E)
- Business logic calculations (manual verification)
- API integration (no integration tests)
- UI workflows (manual testing only)

## Manual Testing Checklist

**Before commit, verify:**
1. `npm run build` passes (TypeScript strict mode)
2. `npm run dev` starts on port 3000
3. Guest mode accessible without login
4. Login/register workflow completes
5. Trades CRUD operations work
6. Settings persistence works
7. Dashboard renders all 24 widgets
8. Drag-and-drop reordering works
9. Time filter toggles (30/60/90/All) update data
10. Privacy mode masks sensitive numbers

---

*Testing analysis: 2026-03-14*
