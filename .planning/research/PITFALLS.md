# Domain Pitfalls

**Domain:** AI Chart Analysis, IBKR Broker Sync, Monte Carlo Entry Integration, Trading Calculators — added to existing Next.js 15 + SQLite trading journal
**Researched:** 2026-03-15
**Confidence:** MEDIUM (training data + direct codebase analysis; web search unavailable)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or complete feature failure.

---

### Pitfall 1: IBKR TWS API — Treating It Like a Normal REST API

**What goes wrong:** The IBKR TWS API (ibapi) is a socket-based client library that runs a persistent event-driven message loop. It is NOT a REST API you can call and await. Developers who model it as `await ibkr.getPositions()` will spend days fighting race conditions, dropped connections, and ghost callbacks.

**Why it happens:** The TWS Python/Java SDK uses asynchronous callbacks (EWrapper methods). The Node.js community ports (`@stoqey/ib`, `ib-tws-api`, `@stoqey/ibkr`) expose promise-like wrappers but the underlying socket is still stateful — one EClient shared across all calls. Reconnecting after a dropout is non-trivial.

**Consequences:**
- Silent failures: trade data never arrives because the callback fired before the subscriber registered
- Deadlock if you call synchronous Node code inside async TWS callbacks
- Two concurrent Next.js API route invocations share state on the EClient socket — causes interleaved, corrupt responses

**Prevention:**
- Run IBKR sync as a **separate long-lived singleton process** (a standalone Node daemon, `lib/ibkr-daemon.ts`), not inside Next.js API route handlers. Next.js routes are stateless — they cannot hold a persistent socket.
- The daemon writes positions/trades to SQLite and Next.js reads from SQLite. Never call the TWS SDK from an API route directly.
- Use a `connection_status` table row (or settings key) as the health signal the UI polls.
- Implement exponential backoff reconnection: TWS drops connections on market close, idle timeout, and TWS restarts.

**Detection:** If you find yourself calling `connect()` inside an API route handler, stop — redesign as a daemon.

**Phase:** IBKR Sync phase (whichever phase introduces broker sync).

---

### Pitfall 2: IBKR TWS API — Localhost-Only Architecture Assumption

**What goes wrong:** TWS must run on the trader's local machine. IBKR's firewall blocks cross-machine socket connections to TWS by default (you can whitelist IPs but this is fragile). If the app is deployed server-side (Docker/VPS), the server cannot reach the trader's local TWS instance.

**Why it happens:** Developers assume "backend connects to IBKR" the same way they connect to any broker API with an HTTP key. IBKR's TWS/Gateway is a thick desktop client, not a hosted service.

**Consequences:**
- The entire feature is non-functional in any hosted/cloud deployment.
- Forces a fundamental architecture rethink mid-phase.

**Prevention:**
- Design for the **IBKR Client Portal Web API** as the primary cloud-compatible path: it's a REST API running on a locally-hosted gateway the trader starts, but it uses HTTP not raw sockets, making it more tractable from a Next.js API route (still requires the gateway running locally).
- Alternative: IBKR CSV auto-export + file watcher daemon (simpler, proven). The existing multi-broker CSV import in `app/api/trades/import/` can be extended.
- Document clearly in the UI: "IBKR sync requires the IBKR Gateway running on your machine."
- For self-hosted deployments, provide a companion script the trader runs locally that POSTs to their Ledger Of Alpha instance.

**Detection:** Any design that assumes the Next.js server makes outbound TCP connections to TWS will break in non-localhost deployments.

**Phase:** Must be addressed in architecture phase before IBKR implementation begins.

---

### Pitfall 3: AI Vision — Sending Raw Screenshots to LLM Without Structure Enforcement

**What goes wrong:** Sending a chart screenshot to a vision LLM (GPT-4o, Claude) and asking "what pattern is this?" returns free-form prose. The response cannot be reliably parsed, compared against historical trades, or stored. Subsequent "similar trade matching" becomes impossible.

**Why it happens:** Teams reach for the simplest prompt ("describe this chart") and defer structured output to "later." Later never comes cleanly — you now have thousands of unstructured analysis strings in the database.

**Consequences:**
- The "similar trade finder" feature requires a vector embedding or structured feature set. Free-form text produces unreliable similarity scores.
- The analysis is not actionable in the dashboard (can't filter by pattern type, can't aggregate win rates per pattern).

**Prevention:**
- Define a strict JSON schema for analysis output **before writing the first API call**. Example structure: `{ pattern: string, timeframe: string, trend: string, keyLevels: number[], confidence: 'high'|'medium'|'low', notes: string }`.
- Use OpenAI's **structured outputs / response_format: json_schema** or Anthropic's tool-use pattern to enforce the schema at the API level. Never rely on prompt-only JSON instruction — models hallucinate extra fields or omit required ones under load.
- Store the structured JSON in a `chart_analyses` table column (TEXT, parsed on read), not embedded in a free-text field.
- Add a migration for a new `chart_analyses` table: `(id, trade_id, user_id, account_id, schema_version, analysis_json, embedding, created_at)`. Include `schema_version` so you can re-analyze old screenshots if the schema evolves.

**Detection:** If your initial prompt is "analyze this chart," you are building technical debt. Require structured output from day one.

**Phase:** AI Analysis phase.

---

### Pitfall 4: AI Vision — Image Upload Hitting Next.js 4.5MB Body Limit

**What goes wrong:** Next.js 15 App Router API routes have a default request body size limit of 4.5MB. A retina screenshot (1440x900, lossless PNG) can easily be 3-8MB. The upload silently fails with a 413 or a parse error that the frontend receives as a generic network error.

**Why it happens:** Developers test with small JPEG screenshots (< 1MB) during development and only discover the limit when users upload actual screen captures.

**Consequences:**
- Feature silently fails for common screenshot sizes with no clear user error message.
- Attempting to raise the limit via `export const config = { api: { bodyParser: { sizeLimit: '10mb' }}}` works in Pages Router but uses different syntax in App Router.

**Prevention:**
- In App Router, disable the default body parser and stream the file: add `export const config = { api: { bodyParser: false } }` is Pages Router syntax. In App Router, use `req.formData()` instead of `req.json()` and receive the image as a `File` object.
- Compress screenshots client-side before upload: use the Canvas API to re-encode to JPEG at 0.85 quality. Most chart screenshots compress from 4MB PNG to under 700KB JPEG with no perceptible quality loss for vision analysis.
- Set `next.config.ts` `experimental.serverActions.bodySizeLimit` if using Server Actions, or configure route segment config `export const maxDuration` for Vercel deployments.
- Add explicit file size validation on the client (reject before upload if > 5MB) with a clear error message.

**Detection:** Test with an actual macOS/Windows screenshot (not a resized test image) before shipping.

**Phase:** AI Analysis phase.

---

### Pitfall 5: Monte Carlo in TradeModal — Running 5,000 Iterations Synchronously on the Main Thread

**What goes wrong:** The existing `runMonteCarlo()` in `lib/simulation.ts` runs 5,000 iterations × 100 trades in a synchronous loop. This is fine in a standalone page where the user explicitly triggers it. Embedded in `TradeModal.tsx`, it will be triggered on every keystroke change to entry price, stop loss, or position size — freezing the modal UI for 200-400ms on every input.

**Why it happens:** The simulation works fine in isolation. Developers add it to the modal's `useMemo` or `useEffect` without recognizing the compute cost at interactive update frequency.

**Consequences:**
- The trade entry modal becomes sluggish. Traders entering prices will see frozen inputs — a major UX regression on the most-used feature.
- On lower-end hardware (many traders use older machines), the freeze extends to 500-800ms.

**Prevention:**
- Run Monte Carlo in a **Web Worker**. The simulation has zero DOM dependencies and is trivially movable to a worker: `const worker = new Worker(new URL('../workers/monteCarlo.worker.ts', import.meta.url))`.
- Debounce the trigger: wait 600ms after the last input change before starting a new simulation run. Never run on every keystroke.
- Reduce iterations for the in-modal "preview" mode: 1,000 iterations is sufficient for directional guidance (ruin probability, median outcome). Reserve 5,000 for the full simulator page.
- Show a loading spinner during calculation; never block input.
- The TradeModal already has a `useMemo` for R:R calculation (lines 166-178) — the Monte Carlo must NOT follow the same pattern due to its cost difference.

**Detection:** Add `console.time('monteCarlo')` around a test run with 5,000 iterations. If it exceeds 50ms synchronously, it must be moved to a worker.

**Phase:** Monte Carlo integration phase.

---

### Pitfall 6: Monte Carlo Integration — Using Account Balance Without Respecting Multi-Account Scope

**What goes wrong:** The Monte Carlo preview in TradeModal computes ruin probability against an account balance. If the balance pulled is the "All Accounts" aggregate (the default when `activeAccountId === null`), the ruin probability is calculated against the wrong number — often 3-5x the actual account balance being risked, making ruin look impossible when it isn't.

**Why it happens:** The `useAccounts()` hook provides `activeAccountId` which can be `null` (all accounts). The `accountSize` prop passed to TradeModal falls back to a settings value (`s.account_size`) when the account-specific value isn't found. This fallback is a global setting, not per-account.

**Consequences:**
- Traders enter trades thinking their ruin probability is 2% when it's actually 18% because Monte Carlo ran against the wrong balance.
- Risk management feature actively misleads traders.

**Prevention:**
- In TradeModal, always use `selectedAccountId` (the account the trade is being assigned to) — never `activeAccountId` — to look up balance for position sizing and Monte Carlo.
- When `selectedAccountId` is null (edge case where user has no accounts), show a warning and disable Monte Carlo rather than using a fallback balance.
- The `selectedAccountId` state is already in TradeModal (line 60-63). Ensure the Monte Carlo computation receives the current balance of that specific account: `startingBalance = account.starting_balance + account.realized_pnl` (computed client-side, consistent with how AccountBanner does it).

**Detection:** Test with two accounts of different sizes. The Monte Carlo result should change when you switch the trade's assigned account.

**Phase:** Monte Carlo integration phase.

---

### Pitfall 7: IBKR Trade Import — Duplicate Detection Across Manual and Auto-Imported Trades

**What goes wrong:** IBKR auto-import runs on a schedule and imports all trades from the past N days. If the user also manually entered the same trade (or previously imported via CSV), the same trade exists twice. Duplicate detection using only symbol + date is insufficient — IBKR assigns unique order IDs that should be the deduplication key.

**Why it happens:** The existing CSV import (`app/api/trades/import/route.ts`) has no deduplication — it inserts all records in the payload. This was acceptable for manual one-time imports but breaks for recurring automated sync.

**Consequences:**
- Dashboard analytics become wrong: P&L is doubled for any trade imported twice, win rates are skewed.
- Traders lose trust in the platform accuracy.
- Recovery requires manual de-duplication UI or a migration, both expensive.

**Prevention:**
- Add an `external_id` column to the `trades` table in the IBKR migration: `external_id TEXT` (IBKR order ID or exec ID).
- The IBKR import route must use `INSERT OR IGNORE` / `ON CONFLICT(user_id, external_id) DO NOTHING` — upsert semantics, not blind insert.
- The import response should report: `{ inserted: N, skipped: M, errors: [] }` so the user sees deduplication is working.
- For trades entered manually before IBKR sync is added, provide a "Link to IBKR" flow that sets the `external_id` on an existing trade.

**Detection:** Run the auto-import twice within the same day and verify the trade count does not increase on the second run.

**Phase:** IBKR Sync phase.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-visible bugs but don't require fundamental redesigns.

---

### Pitfall 8: AI Vision — Storing Images in SQLite as BLOBs

**What goes wrong:** Storing chart screenshot images as BLOBs in SQLite inflates the database file rapidly. A user who analyzes 100 trades with screenshots generates 50-500MB of BLOB data. SQLite in WAL mode reads and checkpoints the entire database — large BLOBs degrade all query performance, not just image queries.

**Prevention:**
- Store screenshots as files on disk in a `data/uploads/` directory (gitignored). Store only the file path in the database.
- Use content-addressed storage: filename = SHA-256 of the image bytes. Deduplicates identical screenshots and makes cleanup trivial.
- If cloud deployment is planned, abstract the storage interface early: `lib/storage.ts` with a `save(buffer): Promise<string>` that starts with local filesystem and can be swapped for S3/R2 later.

**Phase:** AI Analysis phase.

---

### Pitfall 9: Trading Calculators — Calculator State Not Isolated from Dashboard State

**What goes wrong:** The Trading Tools Hub calculators use fields like "account balance," "risk percentage," and "win rate" that also exist as app-wide settings. If calculator inputs are wired to global settings state, changing "account balance" in the Kelly Criterion calculator unexpectedly changes the position sizer's account size on the chart page.

**Prevention:**
- Calculators use **fully local React state** — never read from or write to the settings API.
- If a calculator has a "use my account balance" convenience button, it reads from settings once on click but does not subscribe to changes.
- Calculator inputs default to empty/placeholder values, not pre-filled from global settings.

**Phase:** Trading Tools Hub phase.

---

### Pitfall 10: IBKR Sync — No Handling for IBKR's Rate Limits and Pacing Violations

**What goes wrong:** IBKR enforces pacing limits: no more than 50 identical requests in 10 minutes, and requests for historical data are throttled (1 request per 10 seconds for live data). Auto-import that fires on every page load or every minute will trigger pacing violations. IBKR responds by disconnecting the client and logging the API key for abuse — repeat violations can suspend paper trading accounts.

**Prevention:**
- The sync daemon must have a configurable poll interval with a minimum floor of 5 minutes.
- Cache the last sync timestamp in the settings table (`ibkr_last_sync`). Skip sync if fewer than 5 minutes have elapsed.
- Implement circuit breaker: if IBKR returns a pacing error (error code 162), back off exponentially and do not retry for at least 10 minutes.
- Log all IBKR API errors to a `ibkr_sync_log` table: `(id, timestamp, event_type, message)`. Expose the last 20 log entries in the Settings page.

**Phase:** IBKR Sync phase.

---

### Pitfall 11: Monte Carlo Preview — Insufficient Historical Data Produces Misleading Results

**What goes wrong:** The existing `runMonteCarlo()` resamples from the user's historical returns array. When a new account has fewer than 20 closed trades, the resampling produces wildly inaccurate distributions — one or two outlier trades dominate. The ruin probability for a 3-trade history is essentially meaningless.

**Prevention:**
- Add a minimum trade count gate: display Monte Carlo preview only when the selected account has ≥ 20 closed trades.
- When below the threshold, show: "Need at least 20 closed trades for reliable risk modeling. Currently: N."
- The existing standalone Monte Carlo page likely already encounters this — check if it has a guard. If not, add one to both surfaces.
- Consider offering a "use strategy win rate" mode as an alternative when historical data is thin: the user inputs expected win rate and R:R, the simulator generates synthetic returns.

**Phase:** Monte Carlo integration phase.

---

### Pitfall 12: Next.js 15 App Router — API Routes That Block on SQLite During Image Processing

**What goes wrong:** A single Next.js API route that (1) receives an image upload, (2) calls an external vision API (1-5 seconds), and (3) writes to SQLite — all in sequence — blocks the route handler's execution for the full duration. In Next.js App Router with concurrent requests, this is fine for a single user but creates a long-tail latency problem at any scale.

**Why it matters for this app:** The existing `better-sqlite3` is synchronous. Any I/O wait (waiting for the OpenAI API response) blocks the Node.js thread that holds the SQLite connection, degrading all other simultaneous requests.

**Prevention:**
- Keep the AI vision API call in the route handler but ensure the SQLite write only happens after the external call resolves — do not hold a transaction open across the external call.
- The current `getDb()` singleton pattern (line 14 in `lib/db.ts`) is fine. Just ensure no `db.prepare().run()` calls sit inside an `await externalApi()` sandwich.
- For production, consider a job queue: the image upload endpoint enqueues the analysis job and returns `{ jobId }` immediately. A background worker processes it and updates a `chart_analyses` table. The UI polls `/api/ai/status?jobId=X`.

**Phase:** AI Analysis phase.

---

### Pitfall 13: AI Vision — OpenAI API Key Exposed in Client-Side Code or Build Output

**What goes wrong:** Developers add `OPENAI_API_KEY` to the `.env.local` file but accidentally reference it as `NEXT_PUBLIC_OPENAI_API_KEY` (with the `NEXT_PUBLIC_` prefix), which causes Next.js to embed it in the client bundle.

**Consequences:** The API key is visible to anyone who inspects the JavaScript bundle in DevTools. IBKR credentials face the same risk.

**Prevention:**
- All external API keys (`OPENAI_API_KEY`, any IBKR credentials) must be server-side only — no `NEXT_PUBLIC_` prefix, ever.
- The AI analysis endpoint is a server-side API route (`app/api/ai/analyze/route.ts`) that calls OpenAI — the client only sends the image and receives the analysis.
- Add `OPENAI_API_KEY` to `.env.example` with a placeholder value and a comment: `# Server-side only — never prefix with NEXT_PUBLIC_`.
- The `next.config.ts` already has `output: "standalone"` — verify the standalone bundle does not include env vars at build time (it shouldn't, but verify by inspecting `.next/standalone`).

**Detection:** Search the built `.next/static/` directory for any substring of the API key after a build. Should return no matches.

**Phase:** AI Analysis phase, before any key is added to the environment.

---

### Pitfall 14: Correlation Matrix Calculator — Computing Pearson Correlation in the Browser for Large Datasets

**What goes wrong:** The correlation matrix requires computing pairwise correlations between N symbols × T time periods. At N=20 symbols and T=252 trading days, that's 400 pairwise calculations × 252 data points = 100,800 multiplications. This is instant. But fetching 20 symbols × 252 days of OHLCV data means 20 API calls to `/api/ohlcv` which currently calls Yahoo Finance. Yahoo throttles concurrent requests.

**Prevention:**
- Fetch OHLCV data sequentially with delays, not in `Promise.all()` (which fires 20 concurrent Yahoo Finance requests and will cause throttling).
- Cache OHLCV responses in the `symbols` table or a new `ohlcv_cache` table with a `fetched_at` timestamp. If data is less than 24 hours old, serve from cache.
- The correlation computation itself should be in a Web Worker (same pattern as Monte Carlo) to avoid blocking the UI during matrix calculation.
- Limit the maximum number of symbols in the correlation matrix to 15 to keep the UI readable and the computation bounded.

**Phase:** Trading Tools Hub phase.

---

### Pitfall 15: IBKR Import — Account Mapping When User Has Multiple Ledger Accounts

**What goes wrong:** IBKR supports multiple sub-accounts (individual, IRA, paper trading). When importing IBKR trades, the system must map IBKR account IDs to Ledger Of Alpha account IDs. Without explicit mapping, all IBKR trades land in a single account, defeating the multi-account system.

**Prevention:**
- Add an `ibkr_account_map` settings key (JSON): maps IBKR account IDs to Ledger Of Alpha account IDs.
- The Settings page gets an "IBKR Account Mapping" section (visible only when IBKR sync is configured): shows detected IBKR accounts and lets the user assign each to a Ledger account or create a new one.
- The import route checks this mapping before inserting; trades from unmapped IBKR accounts are held in a `pending_imports` state rather than silently dropped.

**Phase:** IBKR Sync phase.

---

## Minor Pitfalls

Mistakes that cause minor UX friction or require small fixes.

---

### Pitfall 16: Trading Tools Hub — Deep Linking and Browser Back Button

**What goes wrong:** If the Trading Tools Hub is a single page with tab/calculator switching handled by React state (not URL), the browser back button does not navigate between calculators. Users who click into a calculator, configure it, then hit back to "go to the previous calculator" instead leave the page.

**Prevention:**
- Use URL query params for the active calculator: `/tools?calculator=kelly-criterion`. Read from `useSearchParams()` and push to router on tab change.
- This also makes calculator states shareable via URL (a minor but valued UX feature for traders sharing setups).

**Phase:** Trading Tools Hub phase.

---

### Pitfall 17: Monte Carlo in TradeModal — No Escape Hatch for Traders Who Don't Want It

**What goes wrong:** Adding a Monte Carlo panel to the trade entry modal increases the modal's height and visual complexity. Traders who use the modal hundreds of times per month and understand their risk intuitively will find it friction-adding. Forcing it visible is a UX regression.

**Prevention:**
- Monte Carlo preview in the modal is **collapsed by default**. A single "Show Risk Simulation" button expands it.
- The expanded/collapsed preference is persisted in settings (`montecarlo_panel_expanded` key, boolean).
- The full simulation is always accessible on the standalone simulator page — the modal integration is a convenience, not a replacement.

**Phase:** Monte Carlo integration phase.

---

### Pitfall 18: AI Vision — Guest Mode Behavior

**What goes wrong:** Guest users (demo mode) trigger the AI analysis endpoint, which calls the external vision API. This consumes real API credits for unauthenticated users.

**Prevention:**
- The AI analysis route must check `isGuest(req)` first and return a canned demo response (or a clear message: "Create an account to use AI analysis").
- Apply rate limiting to the AI endpoint with a tight limit (3 requests per hour per IP) as an additional safeguard beyond the guest check.
- The existing `rateLimit()` helper in `lib/rate-limit.ts` handles this with one call.

**Phase:** AI Analysis phase.

---

### Pitfall 19: Settings Table Collision — New Feature Settings Keys Overwriting Existing Keys

**What goes wrong:** New features (IBKR config, AI API key reference, calculator preferences) add new keys to the `settings` table. If a key name accidentally collides with an existing key (e.g., a new feature uses `account_size` for something different), it silently corrupts the existing setting.

**Prevention:**
- Namespace all new feature settings with a feature prefix: `ibkr_`, `ai_`, `tools_`, `montecarlo_`.
- Document all settings keys in a central location (add a `SETTINGS_REGISTRY` comment block in `lib/db.ts` or a separate `lib/settings-keys.ts` constants file).
- Audit the existing settings keys before adding new ones: `dashboard_layout`, `dashboard_time_filter`, `chart_tabs`, `watchlists`, `watchlist_width`, `panel_width`, `account_size`, `risk_per_trade`, `commission_per_trade`, `strategies`, `default_mistakes`, `default_tags`, `trade_templates`.

**Phase:** Every phase that adds settings.

---

### Pitfall 20: Database Migrations — Missing Account Scope on New Tables

**What goes wrong:** New tables added for v2.0 features (e.g., `chart_analyses`, `ibkr_sync_log`, `pending_imports`) omit `user_id` or `account_id` columns. Data becomes globally visible across all users in a multi-user deployment.

**Why it happens:** The developer is focused on the feature logic and treats the SQLite database as single-user during development.

**Prevention:**
- Every new table that stores user-generated data requires `user_id TEXT NOT NULL` at minimum.
- Tables storing trade-linked data require `account_id TEXT` (nullable, for "all accounts" associations) with a foreign key to `accounts.id`.
- The inline migration pattern in `lib/db.ts` makes this easy to audit — check all `CREATE TABLE` statements before committing.
- Follow the existing pattern: `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

**Phase:** Every phase that adds new database tables.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| AI Analysis — Image Upload | Body size limit (4.5MB default) causes silent 413 failures | Client-side JPEG compression before upload |
| AI Analysis — LLM Response | Free-form text responses break similar trade matching | Enforce JSON schema via structured output API feature |
| AI Analysis — External API | OpenAI key leaks if prefixed with NEXT_PUBLIC_ | Server-side route only, never NEXT_PUBLIC_ |
| AI Analysis — SQLite | Image BLOBs inflate DB, degrade all queries | Store images on disk, paths in DB |
| AI Analysis — Guest Users | Vision API called for unauthenticated users, burns credits | isGuest() check + rate limit at route entry |
| Monte Carlo — TradeModal | Synchronous 5K-iteration loop freezes input fields | Web Worker + debounce + reduce to 1K iterations in-modal |
| Monte Carlo — Account Scope | Balance pulled from wrong account (null activeAccountId) | Use selectedAccountId, never activeAccountId |
| Monte Carlo — Thin Data | Fewer than 20 trades produces meaningless ruin probability | Gate display behind minimum trade count |
| IBKR Sync — Architecture | TWS socket cannot live in a stateless API route | Standalone daemon writes to SQLite; Next.js reads SQLite |
| IBKR Sync — Deployment | Server cannot reach trader's local TWS | Design for Client Portal API or local-to-hosted POST bridge |
| IBKR Sync — Duplicates | Recurring import creates duplicate trades | external_id column + ON CONFLICT DO NOTHING |
| IBKR Sync — Rate Limits | Pacing violations disconnect client, risk account flags | Minimum 5-min poll interval, circuit breaker on error 162 |
| IBKR Sync — Multi-Account | IBKR sub-accounts not mapped to Ledger accounts | Account mapping UI in settings, pending_imports for unmapped |
| Tools Hub — Correlation Matrix | 20 concurrent Yahoo Finance requests get throttled | Sequential fetch with cache; max 15 symbols |
| Tools Hub — State Management | Calculator inputs bleed into global app settings | Fully local React state; no settings API writes |
| Tools Hub — Navigation | Back button exits page instead of switching calculators | URL query params for active calculator |
| All Phases — Settings Keys | New keys collide with existing setting names | Prefix with feature name; maintain settings registry |
| All Phases — New Tables | Missing user_id/account_id on new tables leaks data | Required on every new user-data table; enforce at migration |

---

## Sources

- Direct codebase analysis: `lib/simulation.ts`, `lib/db.ts`, `lib/rate-limit.ts`, `lib/auth.ts`, `components/TradeModal.tsx`, `middleware.ts`, `next.config.ts`, `app/api/trades/route.ts`, `app/api/settings/route.ts`
- Training data on IBKR TWS API architecture (socket-based EClient/EWrapper pattern) — MEDIUM confidence
- Training data on Next.js 15 App Router body size limits and Web Worker patterns — MEDIUM confidence
- Training data on OpenAI structured outputs and vision API patterns — MEDIUM confidence
- Training data on SQLite BLOB performance characteristics — MEDIUM confidence

**Confidence notes:**
- IBKR architecture pitfalls: MEDIUM (TWS API design is well-established but specific SDK behavior may have changed)
- Next.js body limit specifics: MEDIUM (4.5MB is the documented default for Pages Router; App Router behavior should be verified against Next.js 15 docs)
- Monte Carlo Web Worker feasibility: HIGH (the simulation has zero DOM dependencies, confirmed by reading `lib/simulation.ts`)
- Multi-account scope pitfalls: HIGH (confirmed by reading the codebase — `activeAccountId === null` is an explicit "All Accounts" state)
