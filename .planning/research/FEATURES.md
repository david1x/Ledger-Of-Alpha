# Feature Landscape: v2.0 Intelligence & Automation

**Domain:** Trade journaling platform — adding AI analysis, broker automation, Monte Carlo entry integration, and calculators
**Researched:** 2026-03-15
**Overall confidence:** MEDIUM — based on established industry patterns and deep codebase analysis; web search unavailable during this session

---

## Domain Overview

This research covers four distinct feature clusters being added to an existing v1.0 journaling platform. Each cluster has different maturity profiles, integration complexity, and risk. The existing codebase is well-understood (Next.js 15, SQLite, lightweight-charts, recharts, better-sqlite3) and all new features must extend it — no stack changes.

---

## Feature Cluster 1: AI Chart Pattern Recognition

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload screenshot from chart page | Entry point for the feature; users take screenshots from TradingView during trade review | Low | Image upload form, file size validation, accepted formats (PNG/JPG/WEBP) |
| Pattern label output | Users expect AI to name what it sees: "ascending triangle", "bull flag", "double bottom" | Medium | Depends on model; GPT-4o Vision produces confident labels from trading chart screenshots |
| Confidence score per pattern | Raw label alone is not actionable; users need to know if AI is 70% or 95% confident | Low | Model returns logprobs or explicit probability language; parse and display |
| Link identified pattern to existing trade | Core workflow: screenshot is uploaded during trade review, the match must connect to a specific trade record | Low | Foreign key `trade_id` on image/analysis records; already have trade context |
| Analysis stored for later retrieval | Users expect to re-view AI analysis without re-uploading | Low | Store analysis JSON in DB alongside image path or base64 ref |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Similar trade finder by pattern | "Show me all my past bull flag entries" — converts pattern label into a DB query against `tags` or a new `pattern` column | High | Requires either (a) retroactive AI labeling of historical chart images or (b) fuzzy text matching against existing `tags` field |
| Pattern performance stats | "Your bull flags win 72% of the time" — aggregate P&L by AI-detected pattern label | Medium | Straightforward once pattern labels exist in DB; join against `trades` table by pattern label |
| Confidence threshold filter | Only show matches above N% confidence | Low | Simple filter on stored `confidence` float |
| Setup comparison overlay | Visually overlay two trade charts side-by-side | Very High | Requires chart rendering infrastructure beyond current scope; likely deferred |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| On-device image model (ONNX/TensorFlow.js) | Too heavy for trader hardware; models for chart recognition are 200MB+; slow on CPU; poor accuracy vs cloud | Use OpenAI GPT-4o Vision or Google Gemini Vision API — cloud inference, no GPU needed |
| Training a custom model | Requires labeled dataset of 50K+ trading screenshots; months of ML work; outside scope | Prompt engineer an existing vision LLM to recognize standard TA patterns |
| Real-time video/stream analysis | Order of magnitude harder than static screenshots; no user demand in journaling context | Static screenshot analysis only |
| Storing raw images in SQLite | SQLite is not designed for binary blob storage at scale; will balloon DB size | Store images as files on disk (e.g., `data/uploads/`) with path in DB, or encode as base64 for small images only |

### Feature Dependencies

```
Image upload UI → API route (multipart/form-data) → Vision API call → Parse response → Store analysis
Analysis stored → Similar trade finder (queries stored pattern labels)
Analysis stored → Pattern performance stats (joins against trades)
Existing trade record → Link analysis to trade (trade_id FK)
```

### Existing Code Leverage

- `components/PersistentChart.tsx` already handles Discord image posting via multipart form data — the upload plumbing pattern exists
- `lib/types.ts` Trade interface has `tags` field — pattern labels can be stored there OR a dedicated `pattern_label` column added via migration
- `lib/db.ts` inline migration pattern — add `chart_analyses` table via new migration
- No existing file storage infrastructure — first feature to require disk writes (uploads dir)

### MVP Recommendation

1. Screenshot upload button on trade view/edit modal (or chart page)
2. GPT-4o Vision API call from Next.js API route
3. Return pattern labels + confidence to UI
4. Store analysis linked to trade_id
5. Basic "similar trades" query against stored pattern labels

Defer: Retroactive labeling of historical trades, setup overlay comparison

---

## Feature Cluster 2: IBKR/TWS Live Sync + Auto-Import

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Connect IBKR account (one-time setup) | Users expect a settings screen to enter credentials/token — mental model from other broker integrations | Medium | IBKR Client Portal API uses OAuth-like session auth; TWS API uses socket connection to local TWS |
| View live open positions | Core ask: "show me what's open in IBKR right now without typing it manually" | High | Polling or WebSocket to IBKR; display as open trades in existing trades list |
| Auto-import closed trades | "My trades should appear in the journal automatically after I close them in IBKR" | High | Requires background polling of IBKR execution history; deduplication against existing trades |
| Manual sync trigger ("Sync Now" button) | Users don't trust fully automatic sync initially; they want control | Low | Button that fires the sync API route on demand |
| Sync status indicator | Users need to know when last sync ran and if it succeeded | Low | Timestamp + status stored in settings; shown in IBKR settings section |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time position P&L from IBKR | Show live unrealized P&L from broker — more accurate than Yahoo Finance quotes | Very High | Requires persistent WebSocket to TWS or frequent polling of Client Portal; high complexity |
| Two-way sync (write trades back to IBKR) | "Enter planned trade in journal, send order to IBKR" | Very High | Order management is a different product category; regulatory complexity; not in v2.0 scope |
| Conflict resolution UI | When IBKR trade doesn't match manually-entered trade, show a diff and let user decide | High | Edge case but important for data integrity; show side-by-side comparison |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| TWS socket API (EClient/EWrapper) | Requires TWS desktop app running locally on trader's machine AND the Next.js server to be on same machine; breaks for cloud/self-hosted deployments | Use IBKR Client Portal API (REST) — runs in browser session or via gateway; more portable |
| Storing IBKR credentials in DB plaintext | High security risk if DB is compromised (existing concern documented in CONCERNS.md) | Store only OAuth tokens/session IDs; never username/password; encrypt at rest |
| Full order book / level 2 data | Streaming order book is a trading terminal feature, not a journaling feature | Quote display only; use existing Yahoo Finance quotes for now |
| Polling every second | Rate limit abuse; IBKR imposes rate limits; performance hit | Poll every 30-60 seconds for positions; trades sync on demand or every 5 minutes |

### IBKR API Reality Check (MEDIUM confidence — based on training knowledge)

**Two API options exist:**

1. **TWS API (socket-based)**: Connects to TWS or IB Gateway running on same host. Uses `@stoqey/ib` or `ibkr` npm packages that wrap the socket protocol. Requires IB Gateway/TWS running. Good for real-time data. Bad for cloud deployments.

2. **Client Portal API (REST)**: IBKR's official REST API accessible via `https://localhost:5000` (IBKR's local gateway process) or their cloud endpoint. Session-based auth. Simpler to integrate from Next.js API routes. Rate limited.

**Recommendation:** Client Portal API for v2.0 — more portable, REST-based, fits the Next.js API route pattern, does not require TWS desktop. Users run the IBKR Client Portal Gateway as a local process, and the app hits `localhost:5000`.

**Deduplication approach:** Match incoming IBKR trades against existing journal entries by `symbol + entry_date + direction + shares`. Store `ibkr_order_id` on imported trades to prevent re-import.

### Feature Dependencies

```
IBKR credentials/session stored in settings → API route can call Client Portal API
Client Portal API → Live positions endpoint → Display as open trades
Client Portal API → Execution history endpoint → Auto-import as closed trades
Deduplication logic → requires `ibkr_order_id` column on trades table (new migration)
Account mapping → IBKR account number must map to existing journal Account record
```

### Existing Code Leverage

- `lib/broker-parsers.ts` already handles CSV parsing from IBKR — reuse field mapping logic
- `lib/types.ts` Trade interface — no structural changes needed except `ibkr_order_id` field
- `lib/db.ts` migration pattern — add `ibkr_order_id` column, `ibkr_settings` table
- Background polling: Next.js does not have native cron; use `/api/ibkr/sync` endpoint + client-side `setInterval` OR implement via a scheduled API route triggered by user session heartbeat

### MVP Recommendation

1. IBKR settings tab: Client Portal gateway URL + session token setup
2. "Sync Now" button that fetches recent executions and imports new trades
3. Deduplication by `ibkr_order_id`
4. Display last sync timestamp
5. Map to existing account record by IBKR account number

Defer: Real-time position streaming, conflict resolution UI, automatic background polling

---

## Feature Cluster 3: Monte Carlo Integration in Trade Entry

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "What does this trade do to my distribution?" preview in trade modal | The standalone Monte Carlo page exists but users expect position-sizing feedback AT entry time, not post-hoc | Medium | Trigger sim run from TradeModal using current account's historical returns + proposed position size |
| Suggested position size from simulation | "Based on your history, risk X shares to stay within N% drawdown" — actionable output | Medium | Reverse-engineer: given a max drawdown tolerance, what % of account to risk? Simple optimization on existing `runMonteCarlo` |
| Ruin probability warning | If proposed trade pushes ruin probability above threshold, show a red warning | Low | Call `runMonteCarlo` with proposed risk, check `probOfRuin` output against user's risk tolerance |
| Integrate with existing position sizer | Position sizer already exists in chart page and trade modal; Monte Carlo should augment it, not replace it | Low | Add a "Run Simulation" button adjacent to position sizer output |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Streak-aware simulation | "You're on a 3-trade losing streak; here's how that affects your next trade risk" | High | Requires conditioning Monte Carlo on recent performance, not just full historical distribution |
| Per-strategy simulation | "Run simulation using only your bull flag trades" — filters historical returns by setup type | Medium | Filter `trades` by `tags` before computing `returns` input to `runMonteCarlo` |
| Drawdown recovery estimate | "If this trade loses, you'll need X winning trades at your average to recover" | Low | Simple formula: DD / (avgWin * winRate); display inline |
| Simulation comparison (before/after) | Show side-by-side sim with and without proposed trade | Medium | Run two sims; display delta in key metrics |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Blocking trade save for high-ruin trades | Users get annoyed by friction that blocks workflow; they may have good reasons to override | Show warning, never block; use amber/red color coding |
| Complex configuration UI in modal | Trade modal is already complex (setup/execution/reflection tabs); adding sim controls adds cognitive load | Use sensible defaults; expose only "Run Simulation" button with single result summary |
| Running 50,000 iterations in modal | High iteration counts (>10K) add visible lag in browser | Cap at 2,000 iterations for inline preview; standalone page keeps full 5,000 |
| Replacing position sizer | Existing position sizer is well-established; users trust it | Augment with a "probability preview" badge next to position sizer output |

### Feature Dependencies

```
Existing runMonteCarlo (lib/simulation.ts) → Call with filtered historical returns + proposed position
Existing account historical trades → Filter closed trades → Compute return array as input
Existing TradeModal position sizer → Add "Sim Preview" section below position sizer
Account starting_balance + active trades → Compute current balance for simulation starting point
```

### Existing Code Leverage

- `lib/simulation.ts` `runMonteCarlo()` is complete and tested in standalone page — zero changes needed to the engine
- `lib/types.ts` `SimulationResult` interface — fully reusable
- `components/TradeModal.tsx` — add new "Risk Simulation" subsection within execution tab
- Historical returns: fetch closed trades for active account, compute `pnl/account_size` per trade — already done on Monte Carlo standalone page, extract into shared utility

### MVP Recommendation

1. "Simulate Risk" button in TradeModal execution tab (near stop loss / position size fields)
2. Fetch account's closed trades, compute return distribution
3. Run `runMonteCarlo` with 2,000 iterations client-side (fast enough)
4. Show three numbers inline: median outcome, ruin probability, prob of profit
5. Amber warning if ruin probability > user's configured threshold

Defer: Per-strategy filtering, streak-aware conditioning, comparison views

---

## Feature Cluster 4: Trading Tools Hub

### What Users Expect (Table Stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Risk/Reward Visualizer | Every trader uses R:R; having a visual representation (entry, stop, target on a number line) is standard | Low | Already have `RiskCalcResult` in `lib/types.ts`; existing position sizer logic; add chart visualization |
| Compound Growth Calculator | "If I make X% per month, what does my account look like in 12 months?" — universal trader question | Low | `FV = PV * (1 + r)^n` formula; inputs: starting balance, monthly %, months; output: table + line chart |
| Drawdown Recovery Calculator | "I'm down 30%, how many winning trades do I need to recover?" — emotionally resonant after losses | Low | `recovery% = 1 / (1 - DD%) - 1`; inputs: drawdown %; output: required gain % + number of trades at avg win rate |
| Kelly Criterion Calculator | Position sizing optimality — intermediate traders use this; formula is well-known | Low | `K = W - (1-W)/R` where W=win rate, R=win/loss ratio; simple form with explanation |
| Fibonacci Calculator | Support/resistance levels from a swing high/low — universal TA tool | Low | Standard fib levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618; inputs: swing high, swing low |
| Correlation Matrix | "Are my positions correlated? Am I overexposed to tech?" — relevant for multi-position traders | High | Requires historical price data for multiple symbols; compute Pearson correlation matrix; display as color-coded grid |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-fill calculators from active trade | "I'm reviewing a trade — use its entry/stop/target to pre-fill the R:R calculator" | Low | Pass query params from trade view to tools page; or share state via URL |
| Save calculator results to trade notes | One-click "Save to trade notes" from any calculator output | Low | Append formatted text to trade `notes` field via API call |
| Position size recommendation from Kelly | Kelly output directly feeds position sizer | Low | Connect Kelly output to existing `PositionSizeResult` calculation |
| Correlation matrix from user's own trade history | Show which of user's symbols have historically moved together in their own trades | Very High | Requires fetching OHLCV for all symbols user has traded; complex computation; use Yahoo Finance OHLCV already available |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Options-specific calculators (Black-Scholes, Greeks) | Out of scope per PROJECT.md; equity/forex focus | Document as future work; don't build placeholder UI |
| External tool embeds (embedded iframe from a 3rd party calculator) | Poor UX, branding inconsistency, CORS issues | Build native calculators with Tailwind + recharts |
| Saving calculator state to DB | Calculators are ephemeral tools, not stored documents; adds unnecessary DB complexity | Use URL params for shareable state if needed; no DB persistence |
| Over-engineering with React Query / complex state | Calculators are pure functions; inputs → outputs | Simple local `useState` per calculator; compute on every keystroke |

### Complexity Breakdown

| Calculator | Implementation Time | External Dependencies |
|------------|--------------------|-----------------------|
| R:R Visualizer | 0.5 days | None — existing types already exist |
| Compound Growth | 0.5 days | recharts (already installed) for chart |
| Drawdown Recovery | 0.5 days | None — pure math |
| Kelly Criterion | 0.5 days | None — pure math |
| Fibonacci | 0.5 days | None — pure math |
| Correlation Matrix | 2-3 days | Yahoo Finance OHLCV (already available via `/api/ohlcv`) + Pearson correlation compute |

### Feature Dependencies

```
Tools Hub page → New route: /tools (or /analytics?tab=tools)
R:R Visualizer → Existing RiskCalcResult type + existing position sizer logic
Compound Growth → recharts LineChart (already installed)
Kelly Criterion → user's historical win rate from closed trades (optional auto-fill)
Correlation Matrix → /api/ohlcv endpoint (already exists) for each symbol in user's trades
All calculators → No new DB tables; pure computation
```

### Existing Code Leverage

- `lib/types.ts` `RiskCalcResult` and `PositionSizeResult` — R:R calculator is 80% built from existing types
- `app/analytics/page.tsx` — tools can live as a tab within analytics or as a peer route
- `recharts` already installed — compound growth chart is straightforward
- `/api/ohlcv` already fetches OHLCV from Yahoo Finance — correlation matrix uses this
- `components/dashboard/StatWidget.tsx` style patterns — calculator output cards can follow same design

### MVP Recommendation

Build all 6 calculators in sequence from simplest to most complex:
1. R:R Visualizer (leverages existing types)
2. Compound Growth (simple math + recharts)
3. Drawdown Recovery (simple math)
4. Kelly Criterion (simple math + optional auto-fill from history)
5. Fibonacci (simple math, table output)
6. Correlation Matrix (last, most complex — OHLCV fetch + computation)

---

## Cross-Feature Dependencies

```
AI Screenshot Analysis
  └─ Requires: New /api/ai/analyze-chart route
  └─ Requires: New chart_analyses DB table (migration)
  └─ Requires: OpenAI API key in settings (new env var + settings field)
  └─ Requires: File upload handling (multipart, disk write)

IBKR Sync
  └─ Requires: New /api/ibkr/* routes (connect, sync, positions)
  └─ Requires: ibkr_order_id column on trades table (migration)
  └─ Requires: ibkr_settings table or settings keys
  └─ Requires: IBKR Client Portal gateway accessible from server

Monte Carlo in Trade Entry
  └─ Requires: Zero new infrastructure (engine already exists)
  └─ Requires: Shared utility to compute return array from trade history
  └─ Requires: Minor TradeModal UI addition

Trading Tools Hub
  └─ Requires: New /tools page or /analytics?tab=tools
  └─ Requires: Zero new DB tables
  └─ Correlation matrix requires: /api/ohlcv calls per symbol
```

---

## Complexity vs Value Matrix

| Feature | User Value | Implementation Complexity | Build First? |
|---------|------------|--------------------------|-------------|
| Monte Carlo in Trade Entry | Very High | Low (engine exists) | YES — quick win |
| R:R / Compound / Drawdown / Kelly / Fibonacci calculators | High | Low | YES — each is half a day |
| AI Screenshot Pattern Recognition | High | Medium | YES — core v2.0 differentiator |
| Similar Trade Finder | Medium | Medium | YES — after AI analysis is stored |
| IBKR Sync (manual) | Very High | High | YES — but scope to manual sync first |
| Correlation Matrix | Medium | High | Later — most complex calculator |
| IBKR Real-time positions | High | Very High | Defer — scope creep risk |
| Pattern Performance Stats | High | Low (after patterns stored) | YES — natural follow-on |

---

## Sources

- Codebase analysis: `lib/simulation.ts`, `lib/types.ts`, `lib/insight-engine.ts`, `lib/broker-parsers.ts`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/CONCERNS.md`
- IBKR API architecture: MEDIUM confidence — based on training knowledge of IBKR Client Portal API (REST) vs TWS API (socket) — verify against current IBKR developer documentation before implementation
- OpenAI GPT-4o Vision capabilities for chart pattern recognition: MEDIUM confidence — GPT-4o Vision is documented as capable of analyzing financial charts; exact prompt engineering needed to validate pattern recognition accuracy
- Calculator formulas (Kelly, Fibonacci, compound growth, drawdown recovery): HIGH confidence — these are established financial mathematics with no ambiguity
- Monte Carlo engine details: HIGH confidence — source code read directly from `lib/simulation.ts`
