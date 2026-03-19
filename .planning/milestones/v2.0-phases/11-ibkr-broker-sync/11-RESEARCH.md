# Phase 11: IBKR Broker Sync - Research

**Researched:** 2026-03-18
**Domain:** IBKR Client Portal REST API, Next.js proxy routes, SQLite deduplication
**Confidence:** MEDIUM (API endpoint paths verified via community OpenAPI spec; self-signed cert handling verified via official Next.js GitHub discussions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gateway connection setup**
- URL-only configuration — user enters gateway URL (e.g. `https://localhost:5000`) in Settings > Broker tab
- No credentials stored — user authenticates directly in IBKR Client Portal web UI
- "Test Connection" button pings gateway and fetches available IBKR sub-accounts
- Connection status shown as green/red dot next to URL
- Toast notification when gateway becomes unreachable or session expires (visible app-wide)
- On-demand connectivity checks only — no background polling or heartbeats
- User-togglable SSL verification checkbox in broker settings (IBKR gateway uses self-signed certs by default)

**Trade sync behavior**
- Configurable date range picker: "Last 7 days", "Last 30 days", "Custom" range options
- "Sync Now" button syncs all linked accounts at once
- Detailed results modal after sync: lists each trade as new (new), duplicate/skipped, or error, grouped by account
- Deduplication via `ibkr_exec_id` field on trades table (ON CONFLICT DO NOTHING)
- Import trades with blank journal fields (setup, emotions, notes, strategy) — user fills in later
- Synced trades tagged with source indicator for filtering
- Subtle [IBKR] badge next to trade symbol in trades table to distinguish from manual entries

**Live positions display**
- New dashboard widget card (#25) in DashboardShell — fits existing drag-reorder, hide/show, 3-size pattern
- Manual refresh button on widget header — no auto-polling (consistent with on-demand decision)
- "Last updated X ago" timestamp displayed in widget header
- Essential data per position row: symbol, quantity, unrealized P&L (colored green/red), P&L percentage, direction arrow
- Total unrealized P&L at bottom of widget
- When gateway offline: show last known data with yellow "Gateway offline" banner and stale data timestamp
- When no gateway configured: empty state with "Connect to IBKR in Settings" prompt

**Account mapping**
- 1:1 manual linking: user maps each IBKR account ID to an existing Ledger account via dropdown
- Account discovery: "Test Connection" fetches available IBKR sub-accounts (IDs + types) from gateway API
- Mapping UI shows discovered IBKR accounts with dropdowns to select Ledger account targets
- Support multiple IBKR sub-accounts (e.g., margin + IRA) each linked to different Ledger accounts
- Unlinking removes sync relationship only — previously synced trades stay in the Ledger account
- "[+ Link Another Account]" button for multi-account setups

### Claude's Discretion
- Exact Client Portal API endpoints and request/response handling
- Sync progress indicator during trade fetch
- IBKR field-to-trade-schema mapping details
- Widget sizing defaults (large/medium/compact)
- Date range picker UI implementation
- Error retry logic for failed syncs
- How stale position data is cached (memory vs localStorage)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IBKR-01 | User can configure IBKR Client Portal gateway connection in settings | Settings page "Broker" category, `ibkr_*` settings namespace, gateway URL + SSL toggle |
| IBKR-02 | User can trigger manual trade sync via "Sync Now" button | `/api/broker/ibkr/sync` route calling gateway `GET /iserver/account/trades`, ON CONFLICT deduplication |
| IBKR-03 | Imported trades are deduplicated by IBKR execution ID | Migration 020: `ibkr_exec_id` TEXT UNIQUE on trades, `ON CONFLICT(ibkr_exec_id) DO NOTHING` |
| IBKR-04 | User can view live open positions from IBKR with unrealized P&L | IBKRPositionsWidget (#25) fetching `/api/broker/ibkr/positions` which proxies to `GET /portfolio/{accountId}/positions/0` |
| IBKR-05 | User can see last sync timestamp and success/error status | `ibkr_last_sync` and `ibkr_last_sync_status` settings keys, displayed in Broker tab |
</phase_requirements>

---

## Summary

The IBKR Client Portal REST API is an HTTP-based gateway that runs locally on the trader's machine. The user authenticates manually through a browser UI, and the gateway holds the session. Our app acts as a server-side proxy — Next.js API routes call the local gateway URL, which means no OAuth or credentials are stored. All gateway communication happens server-side only, avoiding CORS entirely.

The two core integration challenges are (1) the self-signed TLS certificate the gateway uses by default, which requires bypassing `rejectUnauthorized` when the user opts in via a settings checkbox, and (2) the `iserver/account/trades` endpoint's limitation that it only returns up to 7 days of history per call. For the "Last 30 days" range, the planner must design multiple sequential fetches (e.g., four 7-day windows) and deduplicate at the DB layer via `ON CONFLICT(ibkr_exec_id) DO NOTHING`.

The positions widget is straightforward: `GET /portfolio/{accountId}/positions/0` returns paginated positions with `unrealizedPnl`, `position` (quantity), `ticker`, and `mktPrice`. Stale data is best cached in React component state (memory only) so no extra DB migration is needed — just track a `lastFetched` timestamp in state.

**Primary recommendation:** Build `lib/ibkr-client.ts` as a thin Node.js `https` fetch wrapper (with optional `rejectUnauthorized: false`) and expose four API routes under `app/api/broker/ibkr/`: `status`, `accounts`, `sync`, `positions`. Keep all gateway calls server-side.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `https` | Node 20 | TLS-aware HTTP client for gateway calls | Built-in, no deps; needed for `rejectUnauthorized` control via `https.Agent` |
| `better-sqlite3` | already installed | ON CONFLICT deduplication insert | Already the project DB; SQLite `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` |
| Next.js App Router API routes | 15 (already installed) | Server-side proxy to gateway | Already the pattern for all API routes in this project |
| `clsx` | already installed | Conditional className for badge/widget states | Project standard |
| `lucide-react` | already installed | `RefreshCw`, `Wifi`, `WifiOff`, `AlertTriangle` icons for widget UI | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `undici` (Node built-in dispatcher) | Node 20 built-in | Alternative to `https.Agent` for `fetch` with custom TLS | If using native `fetch` instead of `https.request`; undici `Agent` supports `connect: { rejectUnauthorized: false }` |
| `fast-xml-parser` | listed in STATE.md as "maybe skippable" | Parsing XML responses | Only needed if IBKR returns XML for flex queries; Client Portal REST returns JSON — skip |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `https` module | `axios` or `node-fetch` | Axios adds a dependency for no meaningful gain; native `https`/`fetch` sufficient |
| Memory-only position cache | localStorage | localStorage not available server-side; component state (React `useState`) is simpler and sufficient for per-session caching |
| Sequential multi-window fetches | Single `iserver/account/trades` call | Gateway caps at 7 days per call; must use sequential windows for 30-day range |

**Installation:** No new packages required. Native Node.js `https` module handles the self-signed cert case. `fast-xml-parser` is NOT needed.

---

## Architecture Patterns

### Recommended Project Structure

```
app/api/broker/ibkr/
├── status/route.ts          # GET — ping gateway, fetch sub-accounts list
├── accounts/route.ts        # GET — return discovered IBKR sub-accounts
├── sync/route.ts            # POST — fetch trades, insert with deduplication
└── positions/route.ts       # GET — fetch live positions for mapped accounts

lib/
└── ibkr-client.ts           # Gateway HTTP wrapper (rejectUnauthorized toggle)

components/dashboard/
└── IBKRPositionsWidget.tsx  # Widget #25 — positions table with refresh

app/settings/page.tsx        # Add "broker" to CATEGORIES, add BrokerTab section
```

### Pattern 1: Server-Side Gateway Proxy with TLS Toggle

**What:** Next.js API route reads `ibkr_gateway_url` and `ibkr_ssl_verify` from settings, instantiates an `https.Agent` with the appropriate `rejectUnauthorized` value, and proxies the request to the local IBKR gateway.

**When to use:** Every gateway call. Never expose gateway URL to client-side code.

```typescript
// lib/ibkr-client.ts
// Source: Node.js https docs + Next.js GitHub discussion #74187 (rejectUnauthorized pattern)
import https from "https";

export function makeIbkrAgent(sslVerify: boolean): https.Agent {
  return new https.Agent({ rejectUnauthorized: sslVerify });
}

export async function ibkrFetch(
  gatewayUrl: string,
  path: string,
  sslVerify: boolean,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${gatewayUrl}/v1/api${path}`;
  // Node 18+ fetch with undici dispatcher for custom agent
  // OR use node-fetch / https.request for older patterns
  const agent = makeIbkrAgent(sslVerify);
  return fetch(url, {
    ...options,
    // @ts-expect-error — Next.js 15 on Node 20 accepts agent in server context
    agent,
  });
}
```

**Critical note:** In Next.js App Router on Node 20, the built-in `fetch` uses undici. Passing an `https.Agent` directly does not work with undici — you must use undici's own `Agent` with a `connect` option, or fall back to `node:https` + `http.request`. The safest approach in this project is to use Node's `https.request` wrapped in a Promise for server-side proxy calls.

```typescript
// Correct pattern for undici-based fetch (Next.js 15 / Node 20):
import { Agent } from "undici";

export function ibkrFetch(gatewayUrl: string, path: string, sslVerify: boolean) {
  const dispatcher = new Agent({ connect: { rejectUnauthorized: sslVerify } });
  return fetch(`${gatewayUrl}/v1/api${path}`, {
    // @ts-expect-error dispatcher is undici-specific
    dispatcher,
  });
}
```

### Pattern 2: Deduplication via UNIQUE Constraint + ON CONFLICT

**What:** Migration 020 adds `ibkr_exec_id TEXT UNIQUE` to the trades table. The sync route uses `INSERT OR IGNORE` (SQLite) so duplicate execution IDs are silently skipped.

**When to use:** Every trade insert during sync.

```typescript
// In sync route, for each IBKR execution:
const stmt = db.prepare(`
  INSERT OR IGNORE INTO trades
    (user_id, account_id, symbol, direction, status, entry_price, shares,
     entry_date, commission, ibkr_exec_id, source)
  VALUES (?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, 'ibkr')
`);
// Returns: stmt.run(...).changes === 0 means duplicate (skipped)
const result = stmt.run(userId, accountId, symbol, direction, price, qty, date, commission, execId);
const status = result.changes === 0 ? "duplicate" : "inserted";
```

The results modal uses this status to show the new/duplicate/error breakdown per account.

### Pattern 3: Dashboard Widget #25 Following Existing Widget Pattern

**What:** Add `{ id: "ibkr-positions", title: "IBKR Live Positions" }` to `ALL_WIDGETS` array in `DashboardShell.tsx`. Default to hidden (added to the hidden-by-default list at the bottom of `DEFAULT_ORDER`). Widget renders `IBKRPositionsWidget` component with the 3-size mode pattern.

**When to use:** Widget is hidden by default because it requires gateway configuration. User enables it in edit mode once IBKR is set up.

```typescript
// In DashboardShell.tsx — add to ALL_WIDGETS:
{ id: "ibkr-positions", title: "IBKR Live Positions" },

// In DEFAULT_ORDER — append to the hidden list:
"dist-weekday", "dist-hour", "dist-month", "strategy-perf", "risk-simulator",
"ai-insights", "perf-hour", "ibkr-positions",  // <-- add here

// In widget render block (the big switch/if chain):
} else if (wid === "ibkr-positions") {
  content = <IBKRPositionsWidget size={size} />;
}
```

### Pattern 4: Settings Persistence for IBKR Config

**What:** Use existing `/api/settings` PUT endpoint with `ibkr_*` keys. All IBKR config is stored as JSON strings per user, following the established pattern.

```typescript
// Settings keys for IBKR:
// ibkr_gateway_url       — string, e.g. "https://localhost:5000"
// ibkr_ssl_verify        — "true" | "false"
// ibkr_account_mappings  — JSON: { ibkrAccountId: ledgerAccountId }[]
// ibkr_last_sync         — ISO timestamp string
// ibkr_last_sync_status  — "success" | "error: <message>"
```

### Pattern 5: Broker Settings Tab

**What:** Add `"broker"` category to the `CATEGORIES` array in `app/settings/page.tsx`. Render the full Broker section inline in the existing tabbed settings layout.

```typescript
// In CATEGORIES array:
{ id: "broker", label: "Broker", icon: Cable },
// Cable icon from lucide-react (represents connection)

// Category type must be updated:
type Category = "account" | "accounts" | ... | "broker" | "admin-users" | "admin-settings";
```

### Anti-Patterns to Avoid

- **Calling gateway from client-side:** IBKR gateway runs locally, often `https://localhost:5000`. Calling it from the browser would expose the URL in network tabs and violate Next.js App Router conventions. All calls must go through `/api/broker/ibkr/*` server-side routes.
- **Setting `NODE_TLS_REJECT_UNAUTHORIZED=0`:** This disables TLS validation globally for the entire Node process, not just IBKR calls. Use per-request `Agent` with `rejectUnauthorized: false` instead.
- **Using `iserver/account/trades` with days > 7:** The endpoint caps at 7 days. For 30-day syncs, make multiple sequential calls with different offsets (or use available date windows).
- **Storing gateway session cookie client-side:** The IBKR gateway session is managed by the gateway itself; we don't handle auth cookies. The `ibkrFetch` function should forward any cookies received from the gateway back through the proxy to maintain stateful session.
- **Blocking the sync on duplicate trade detection:** Use `INSERT OR IGNORE` at the DB layer, not JS-level pre-checks. Pre-checks require an extra SELECT per trade and race conditions in concurrent syncs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificate bypass per-request | Custom cert bypass logic | `undici.Agent({ connect: { rejectUnauthorized: false } })` | Node 20's fetch (undici) already supports this cleanly per-request |
| Trade deduplication logic | JS-level duplicate check (SELECT then INSERT) | SQLite `INSERT OR IGNORE` with UNIQUE constraint | Race-condition-safe, zero extra queries, single migration |
| IBKR API session management | Cookie jar, session keep-alive | None needed — gateway handles its own session; proxy just forwards |
| Date range windowing for > 7 days | Complex date math | Simple loop: `for pageStart in [0, 7, 14, 21]: fetch(days=7, offset=pageStart)` | IBKR API limitation; straightforward loop is the right pattern |
| Position data caching | DB table for positions | React `useState` with `lastFetched` timestamp | Positions are ephemeral/live; storing in DB adds stale-data complexity with no benefit |

**Key insight:** The gateway does the hard work (auth, market data, execution matching). Our job is a thin proxy plus a good dedup insert — both are 5–10 lines of code each.

---

## Common Pitfalls

### Pitfall 1: Self-Signed Certificate Error Breaks All Gateway Calls

**What goes wrong:** `fetch()` in Node 20 (undici) throws `DEPTH_ZERO_SELF_SIGNED_CERT` when calling the IBKR gateway because the gateway ships with a self-signed TLS certificate.

**Why it happens:** IBKR does not bundle a CA-signed certificate with the Client Portal Gateway. Browsers show a warning; Node.js `fetch` (undici) throws by default.

**How to avoid:** Use undici's `Agent` with `connect: { rejectUnauthorized: false }` when `ibkr_ssl_verify` setting is `false`. Only pass this agent when the user has explicitly toggled "Allow self-signed certificates" in Broker settings. Default the setting to `false` (allow self-signed) since nearly all users will run the gateway locally.

**Warning signs:** `TypeError: fetch failed` with cause `Error: self signed certificate` in Next.js server logs.

### Pitfall 2: iserver/account/trades Returns Only Today's Data by Default

**What goes wrong:** Calling `GET /v1/api/iserver/account/trades` without a `days` parameter returns only today's trades. "Last 30 days" sync appears to work but imports very little data.

**Why it happens:** The `days` parameter defaults to 1 and is capped at 7 per call. There is no native 30-day single-call option.

**How to avoid:** For "Last 7 days" use `days=7`. For "Last 30 days", make 4-5 sequential calls with `days=7` and shift the effective window using available date filtering. Alternatively, iterate: call with `days=7`, note the oldest trade returned, call again with `days=7&fromDate=...` or use a different window approach depending on what the API supports. Given the API limitation, the "Last 30 days" option may return up to 35 days of data (5 x 7-day windows) to cover the full range — this is acceptable.

**Warning signs:** Users report "only today's trades synced" when clicking "Last 30 days".

### Pitfall 3: iserver Endpoints Require Prior /iserver/accounts Call

**What goes wrong:** `GET /iserver/account/trades` returns a 401/session error even though the gateway is authenticated and `/portfolio/accounts` works fine.

**Why it happens:** IBKR documentation notes that brokerage endpoints (`/iserver/*`) require a brokerage session to be established by calling `GET /iserver/accounts` first. Portfolio endpoints work without this step, but iserver endpoints do not.

**How to avoid:** In `ibkr-client.ts`, always call `GET /v1/api/iserver/accounts` before any `iserver/account/trades` or `iserver/account/orders` calls. Cache the accounts response for the duration of the sync operation (in-memory, not across requests).

**Warning signs:** Positions (portfolio endpoint) work but trade sync returns 401 or empty results.

### Pitfall 4: Trade Direction Mapping from IBKR "side" Field

**What goes wrong:** IBKR returns `"side": "B"` for buy and `"side": "S"` for sell, but also `"BOT"` (bought) and `"SLD"` (sold) in some responses. Mapping only `"B"` → `"long"` misses `"BOT"` executions.

**Why it happens:** IBKR uses different side codes for different asset types and API versions.

**How to avoid:**
```typescript
function mapSide(side: string): "long" | "short" {
  const normalized = side?.toUpperCase() ?? "";
  if (["B", "BOT", "BUY"].includes(normalized)) return "long";
  if (["S", "SLD", "SELL"].includes(normalized)) return "short";
  return "long"; // safe default, flag as needing review
}
```

**Warning signs:** Short trades appear as long in the imported list.

### Pitfall 5: IBKR Positions Endpoint is Paginated

**What goes wrong:** `GET /portfolio/{accountId}/positions/0` returns only the first page of positions. Users with large portfolios see incomplete data in the widget.

**Why it happens:** The endpoint path includes a `pageId` (0-indexed). When there are more positions than fit on one page, subsequent pages must be fetched.

**How to avoid:** After fetching page 0, check if the response array has the maximum page size (typically 30 items). If so, fetch page 1, 2, etc. until an empty or partial page is returned. For most retail traders (< 30 open positions), page 0 is sufficient — implement pagination as a hardened fallback.

**Warning signs:** Position count in widget is exactly 30 (max page size) but user has more positions.

### Pitfall 6: Sync Results Modal Must Handle Partial Failures Gracefully

**What goes wrong:** If one IBKR account's sync fails (e.g., account mapping is stale), the whole sync crashes before processing other accounts.

**Why it happens:** Sequential account processing with no error isolation.

**How to avoid:** Wrap each account's sync in try/catch. Collect results as `{ accountId, status: "success"|"error", message?, newCount, dupCount }[]`. Always return the full results array even if some entries are errors. The modal shows mixed results: some accounts green, some red.

---

## Code Examples

Verified patterns from project codebase and official sources:

### IBKR Gateway Proxy (Server Route Pattern)

```typescript
// app/api/broker/ibkr/status/route.ts
// Source: existing API routes in this project (app/api/ai/analyze/route.ts pattern)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { ibkrFetch } from "@/lib/ibkr-client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || isGuest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const gwRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'ibkr_gateway_url'").get(user.id) as { value: string } | undefined;
  const sslRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'ibkr_ssl_verify'").get(user.id) as { value: string } | undefined;

  const gatewayUrl = gwRow?.value ?? "";
  const sslVerify = (sslRow?.value ?? "false") === "true";

  if (!gatewayUrl) return NextResponse.json({ connected: false, error: "No gateway URL configured" });

  try {
    const res = await ibkrFetch(gatewayUrl, "/iserver/accounts", sslVerify);
    if (!res.ok) return NextResponse.json({ connected: false, error: `Gateway returned ${res.status}` });
    const data = await res.json();
    return NextResponse.json({ connected: true, accounts: data.accounts ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ connected: false, error: message });
  }
}
```

### Deduplication Insert

```typescript
// In sync route, per execution:
// Source: SQLite INSERT OR IGNORE docs + existing db.ts pattern
const insertTrade = db.prepare(`
  INSERT OR IGNORE INTO trades
    (user_id, account_id, symbol, direction, status,
     entry_price, shares, entry_date, commission, ibkr_exec_id, source,
     created_at)
  VALUES (?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, 'ibkr', datetime('now'))
`);

let newCount = 0, dupCount = 0, errCount = 0;
for (const exec of executions) {
  try {
    const r = insertTrade.run(
      userId, accountId, exec.symbol, mapSide(exec.side),
      exec.price, Math.abs(exec.size), exec.trade_time,
      exec.commission ?? 0, exec.execution_id
    );
    if (r.changes > 0) newCount++; else dupCount++;
  } catch {
    errCount++;
  }
}
```

### DB Migrations 020 and 021

```typescript
// In lib/db.ts runMigrations():

// ── 020: ibkr_exec_id + source on trades ─────────────────────────────
if (!hasMigration(db, "020_ibkr_exec_id")) {
  const tradeCols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
  if (!tradeCols.includes("ibkr_exec_id")) {
    db.exec(`ALTER TABLE trades ADD COLUMN ibkr_exec_id TEXT;`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_ibkr_exec_id ON trades(ibkr_exec_id) WHERE ibkr_exec_id IS NOT NULL;`);
  }
  if (!tradeCols.includes("source")) {
    db.exec(`ALTER TABLE trades ADD COLUMN source TEXT;`); // 'manual' | 'ibkr'
  }
  markMigration(db, "020_ibkr_exec_id");
}

// ── 021: IBKR settings defaults ───────────────────────────────────────
if (!hasMigration(db, "021_ibkr_settings")) {
  // No system defaults needed — ibkr_* settings are per-user only
  markMigration(db, "021_ibkr_settings");
}
```

Note: The UNIQUE INDEX uses a partial index (`WHERE ibkr_exec_id IS NOT NULL`) so that the many manual trades with NULL `ibkr_exec_id` do not conflict with each other.

### IBKR Field-to-Trade Mapping

```typescript
// Source: Community OpenAPI spec gist + lib/broker-parsers.ts field names reference

interface IbkrExecution {
  execution_id: string;   // unique exec identifier — maps to ibkr_exec_id
  symbol: string;          // e.g. "AAPL"
  side: string;            // "B" | "BOT" | "S" | "SLD"
  size: number;            // shares/contracts (signed: positive=buy, negative=sell)
  price: number;           // execution price
  trade_time: string;      // ISO-like timestamp
  commission: number;      // commission paid
  account: string;         // IBKR account ID
  exchange: string;        // execution venue
  net_amount: number;      // net $ value of execution
}

interface IbkrPosition {
  ticker: string;          // symbol — maps to symbol
  position: number;        // quantity (positive=long, negative=short)
  unrealizedPnl: number;   // unrealized P&L in account currency
  realizedPnl: number;
  mktPrice: number;        // current mark price
  mktValue: number;        // position market value
  currency: string;        // e.g. "USD"
  avgPrice: number;        // average cost basis
  conid: number;           // IBKR contract ID
}
```

### IBKRPositionsWidget Shell (3-size pattern)

```typescript
// components/dashboard/IBKRPositionsWidget.tsx
// Source: existing widget pattern in DashboardShell.tsx (AIInsightsWidget reference)
"use client";
import { useState, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface Props { size: "large" | "medium" | "compact" }

export default function IBKRPositionsWidget({ size }: Props) {
  const [positions, setPositions] = useState<IbkrPosition[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayOffline, setGatewayOffline] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/broker/ibkr/positions");
      const data = await res.json();
      if (!res.ok) {
        setGatewayOffline(true);
        setError(data.error ?? "Gateway unreachable");
      } else {
        setPositions(data.positions);
        setGatewayOffline(false);
        setError(null);
        setLastFetched(new Date());
      }
    } catch {
      setGatewayOffline(true);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Render varies by size — compact shows summary only, large shows full table
  // ...
}
```

---

## IBKR Client Portal API Reference

### Key Endpoints

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `GET /v1/api/iserver/accounts` | GET | List brokerage accounts; required before iserver calls | Rate: 1 req/5s |
| `GET /v1/api/iserver/account/trades` | GET | Recent trade executions | `?days=N` (max 7); returns `execution_id`, `symbol`, `side`, `size`, `price`, `trade_time`, `commission`, `account` |
| `GET /v1/api/portfolio/accounts` | GET | List portfolio accounts | Works without brokerage session |
| `GET /v1/api/portfolio/subaccounts` | GET | List sub-accounts (FA/advisor accounts) | Up to 100 sub-accounts |
| `GET /v1/api/portfolio/{accountId}/positions/{pageId}` | GET | Live positions paginated | `pageId` is 0-indexed; response includes `ticker`, `position`, `unrealizedPnl`, `mktPrice`, `avgPrice` |
| `GET /v1/api/portfolio/{accountId}/summary` | GET | Account summary (cash, NLV) | Includes `netliquidationvalue`, `totalcashvalue` |

### Response Field Summary for Trades

```
execution_id  — string, unique execution ID (use as ibkr_exec_id)
symbol        — string, e.g. "AAPL"
side          — string, "B"|"BOT" (buy/long) or "S"|"SLD" (sell/short)
size          — number, shares; may be signed (negative = sell)
price         — number, fill price
trade_time    — string, trade timestamp (format varies; parse robustly)
commission    — number, commission paid
account       — string, IBKR account ID
net_amount    — number, net cash impact
exchange      — string, venue
```

### SSL Certificate Handling

The IBKR Client Portal Gateway ships with a self-signed TLS certificate. Browsers show a warning; Node.js rejects by default. The app must:

1. Let the user toggle "Allow self-signed certificates" in Broker settings (stored as `ibkr_ssl_verify = "false"` meaning skip verification)
2. In `ibkr-client.ts`, read this setting and create an undici `Agent` with `connect: { rejectUnauthorized: false }` when the setting is false
3. Default the setting to `false` (allow self-signed) because 99% of users run the gateway locally

```typescript
// Source: undici docs + Next.js GitHub discussion #74187
import { Agent } from "undici";

export async function ibkrFetch(
  gatewayUrl: string,
  path: string,
  sslVerify: boolean,
  init: RequestInit = {}
): Promise<Response> {
  const dispatcher = sslVerify
    ? undefined  // use default (strict verification)
    : new Agent({ connect: { rejectUnauthorized: false } });

  return fetch(`${gatewayUrl}/v1/api${path}`, {
    ...init,
    ...(dispatcher ? { dispatcher } as Record<string, unknown> : {}),
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TWS socket-based API (requires Java gateway + socket) | Client Portal REST API (HTTP, runs in browser) | 2019+ | Can proxy from any HTTP server; no persistent socket daemon needed |
| OAuth 2.0 for API access | Session-cookie-based via gateway web UI login | Current CP Gateway v1 | User logs in via browser; no OAuth credentials stored in app |
| XML-based Flex Web Service (historical data) | REST JSON endpoints | 2020+ | Clean JSON responses; `fast-xml-parser` not needed |
| Polling for positions | On-demand REST call to `/portfolio/{id}/positions/0` | Current | Fits our on-demand-only architecture |

**Deprecated/outdated:**
- TWS/IB Gateway socket API: Not applicable here — we use Client Portal REST, not TWS socket
- Flex Web Service: XML-based historical data service — not needed; Client Portal REST covers our use case
- `iserver/account/orders` for executed trades: Use `iserver/account/trades` (execution records) not orders (order records); orders without fills are not relevant

---

## Open Questions

1. **Does `iserver/account/trades` support date filtering beyond `days` parameter?**
   - What we know: `days=N` with max 7 is documented. Community mentions a `days` cap.
   - What's unclear: Whether a `fromDate`/`toDate` or `offset` parameter exists in v1.0 to enable non-contiguous ranges.
   - Recommendation: Default to sequential 7-day window fetches for 30-day sync. Verify with a real gateway during implementation. If date filter exists, simplify to a single call.

2. **IBKR rate limit behavior for rapid sequential calls**
   - What we know: 10 req/sec global; iserver endpoints have a 1 req/5s rate limit specifically.
   - What's unclear: Whether multiple 7-day window calls in sequence trigger the 5s rate limit.
   - Recommendation: Add a 1-second delay between sequential window fetches in the sync route to be safe. Total sync time for 30 days = ~5 seconds, which is acceptable.

3. **`iserver/accounts` prerequisite — is it truly required before `iserver/account/trades`?**
   - What we know: IBKR docs state brokerage session required for `iserver` endpoints.
   - What's unclear: Whether calling `/iserver/accounts` at the start of the sync route is sufficient or if a separate session initialization step is needed.
   - Recommendation: Always call `GET /iserver/accounts` first in the sync route. If it fails (401), return `{ error: "Gateway session expired" }` and instruct user to re-authenticate in the IBKR Client Portal browser UI.

---

## Sources

### Primary (HIGH confidence)
- Community OpenAPI spec gist: `https://gist.github.com/theloniusmunch/9b14d320fd1c3aca550fc8d54c446ce0` — exact endpoint paths, response field names for trades and positions
- IBKR Campus Web API v1.0 Documentation: `https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/` — rate limits (10 req/sec, 1 req/5s for iserver), days parameter cap at 7
- Next.js GitHub Discussion #74187: `https://github.com/vercel/next.js/discussions/74187` — undici Agent pattern for self-signed cert bypass in Next.js 15

### Secondary (MEDIUM confidence)
- IBKR Campus Trading Web API: `https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/` — iserver/accounts prerequisite requirement
- EasyIB Python wrapper: `https://github.com/utilmon/EasyIB` — confirmed endpoint paths `portfolio/{accountId}/positions/0`, `iserver/account/trades`
- LittleLittleCloud ibkr_client AccountApi.md: `https://github.com/LittleLittleCloud/ibkr_client/blob/master/docs/AccountApi.md` — confirmed `GET /portfolio/accounts`, `GET /portfolio/subaccounts`, `POST /iserver/account` patterns
- IBKR Campus — Sub-accounts: confirmed `/portfolio/subaccounts` returns up to 100 sub-accounts with accountId

### Tertiary (LOW confidence — verify during implementation)
- Community-reported `iserver/account/trades` response fields (`execution_id`, `trade_time`, `side` codes `B`/`BOT`/`S`/`SLD`) — must validate against real gateway response during implementation; field names may differ slightly between gateway versions
- 7-day cap on `days` parameter — multiple community sources agree; official docs did not render for direct verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; native Node.js + existing project stack
- Architecture: HIGH — proxy pattern well established, dedup via UNIQUE index is SQLite best practice
- IBKR endpoint paths: MEDIUM — verified via community OpenAPI spec and library wrappers; not from official rendered docs (JS-rendered, inaccessible to web fetch)
- Response field names: LOW-MEDIUM — `execution_id`, `side`, `size`, `unrealizedPnl` confirmed via spec gist; exact casing and presence of all fields must be validated against real gateway

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (IBKR API stable; 30-day window is safe)
