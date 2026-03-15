# Architecture Patterns

**Domain:** AI chart analysis, IBKR broker sync, Monte Carlo entry integration, Trading Tools Hub
**Researched:** 2026-03-15
**Confidence:** HIGH (codebase fully read; patterns derived from existing structure)

---

## Recommended Architecture

The four feature groups integrate cleanly into the existing Next.js 15 + SQLite architecture via
three extension points: new API route subtrees, new lib modules, and new page/component subtrees.
No structural changes to the existing foundation are needed.

```
app/
  api/
    ai/
      analyze/route.ts          ← NEW: multipart image upload → cloud vision → pattern tags
      similar/route.ts           ← NEW: vector similarity search over trade embeddings
    broker/
      ibkr/
        status/route.ts          ← NEW: poll TWS Gateway health
        positions/route.ts       ← NEW: live position list from TWS
        import/route.ts          ← NEW: pull executions → normalize → bulk insert
        settings/route.ts        ← NEW: persist IBKR connection config
    simulation/
      preview/route.ts           ← NEW: stateless Monte Carlo preview for entry modal
    tools/                       ← NEW: all calculator endpoints (stateless)
      rr/route.ts
      kelly/route.ts
      compound/route.ts
      drawdown/route.ts
      fibonacci/route.ts
      correlation/route.ts
  tools/page.tsx                 ← NEW: Trading Tools Hub page
lib/
  ai-vision.ts                   ← NEW: OpenAI Vision API client wrapper
  ibkr-client.ts                 ← NEW: TWS Client Portal API wrapper
  calculators.ts                 ← NEW: pure math functions for all six tools
components/
  tools/                         ← NEW: six calculator UI components
  TradeModal.tsx                 ← MODIFY: add Monte Carlo preview panel
  dashboard/
    DashboardShell.tsx           ← MODIFY: add IBKR live positions widget
```

---

## Component Boundaries

### Feature 1: AI Chart Pattern Recognition

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `TradeModal.tsx` (modified) | Screenshot upload UI, pattern tag display | `POST /api/ai/analyze` |
| `app/api/ai/analyze/route.ts` | Accepts multipart upload, calls vision API, returns pattern tags | OpenAI Vision API (external) |
| `app/api/ai/similar/route.ts` | Accepts trade ID, queries trade history for pattern similarity | `lib/db.ts` (reads trades.tags) |
| `lib/ai-vision.ts` | OpenAI API client, base64 encoding, prompt construction, response parsing | `openai` npm package |
| `lib/db.ts` (migration 019) | Adds `screenshot_url` and `ai_patterns` TEXT columns to trades | none |

**Data flow:**
```
User drops screenshot in TradeModal
  → POST /api/ai/analyze (multipart/form-data, max 20MB)
    → lib/ai-vision.ts encodes image, calls OpenAI gpt-4o with structured prompt
      → Returns JSON: { patterns: string[], confidence: number, description: string }
    → API route returns patterns to modal
  → Modal displays patterns as tag chips
  → On save, patterns stored in trades.ai_patterns (JSON string)
```

**Storage decision:** Screenshots are NOT stored server-side. The analysis result (pattern tags + description) is stored in `trades.ai_patterns`. This avoids blob storage complexity, keeps SQLite the single source of truth, and respects the no-stack-change constraint.

**Similar trade finder:**
```
GET /api/ai/similar?trade_id=123
  → reads ai_patterns from trades table for trade 123
  → scans other trades with overlapping pattern tags
  → returns ranked list by pattern overlap score
```
This is pure SQLite — no vector database needed. Pattern tags are stored as JSON arrays; overlap is computed with a simple set-intersection in TypeScript after fetching all user trades. Scales adequately to tens of thousands of trades (single-user SQLite).

---

### Feature 2: IBKR/TWS Live Sync

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `lib/ibkr-client.ts` | HTTP calls to TWS Client Portal API Gateway | Local TWS/Gateway process |
| `app/api/broker/ibkr/status/route.ts` | Health check — is Gateway reachable? | `lib/ibkr-client.ts` |
| `app/api/broker/ibkr/positions/route.ts` | Fetches live open positions | `lib/ibkr-client.ts` |
| `app/api/broker/ibkr/import/route.ts` | Pulls executions, deduplicates, bulk-inserts | `lib/ibkr-client.ts`, `lib/db.ts` |
| `app/api/broker/ibkr/settings/route.ts` | GET/PUT for gateway_url, account_id settings | `lib/db.ts` (settings table) |
| `components/dashboard/IBKRWidget.tsx` | Live positions panel, sync button, connection status | `/api/broker/ibkr/*` |
| `DashboardShell.tsx` (modified) | Adds IBKRWidget to widget list (id: "ibkr-positions") | `IBKRWidget` |

**Architecture constraint:** IBKR's TWS Client Portal API runs as a local process on the trader's machine. The Next.js server routes proxy requests to `http://localhost:5000` (configurable gateway URL stored in settings). This means IBKR sync only works when:
- TWS or IB Gateway is running
- Client Portal API Gateway is authenticated

**Data flow for live positions:**
```
IBKRWidget mounts, polls /api/broker/ibkr/status every 30s
  → if connected: fetch /api/broker/ibkr/positions
    → lib/ibkr-client.ts → GET https://{gateway_url}/v1/api/portfolio/{accountId}/positions/0
      → returns IPosition[] from IBKR
    → API normalizes to { symbol, shares, entry_price, unrealized_pnl, market_value }
  → IBKRWidget renders live positions table
```

**Data flow for auto-import:**
```
User clicks "Import Executions" in IBKRWidget (or Settings tab)
  → POST /api/broker/ibkr/import
    → lib/ibkr-client.ts fetches /v1/api/iserver/account/trades
      → returns execution list for the period
    → Normalize executions → RawBrokerTrade[] (same interface as lib/broker-parsers.ts)
    → Deduplication: check trades table for ibkr_exec_id (new column, migration 020)
    → Bulk insert new trades via existing trades INSERT logic
  → Returns { imported: N, skipped: N }
```

**Deduplication column:** Migration 020 adds `ibkr_exec_id TEXT` to trades. Import queries `SELECT ibkr_exec_id FROM trades WHERE user_id = ?` before inserting, skipping any execution already present. This is idempotent — running import multiple times is safe.

**Settings integration:** IBKR connection config (gateway URL, IBKR account ID) stored in the existing settings table under user-scoped keys `ibkr_gateway_url` and `ibkr_account_id`. Exposed in the Settings page under a new "Broker" tab.

---

### Feature 3: Monte Carlo Entry Integration

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/api/simulation/preview/route.ts` | Stateless endpoint: accepts position params + historical returns, runs simulation, returns preview result | `lib/simulation.ts` |
| `lib/simulation.ts` (unmodified) | Existing `runMonteCarlo` — called directly from the API route | — |
| `components/MonteCarloPreview.tsx` | Compact chart + key metrics panel embedded in TradeModal | `/api/simulation/preview` |
| `TradeModal.tsx` (modified) | Hosts MonteCarloPreview in the "Setup" tab; passes entry_price, stop_loss, shares, accountId | `MonteCarloPreview` |

**Integration point in TradeModal:** The existing Setup tab already shows `RiskCalculator` and `PositionSizer`. Monte Carlo preview slots in below these, triggered when entry_price + stop_loss are populated. It runs with a debounce (500ms) to avoid firing on every keystroke.

**Data flow:**
```
User fills entry_price + stop_loss in TradeModal
  → 500ms debounce fires
  → MonteCarloPreview fetches historical P&L% for active account:
      GET /api/trades?account_id={id}&status=closed
  → Computes returns array = trades.map(t => t.pnl / t.account_size)
  → POST /api/simulation/preview { returns, startingBalance, numTrades: 100 }
    → Server calls runMonteCarlo(returns, balance, 100, 2000)  ← 2000 iter for speed
      → Returns SimulationResult
  → MonteCarloPreview renders compact version:
      probOfRuin (large number), probOfProfit, medianBalance, max drawdown
      Optional: collapsed sparkline of 10 paths
```

**Why server-side instead of client-side:** `runMonteCarlo` with 5000 iterations on the client is fast (< 100ms) and could run client-side. However, routing through a small API endpoint keeps the simulation server-side for consistency with the existing analytics page pattern, and allows caching or future expansion. Use 2000 iterations in the preview (vs 5000 in the full simulator) for sub-50ms response.

**Alternative (simpler):** Import `runMonteCarlo` directly into the client component — it's pure TypeScript with no Node.js dependencies. This eliminates the API round-trip entirely. Recommended if the API route adds latency.

---

### Feature 4: Trading Tools Hub

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/tools/page.tsx` | Hub shell: tab navigation, responsive layout | `components/tools/*` |
| `lib/calculators.ts` | Pure math: all six calculators, no side effects | Called from client components |
| `components/tools/RRVisualizer.tsx` | Entry/stop/target inputs, visual chart of trade zones | `lib/calculators.ts` |
| `components/tools/KellyCriterion.tsx` | Win rate + R:R inputs → Kelly % output | `lib/calculators.ts` |
| `components/tools/CompoundGrowth.tsx` | Starting balance, monthly %, years → growth table/chart | `lib/calculators.ts` |
| `components/tools/DrawdownRecovery.tsx` | Drawdown % → required recovery % calculator | `lib/calculators.ts` |
| `components/tools/FibonacciCalc.tsx` | High/low inputs → fib levels table | `lib/calculators.ts` |
| `components/tools/CorrelationMatrix.tsx` | Symbol list → fetches OHLCV → correlation heatmap | `/api/ohlcv` (existing) |
| `app/api/tools/correlation/route.ts` | Accepts symbols[], fetches OHLCV for each, computes matrix | `/api/ohlcv` (existing) or direct Yahoo fetch |

**All calculators except CorrelationMatrix are purely client-side math.** No API calls needed. `lib/calculators.ts` exports named pure functions, each called directly from the tool component. This ensures instant response per the "calculators must be instant" constraint.

**Correlation Matrix is the only networked calculator.** It calls the existing `/api/ohlcv` endpoint (which wraps Yahoo Finance) to fetch daily closes for each symbol, then computes pairwise Pearson correlation in TypeScript. This is the only tool with a loading state.

**Navigation:** Add `tools` to the sidebar nav in `components/Navbar.tsx`. Tools page lives at `/tools` — distinct from `/analytics` which holds the risk simulator and AI insights.

**State persistence:** Each tool's inputs persist in `localStorage` (not server settings). Tools are ephemeral calculators; persisting to the settings API would add unnecessary latency and DB writes.

---

## Data Flow Changes (System-Wide)

### New Database Columns (Migrations)

| Migration | Table | Columns Added | Purpose |
|-----------|-------|---------------|---------|
| 019 | trades | `ai_patterns TEXT`, `screenshot_analyzed_at TEXT` | Store AI analysis results |
| 020 | trades | `ibkr_exec_id TEXT UNIQUE` | Deduplication key for IBKR imports |
| 021 | settings | n/a — new keys only | `ibkr_gateway_url`, `ibkr_account_id` |

### New Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | AI pattern recognition (OpenAI Vision) | Only if AI feature enabled |
| `IBKR_GATEWAY_URL` | Default TWS Gateway URL (user can override in settings) | Optional default |

### New npm Dependencies

| Package | Purpose | Type |
|---------|---------|------|
| `openai` | OpenAI Vision API client | runtime |
| (none for IBKR) | IBKR uses REST — native fetch is sufficient | — |
| (none for calculators) | Pure math — no library needed | — |
| (none for Monte Carlo) | lib/simulation.ts already exists | — |

`openai` must be added to `serverExternalPackages` in `next.config.ts` if it uses Node.js internals (unlikely — it's isomorphic, but verify during build).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Screenshots as Blobs in SQLite
**What:** Saving the raw image bytes in a BLOB column or file system for later re-analysis.
**Why bad:** SQLite is not optimized for binary large objects; images can be megabytes each; the database grows unboundedly; Docker standalone output gets bloated.
**Instead:** Analyze on upload, store only the structured result (pattern tags JSON string). If the user wants to re-analyze, they re-upload the image.

### Anti-Pattern 2: Polling IBKR Gateway from the Client
**What:** Making the browser call the local TWS Gateway API directly from JavaScript.
**Why bad:** CORS blocks it (TWS Gateway runs on localhost:5000 with its own CORS policy); exposes gateway directly; breaks in hosted deployments.
**Instead:** All IBKR calls go server-to-server via `/api/broker/ibkr/*`. The Next.js server is the proxy.

### Anti-Pattern 3: Running Full 5000-Iteration Monte Carlo in TradeModal Preview
**What:** Using the same parameters as the analytics page simulator in the entry modal.
**Why bad:** Each keystroke in the price fields would trigger a 5000-iteration run; even at ~50ms it creates perceived jitter.
**Instead:** Use 2000 iterations for the preview with a 500ms debounce. Full simulation remains on `/analytics`.

### Anti-Pattern 4: API Routes for Pure-Math Calculators
**What:** Routing R:R, Kelly, Fibonacci, Compound, Drawdown through API endpoints.
**Why bad:** Adds HTTP round-trip (50-200ms) to operations that complete in < 1ms; unnecessary server load; breaks "calculators must be instant" constraint.
**Instead:** Export pure functions from `lib/calculators.ts`, import directly into client components.

### Anti-Pattern 5: Separate Vector Database for Similar Trade Matching
**What:** Adding Pinecone, Weaviate, or similar for semantic embedding search.
**Why bad:** Violates the no-stack-change constraint; massive operational overhead for a solo-trader app; overkill when pattern tags are discrete strings, not semantic embeddings.
**Instead:** Tag-intersection scoring on existing SQLite data. Fetch all user trades (capped at a few thousand), compute overlap in TypeScript, sort and return top N.

---

## Scalability Considerations

These are single-user SQLite applications. Scalability concerns are about feature performance, not multi-tenant load.

| Concern | Current State | With New Features |
|---------|--------------|-------------------|
| SQLite read performance | Excellent (indexed) | AI similar-trade scan over 10K trades: ~5ms |
| OpenAI API latency | n/a | 2-8 seconds per image analysis — show loading state |
| IBKR Gateway availability | n/a | Non-blocking: widget shows "disconnected" gracefully |
| Monte Carlo preview speed | n/a | 2000 iterations in ~20ms client-side, ~30ms server-side |
| Correlation matrix fetch | n/a | Fetching 10 symbols × 252 days: 2-4 API calls, ~1-2s |

---

## Build Order (Dependencies)

The feature groups are largely independent, but within each group there are ordering constraints:

### Phase 1: Trading Tools Hub (no dependencies, delivers value immediately)
Build first because: zero external dependencies, no new DB migrations, self-contained. Validates the `/tools` page pattern and `lib/calculators.ts` module before more complex features.
1. `lib/calculators.ts` — pure math functions
2. `app/tools/page.tsx` + tab shell
3. Five pure calculators (`RRVisualizer`, `Kelly`, `CompoundGrowth`, `DrawdownRecovery`, `Fibonacci`)
4. Navbar update (`/tools` link)
5. `CorrelationMatrix` (uses existing `/api/ohlcv`)

### Phase 2: Monte Carlo Entry Integration (depends on existing simulation.ts)
Build second because: reuses `lib/simulation.ts` unchanged, modifies only `TradeModal.tsx`. Low risk.
1. `MonteCarloPreview.tsx` component (standalone, testable)
2. Optional: `app/api/simulation/preview/route.ts` (or skip — call `runMonteCarlo` client-side)
3. TradeModal modification: add MonteCarloPreview to Setup tab

### Phase 3: AI Chart Pattern Recognition (depends on external API key)
Build third because: requires `OPENAI_API_KEY` environment setup, DB migration 019, and multipart upload handling.
1. Migration 019 (add `ai_patterns`, `screenshot_analyzed_at` to trades)
2. `lib/ai-vision.ts` — OpenAI client wrapper
3. `app/api/ai/analyze/route.ts` — upload handler
4. Screenshot upload UI in `TradeModal.tsx`
5. `app/api/ai/similar/route.ts` — similarity search
6. Similar trades display (TradeModal or journal card)

### Phase 4: IBKR/TWS Broker Sync (most complex, external process dependency)
Build last because: requires TWS running locally, IBKR authentication, DB migrations 020-021, and a new Settings tab. Most moving parts; isolated from other features.
1. Migrations 020 (ibkr_exec_id) + settings keys 021
2. `lib/ibkr-client.ts` — REST wrapper for Client Portal API
3. `app/api/broker/ibkr/status/route.ts` — connectivity probe
4. `app/api/broker/ibkr/positions/route.ts`
5. `app/api/broker/ibkr/import/route.ts`
6. `components/dashboard/IBKRWidget.tsx` — live positions panel
7. Settings page: new "Broker" tab for IBKR config
8. DashboardShell: add IBKRWidget to widget list

---

## Patterns to Follow

### Pattern 1: Stateless API Route for Compute-Heavy Operations
**What:** POST endpoint accepts all needed data, runs computation, returns result — no DB reads inside.
**When:** Monte Carlo preview, AI analysis result parsing.
```typescript
// app/api/simulation/preview/route.ts
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { returns, startingBalance, numTrades } = await req.json();
  const result = runMonteCarlo(returns, startingBalance, numTrades, 2000);
  return NextResponse.json(result);
}
```

### Pattern 2: Settings Table for External Service Config
**What:** Use the existing `settings` table (user-scoped) for all external service configuration.
**When:** IBKR gateway URL, OpenAI model selection, any future broker configs.
```typescript
// Persist: PUT /api/settings with { ibkr_gateway_url: "https://localhost:5000" }
// Retrieve: GET /api/settings → settings.ibkr_gateway_url
```
This avoids introducing new config mechanisms and gets user-scoped isolation for free.

### Pattern 3: Inline Migration for Schema Changes
**What:** All schema changes go in `lib/db.ts` `runMigrations()` as numbered blocks.
**When:** Every new column or table in v2.0.
```typescript
if (!hasMigration(db, "019_ai_patterns")) {
  const cols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
  if (!cols.includes("ai_patterns")) {
    db.exec(`ALTER TABLE trades ADD COLUMN ai_patterns TEXT;`);
  }
  if (!cols.includes("screenshot_analyzed_at")) {
    db.exec(`ALTER TABLE trades ADD COLUMN screenshot_analyzed_at TEXT;`);
  }
  markMigration(db, "019_ai_patterns");
}
```

### Pattern 4: Proxy Pattern for Local Service Access
**What:** Browser → Next.js API route → local service (TWS Gateway). Never browser → local service.
**When:** IBKR Client Portal API, any local agent/bridge.
```typescript
// app/api/broker/ibkr/positions/route.ts
const gatewayUrl = await getIbkrGatewaySetting(user.id);
const res = await fetch(`${gatewayUrl}/v1/api/portfolio/${accountId}/positions/0`, {
  headers: { "Content-Type": "application/json" },
});
const positions = await res.json();
return NextResponse.json(positions);
```

### Pattern 5: Pure Function Library for Calculators
**What:** All calculator math in `lib/calculators.ts` as named exports, no React, no side effects.
**When:** All six Trading Tools Hub calculators.
```typescript
// lib/calculators.ts
export function kelly(winRate: number, avgWin: number, avgLoss: number): number {
  return (winRate / avgLoss) - ((1 - winRate) / avgWin);
}
export function fibonacciLevels(high: number, low: number): number[] {
  const diff = high - low;
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0].map(r => high - diff * r);
}
// etc.
```

---

## Integration Touchpoints Summary

| Existing File | Change Type | What Changes |
|---------------|-------------|--------------|
| `lib/db.ts` | MODIFY | Add migrations 019, 020, 021 |
| `lib/types.ts` | MODIFY | Add `ai_patterns`, `screenshot_analyzed_at`, `ibkr_exec_id` to Trade interface |
| `components/TradeModal.tsx` | MODIFY | Add screenshot upload + AI patterns display; add MonteCarloPreview panel |
| `components/dashboard/DashboardShell.tsx` | MODIFY | Add IBKRWidget to ALL_WIDGETS list + render block |
| `components/Navbar.tsx` | MODIFY | Add `/tools` nav link |
| `app/settings/page.tsx` | MODIFY | Add "Broker" tab for IBKR config |
| `next.config.ts` | MODIFY | Add `openai` to `serverExternalPackages` if needed |
| `middleware.ts` | UNMODIFIED | `/tools` and `/api/broker/*` and `/api/ai/*` follow existing session-auth pattern |

---

## Sources

- Existing codebase: `lib/simulation.ts`, `lib/db.ts`, `lib/types.ts`, `lib/broker-parsers.ts` (read directly)
- Existing codebase: `components/TradeModal.tsx`, `app/analytics/page.tsx`, `app/api/settings/route.ts` (read directly)
- Existing codebase: `next.config.ts`, `middleware.ts`, `components/dashboard/DashboardShell.tsx` (read directly)
- IBKR Client Portal API: documented at https://ibkrcampus.com/ibkr-api-page/cpapi-v1/ (knowledge cutoff-based; verify gateway auth flow)
- OpenAI Vision API (gpt-4o): supports base64-encoded images in chat completions (knowledge cutoff-based; verify model availability and pricing)
- Confidence: HIGH for integration patterns (derived from codebase); MEDIUM for IBKR and OpenAI API specifics (external services, verify against current docs)
