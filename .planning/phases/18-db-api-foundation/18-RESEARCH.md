# Phase 18: DB & API Foundation - Research

**Researched:** 2026-03-21
**Domain:** SQLite migrations (better-sqlite3), Next.js 15 App Router API routes, TypeScript type definitions
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIST-01 | User can create, edit, and delete custom mistake types (name + color) | Covered by migrations 023+024, `/api/mistakes` CRUD routes, and `GET /api/trades` date filter extension |
</phase_requirements>

---

## Summary

Phase 18 is a pure backend foundation phase: no UI is built. The deliverables are two new DB migrations, four new API route files, an extension to `GET /api/trades`, and three new TypeScript interfaces. All downstream phases (19-23) depend on this foundation being in place and testable.

The codebase uses better-sqlite3 with an established inline migration pattern tracked via the `_migrations` table. The latest migration is `022_checklist_state`. New migrations will be numbered `023_mistake_types` and `024_trade_mistake_tags`. All API routes follow a consistent pattern: check `isGuest()` first, then `getSessionUser()`, then DB operations. New routes must follow this exact pattern.

The pre-condition flagged in STATE.md is mandatory: the `trades.mistakes` TEXT column (added in migration 013) must be audited before any work begins to confirm whether it contains freeform text or structured data. This audit must be completed by the developer as the very first step and surfaced to the user if non-null values exist — those values are freeform reflection notes and must not be disturbed by the new tagging system.

**Primary recommendation:** Add migrations 023 and 024 to `lib/db.ts`, create four new API route files under `app/api/mistakes/`, extend `GET /api/trades` with `date_from`/`date_to` params, and add three interfaces to `lib/types.ts`. No other files need modification in this phase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | SQLite DB driver | Already installed; `serverExternalPackages` configured |
| Next.js App Router | 15 (existing) | API route handlers | Existing pattern across all 40+ API routes |
| TypeScript | existing | Type definitions | Required by the build; `npm run build` validates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/auth` — `getSessionUser`, `isGuest` | existing | Auth guard on every route | Every authenticated API route |
| `@/lib/db` — `getDb` | existing | Database singleton | Every DB-touching route |
| `crypto.randomUUID()` | Node built-in | UUID generation for `mistake_types.id` | Already used in `accounts`, `users` tables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TEXT PRIMARY KEY with UUID for `mistake_types.id` | INTEGER AUTOINCREMENT | UUID chosen: consistent with `accounts.id` and `users.id` patterns in this codebase |
| Storing mistake types as JSON in settings table | Proper `mistake_types` DB table | Settings JSON cannot support FK cascade delete; not indexable for JOIN filtering |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
```
lib/
  db.ts                         MODIFY: add migrations 023, 024 (append to runMigrations)
  types.ts                      MODIFY: add MistakeType, TradeFilterState, SavedView interfaces
app/
  api/
    mistakes/
      route.ts                  NEW: GET (list), POST (create)
      [id]/
        route.ts                NEW: PUT (rename/recolor), DELETE (cascade delete)
    trades/
      [id]/
        mistakes/
          route.ts              NEW: POST (tag trade), DELETE-via-body (untag trade)
      route.ts                  MODIFY: add date_from, date_to query params to GET
```

### Pattern 1: Migration Pattern (023 and 024)

**What:** Append two new migration blocks to `runMigrations()` in `lib/db.ts`, following the existing `hasMigration` / `markMigration` guard pattern. Migration 022 is the current last migration.

**When to use:** All schema changes go through this pattern — never use raw `db.exec()` without a migration guard.

**Example:**
```typescript
// Source: lib/db.ts — existing pattern (migrations 015-022)
// Migration 023: mistake_types
if (!hasMigration(db, "023_mistake_types")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mistake_types (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#ef4444',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_mistake_types_user ON mistake_types(user_id);
  `);
  markMigration(db, "023_mistake_types");
}

// Migration 024: trade_mistake_tags
if (!hasMigration(db, "024_trade_mistake_tags")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_mistake_tags (
      trade_id   INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      mistake_id TEXT NOT NULL REFERENCES mistake_types(id) ON DELETE CASCADE,
      PRIMARY KEY (trade_id, mistake_id)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_trade ON trade_mistake_tags(trade_id);
    CREATE INDEX IF NOT EXISTS idx_trade_mistake_tags_mistake ON trade_mistake_tags(mistake_id);
  `);
  markMigration(db, "024_trade_mistake_tags");
}
```

**Note:** `foreign_keys = ON` is already set in `getDb()` via `db.pragma("foreign_keys = ON")` — ON DELETE CASCADE will work immediately.

### Pattern 2: API Route Structure

**What:** Every API route in this codebase follows the same guard sequence. New routes must match exactly.

**When to use:** Every new route file.

**Example:**
```typescript
// Source: app/api/accounts/route.ts and app/api/trades/route.ts — existing pattern
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json([]); // guests see empty list — no demo mistake types
  }
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const mistakes = db
      .prepare("SELECT * FROM mistake_types WHERE user_id = ? ORDER BY created_at ASC")
      .all(user.id);
    return NextResponse.json(mistakes);
  } catch (e) {
    console.error("mistakes API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Pattern 3: Dynamic Route with Params

**What:** Next.js 15 App Router dynamic route handlers receive `params` as a Promise — must be awaited.

**When to use:** Any `[id]` route file.

**Example:**
```typescript
// Source: app/api/trades/[id]/route.ts line 7 — existing pattern
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

### Pattern 4: GET /api/trades Date Filter Extension

**What:** Append `date_from` and `date_to` params to the existing query builder in `app/api/trades/route.ts`. The existing builder already uses parameterised queries; follow that exact structure.

**When to use:** This is the only modification to an existing route in Phase 18.

**Example:**
```typescript
// Source: app/api/trades/route.ts lines 35-44 — existing query builder pattern
// ADDITION: after the existing if(aiPattern) block, before ORDER BY
const dateFrom = searchParams.get("date_from");
const dateTo   = searchParams.get("date_to");

if (dateFrom) { query += " AND exit_date >= ?"; params.push(dateFrom); }
if (dateTo)   { query += " AND exit_date <= ?"; params.push(dateTo); }
```

**Note for guest mode:** Also add identical date filter support to the guest branch (lines 8-21 of `app/api/trades/route.ts`) for consistency.

### Pattern 5: TypeScript Interfaces in lib/types.ts

**What:** Add three new interfaces to `lib/types.ts`. This file contains all shared types. No new file is needed.

**Example:**
```typescript
// Add to lib/types.ts

export interface MistakeType {
  id: string;
  user_id: string;
  name: string;
  color: string;     // hex string e.g. '#ef4444'
  created_at: string;
}

export interface SavedView {
  id: string;        // crypto.randomUUID()
  name: string;
  filter: TradeFilterState;
  created_at: string;
}

export interface TradeFilterState {
  symbol: string;
  status: "all" | "planned" | "open" | "closed";
  direction: "all" | "long" | "short";
  mistakeId: string | null;
  tags: string[];
  dateFrom: string | null;   // ISO date string YYYY-MM-DD
  dateTo: string | null;     // ISO date string YYYY-MM-DD
  accountId: string | null;
  pnlFilter: "all" | "winners" | "losers";
}

export const DEFAULT_FILTER: TradeFilterState = {
  symbol: "",
  status: "all",
  direction: "all",
  mistakeId: null,
  tags: [],
  dateFrom: null,
  dateTo: null,
  accountId: null,
  pnlFilter: "all",
};
```

### Pattern 6: Mistake CRUD Route Specifics

**What:** POST creates a mistake type with UUID-generated ID. DELETE cascades via DB FK. PUT allows rename or recolor.

**Full route design for `app/api/mistakes/route.ts`:**
```typescript
// GET: list user's mistake types (shown above in Pattern 2)

// POST: create
export async function POST(req: NextRequest) {
  if (isGuest(req)) return NextResponse.json({ error: "Guests cannot create mistake types." }, { status: 403 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, color } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const id = crypto.randomUUID();
    const db = getDb();
    db.prepare(
      "INSERT INTO mistake_types (id, user_id, name, color) VALUES (?, ?, ?, ?)"
    ).run(id, user.id, name.trim(), color ?? "#ef4444");
    const created = db.prepare("SELECT * FROM mistake_types WHERE id = ?").get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json({ error: "A mistake type with this name already exists." }, { status: 409 });
    }
    console.error("mistakes POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Full route design for `app/api/mistakes/[id]/route.ts`:**
```typescript
// PUT: rename/recolor
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... auth guards ...
  const { id } = await params;
  const { name, color } = await req.json();
  const db = getDb();
  const existing = db.prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?").get(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (name !== undefined) db.prepare("UPDATE mistake_types SET name = ? WHERE id = ?").run(name.trim(), id);
  if (color !== undefined) db.prepare("UPDATE mistake_types SET color = ? WHERE id = ?").run(color, id);
  return NextResponse.json(db.prepare("SELECT * FROM mistake_types WHERE id = ?").get(id));
}

// DELETE: cascades to trade_mistake_tags via FK
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... auth guards ...
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?").get(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.prepare("DELETE FROM mistake_types WHERE id = ?").run(id);
  // trade_mistake_tags rows cascade automatically — no manual cleanup needed
  return NextResponse.json({ deleted: true });
}
```

**Full route design for `app/api/trades/[id]/mistakes/route.ts`:**
```typescript
// POST: tag a trade with a mistake type
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... auth guards ...
  const { id: tradeId } = await params;
  const { mistake_id } = await req.json();
  const db = getDb();

  // Verify trade ownership
  const trade = db.prepare("SELECT id FROM trades WHERE id = ? AND user_id = ?").get(tradeId, user.id);
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  // Verify mistake type ownership
  const mistakeType = db.prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?").get(mistake_id, user.id);
  if (!mistakeType) return NextResponse.json({ error: "Mistake type not found" }, { status: 404 });

  db.prepare("INSERT OR IGNORE INTO trade_mistake_tags (trade_id, mistake_id) VALUES (?, ?)")
    .run(Number(tradeId), mistake_id);
  return NextResponse.json({ tagged: true }, { status: 201 });
}

// DELETE: untag
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... auth guards ...
  const { id: tradeId } = await params;
  const { mistake_id } = await req.json();
  const db = getDb();
  const trade = db.prepare("SELECT id FROM trades WHERE id = ? AND user_id = ?").get(tradeId, user.id);
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  db.prepare("DELETE FROM trade_mistake_tags WHERE trade_id = ? AND mistake_id = ?")
    .run(Number(tradeId), mistake_id);
  return NextResponse.json({ deleted: true });
}
```

### Anti-Patterns to Avoid

- **Reusing `trades.mistakes` TEXT column for tag IDs:** That column stores freeform reflection notes (e.g., "Chased entry"). Writing mistake type UUIDs there would corrupt user journal data. The new system uses `trade_mistake_tags` only.
- **Storing mistake types in the `settings` table:** No FK support, not indexable for JOINs, cannot cascade delete. Must be a real DB table.
- **String interpolation in SQL:** All user values must be `?` placeholders. The `mistake_id` filter uses an integer trade ID and a text UUID — both are parameterised, not interpolated.
- **Skipping ownership check on DELETE:** Always verify `WHERE id = ? AND user_id = ?` before deleting to prevent cross-user data deletion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random ID generator | `crypto.randomUUID()` | Already used for accounts.id and users.id; Node built-in |
| Cascade delete | Manual DELETE from trade_mistake_tags before deleting mistake type | FK `ON DELETE CASCADE` | Already enabled via `db.pragma("foreign_keys = ON")` in getDb() |
| Auth verification | Custom session parsing | `getSessionUser(req)` and `isGuest(req)` from `@/lib/auth` | Existing pattern in every route |
| Duplicate tag guard | Application-level deduplication check | `INSERT OR IGNORE` with composite PK | SQLite handles idempotent insert natively |

**Key insight:** SQLite FK cascade delete works because `foreign_keys = ON` is already set in `getDb()`. No application-layer cleanup is needed when deleting a mistake type.

---

## Common Pitfalls

### Pitfall 1: trades.mistakes Column Contains Freeform Text
**What goes wrong:** Migration 013 added `trades.mistakes TEXT` for freeform reflection notes like "Chased the entry, ignored stop loss." If code assumes this is a JSON array and calls `json_each()` on it, SQLite will error or return no rows for non-JSON values — silently losing data.
**Why it happens:** Developer assumes the column holds structured data without auditing actual values.
**How to avoid:** Run this audit query before writing any migration: `SELECT mistakes FROM trades WHERE mistakes IS NOT NULL LIMIT 20`. If any non-null rows exist, surface them to the user. The new tagging system writes ONLY to `trade_mistake_tags` — the `trades.mistakes` TEXT column is untouched and remains a freeform notes field.
**Warning signs:** `json_each()` returning zero rows for trades known to have mistake notes.

### Pitfall 2: Foreign Key Cascade Requires foreign_keys PRAGMA
**What goes wrong:** SQLite disables foreign key enforcement by default. ON DELETE CASCADE has no effect without `PRAGMA foreign_keys = ON`.
**Why it happens:** Assumption that FK constraints are always enforced.
**How to avoid:** Non-issue for this codebase — `db.pragma("foreign_keys = ON")` is already in `getDb()`. Verify in testing by: create a mistake type, tag a trade with it, delete the mistake type, then `SELECT * FROM trade_mistake_tags WHERE mistake_id = [deleted_id]` — must return zero rows.
**Warning signs:** Orphaned `trade_mistake_tags` rows after deleting a mistake type.

### Pitfall 3: Ownership Verification on Tag Operations
**What goes wrong:** POST `/api/trades/[id]/mistakes` receives a `trade_id` and `mistake_id`. Without verifying both belong to the requesting user, user A could tag user B's trades with mistake types.
**Why it happens:** Single ownership check on trade but not on mistake type, or vice versa.
**How to avoid:** Two ownership checks per tag operation: `SELECT id FROM trades WHERE id = ? AND user_id = ?` AND `SELECT id FROM mistake_types WHERE id = ? AND user_id = ?`. Both must succeed before inserting into `trade_mistake_tags`.
**Warning signs:** Users can tag trades not belonging to them.

### Pitfall 4: Next.js 15 params Must Be Awaited
**What goes wrong:** `params.id` in dynamic route handlers returns undefined because `params` is now a Promise in Next.js 15.
**Why it happens:** Existing code in other frameworks expects `params` to be a plain object.
**How to avoid:** Always `const { id } = await params;` as shown in the existing `app/api/trades/[id]/route.ts` line 9.
**Warning signs:** `id` is `undefined` in route handlers; TypeScript type error on `params.id`.

### Pitfall 5: Date Filter Applies to exit_date, Not entry_date
**What goes wrong:** Filtering by date on `entry_date` excludes open trades with no exit date and produces unexpected results for the trades page date range filter.
**Why it happens:** Ambiguity between trade entry and exit date for filtering purposes.
**How to avoid:** Apply date filters to `exit_date` for the `GET /api/trades` route (`exit_date >= ?` / `exit_date <= ?`). This matches the success criteria: "GET /api/trades?date_from=X&date_to=Y returns only trades within that range." Open trades (no exit_date) will naturally be excluded from date-filtered results, which is the correct behavior for the trades page.
**Warning signs:** Open trades appearing in date-filtered results when they shouldn't.

---

## Code Examples

Verified patterns from codebase source:

### Query Builder Pattern (existing, from app/api/trades/route.ts lines 35-44)
```typescript
let query = "SELECT * FROM trades WHERE user_id = ?";
const params: unknown[] = [user.id];

const accountId = searchParams.get("account_id");
if (accountId) { query += " AND account_id = ?"; params.push(accountId); }
if (status)    { query += " AND status = ?";      params.push(status); }
// ... additional params follow same pattern ...
query += " ORDER BY created_at DESC";
return NextResponse.json(db.prepare(query).all(...params));
```

### hasMigration / markMigration (existing, from lib/db.ts lines 77-84)
```typescript
function hasMigration(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(name);
  return !!row;
}
function markMigration(db: Database.Database, name: string) {
  db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run(name);
}
```

### SQLITE_CONSTRAINT error handling (pattern from existing routes)
```typescript
} catch (e: unknown) {
  if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
    return NextResponse.json({ error: "A mistake type with this name already exists." }, { status: 409 });
  }
  console.error("mistakes API error:", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params.id` direct access | `const { id } = await params` | Next.js 15 | All dynamic route handlers must await params |
| `trades.mistakes` TEXT for structured tagging | `trade_mistake_tags` junction table | Phase 18 | FK cascade, indexable, filterable |

**Deprecated/outdated for this phase:**
- `trades.mistakes` column for structured mistake data: remains as freeform notes field, not used for tagging

---

## Open Questions

1. **trades.mistakes column format in production**
   - What we know: Migration 013 added the column as TEXT; TradeModal stores "reflection" notes there (CLAUDE.md); the column is listed as `mistakes?: string | null` in `lib/types.ts`
   - What's unclear: Whether any user has data in this column that might affect migration design
   - Recommendation: Run the audit query `SELECT mistakes FROM trades WHERE mistakes IS NOT NULL LIMIT 20` as Step 1 before writing any code. If rows exist, surface them to the user with a note that the new tagging system does not touch this column. This is a required pre-condition per STATE.md.

2. **Guest mode for /api/mistakes**
   - What we know: All other routes return demo data or 403 for guests; `isGuest()` check is the first line of every handler
   - What's unclear: Whether guests should see an empty array (GET) or 403 (all verbs)
   - Recommendation: GET returns `[]` (empty array, not 403) to allow the UI to render without errors in guest mode; POST/PUT/DELETE return 403 with "Guests cannot manage mistake types."

---

## Validation Architecture

> `nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is skipped per configuration.

---

## Pre-condition Checklist (Required Before Coding)

Per STATE.md "Accumulated Context — Decisions":
- [ ] Run `SELECT mistakes FROM trades WHERE mistakes IS NOT NULL LIMIT 20` against the development database
- [ ] If non-null rows exist: surface to user and confirm the new system leaves `trades.mistakes` untouched
- [ ] If all rows are NULL: proceed directly with migrations 023 and 024

---

## File Change Map

| File | Change | Notes |
|------|--------|-------|
| `lib/db.ts` | Append migrations 023 and 024 to `runMigrations()` | After the final `}` of migration 022 block, before the closing `}` of `runMigrations` |
| `lib/types.ts` | Add `MistakeType`, `SavedView`, `TradeFilterState`, `DEFAULT_FILTER` | Append to end of file |
| `app/api/mistakes/route.ts` | NEW — GET + POST | New file, new directory |
| `app/api/mistakes/[id]/route.ts` | NEW — PUT + DELETE | New file, new subdirectory |
| `app/api/trades/[id]/mistakes/route.ts` | NEW — POST + DELETE | New file in existing `[id]` directory |
| `app/api/trades/route.ts` | MODIFY — add `date_from`/`date_to` to GET query builder | Guest branch also needs the date filter |

**Untouched:** All other files. `TradeModal`, `TradeTable`, `DashboardShell`, auth, middleware — none modified in Phase 18.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `lib/db.ts` (full read, migrations 001-022) — exact migration pattern, `hasMigration`/`markMigration`, FK pragma usage
- Codebase: `app/api/trades/route.ts` (full read, 149 lines) — query builder pattern, guest branch structure, param handling
- Codebase: `app/api/trades/[id]/route.ts` (first 60 lines) — Next.js 15 awaited params pattern
- Codebase: `lib/types.ts` (full read) — existing type structure, `Trade.mistakes` field definition
- Codebase: `.planning/STATE.md` — pre-condition audit requirement, known blockers
- Codebase: `.planning/research/ARCHITECTURE.md` — table DDL, API route design, type definitions
- Codebase: `.planning/research/PITFALLS.md` — ownership verification, FK cascade, SQL injection prevention
- Codebase: `.planning/research/SUMMARY.md` — migration numbering, phase scope

### Secondary (MEDIUM confidence)
- SQLite documentation — `ON DELETE CASCADE` behavior, `INSERT OR IGNORE` semantics, FK pragma requirement

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns derived directly from existing codebase files
- Architecture: HIGH — DDL exact from ARCHITECTURE.md; API patterns copied from existing routes
- Pitfalls: HIGH — specific line numbers and column names verified against actual source files

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable — no fast-moving dependencies)
