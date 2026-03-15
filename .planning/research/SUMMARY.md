# Project Research Summary

**Project:** Ledger Of Alpha v2.0 — Intelligence & Automation
**Domain:** AI-enhanced trade journaling platform with broker automation and analytical tools
**Researched:** 2026-03-15
**Confidence:** MEDIUM

## Executive Summary

Ledger Of Alpha v2.0 adds four distinct capability clusters to an already-solid v1.0 foundation: AI chart pattern recognition via GPT-4o Vision, IBKR broker sync, Monte Carlo risk simulation embedded in trade entry, and a Trading Tools Hub with six calculators. The research reveals that the existing Next.js 15 + SQLite architecture is well-suited for all four clusters with minimal structural change — the primary additions are three new npm packages (`openai`, `fast-xml-parser`, `simple-statistics`), three database migrations, and new route/component subtrees. No ORM, no vector database, no job queue, and no stack change is warranted at this scale.

The recommended build order — Tools Hub, then Monte Carlo integration, then AI analysis, then IBKR sync — is driven by dependency isolation and risk. The Tools Hub has zero external dependencies and delivers immediate value, establishing the `/tools` page pattern and `lib/calculators.ts` module. Monte Carlo integration reuses an already-complete engine and modifies only one existing component. AI analysis introduces the only external API requirement (`openai`) and a new DB migration, but the integration is clean. IBKR sync is the most complex due to the socket/gateway architecture — it must go last because architectural decisions (daemon vs. API route, Client Portal API vs. TWS socket) affect deployment model and have the highest rewrite risk.

The top risks are: (1) IBKR's TWS socket API cannot safely live in a Next.js API route — a separate singleton daemon or the REST-based Client Portal API is required; (2) AI vision responses must be structured JSON from day one or the "similar trade finder" feature becomes unbuildable without retroactive re-analysis; and (3) Monte Carlo must run in a Web Worker with debounce or it will freeze the TradeModal on every keystroke. All three risks are well-understood and have clear mitigations documented in PITFALLS.md.

## Key Findings

### Recommended Stack

The existing stack requires only three new production packages. `openai` (^4.x) handles both GPT-4o Vision calls for chart analysis and `text-embedding-3-small` for trade similarity — one package serves two features. `fast-xml-parser` (^4.x) parses IBKR Flex Query XML responses; it becomes unnecessary if the user configures IBKR Flex Query for JSON output. `simple-statistics` (^7.x) provides the Pearson correlation function for the Correlation Matrix calculator. Everything else — Monte Carlo, calculators, IBKR Client Portal REST calls — uses built-ins or existing packages.

**Core new technologies:**
- `openai` (^4.x): GPT-4o Vision for chart analysis + embeddings for trade similarity — server-side API route only, keeps key off client
- `fast-xml-parser` (^4.x): IBKR Flex Query XML parsing — may be skippable if JSON format is available
- `simple-statistics` (^7.x): Pearson correlation for Correlation Matrix — ~20KB, replaces 500KB+ math.js
- Native `File` / `FormData` / `Buffer`: Screenshot upload pipeline — no multer needed, Next.js 15 handles multipart natively

**Explicitly rejected:** vector databases (Pinecone/pgvector), TensorFlow.js/ONNX local models, Bull/BullMQ job queues, Zod, Prisma/Drizzle, sharp, WebSocket servers.

### Expected Features

The four feature clusters have distinct value/complexity profiles. Monte Carlo integration is the highest-value, lowest-complexity feature (engine already exists). The five pure-math calculators are each a half-day build. AI pattern recognition is the core v2.0 differentiator. IBKR sync is the most-demanded but highest-complexity feature.

**Must have (table stakes):**
- AI: Screenshot upload, pattern label + confidence output, store analysis linked to trade
- IBKR: One-time settings setup, manual "Sync Now" trigger, last-sync timestamp display, deduplication by `ibkr_exec_id`
- Monte Carlo: In-modal ruin probability warning, suggested position size, integration with existing position sizer
- Tools Hub: R:R Visualizer, Compound Growth, Drawdown Recovery, Kelly Criterion, Fibonacci (all pure math)

**Should have (differentiators):**
- AI: Similar trade finder by pattern, pattern performance stats (win rate per pattern type)
- IBKR: Live open positions display, conflict resolution UI for manually-entered vs auto-imported trades, IBKR sub-account to Ledger account mapping
- Monte Carlo: Per-strategy filtering (filter historical returns by setup/tag), collapsed-by-default panel with preference persistence
- Tools Hub: Correlation Matrix (most complex — requires OHLCV fetch + Pearson computation), URL-param deep linking per calculator

**Defer to v2.1+:**
- AI: Retroactive labeling of historical trades, setup chart overlay comparison
- IBKR: Real-time position streaming, two-way sync (order entry), automatic background polling
- Monte Carlo: Streak-aware conditioning, full simulation comparison view
- Tools Hub: Options calculators (Black-Scholes, Greeks), save calculator state to DB

### Architecture Approach

All four features integrate cleanly via three extension points: new API route subtrees (`/api/ai/`, `/api/broker/ibkr/`, `/api/simulation/`, `/api/tools/`), new lib modules (`lib/ai-vision.ts`, `lib/ibkr-client.ts`, `lib/calculators.ts`), and new page/component trees (`app/tools/`, `components/tools/`). Existing files that require modification are limited to: `lib/db.ts` (migrations 019-021), `lib/types.ts` (new trade fields), `components/TradeModal.tsx` (AI upload + Monte Carlo panel), `components/dashboard/DashboardShell.tsx` (IBKR widget), and `components/Navbar.tsx` (tools link).

**Major components and responsibilities:**
1. `lib/calculators.ts` — Pure math functions for all six Tools Hub calculators; no React, no side effects; imported directly into client components
2. `lib/ai-vision.ts` — OpenAI client wrapper; base64 encoding, structured JSON prompt, response parsing; called only from server-side API route
3. `lib/ibkr-client.ts` — REST wrapper for IBKR Client Portal API; proxies browser requests to local gateway; never called client-side
4. `components/MonteCarloPreview.tsx` — Compact simulation panel embedded in TradeModal; debounced trigger, Web Worker execution, 1K iterations
5. `components/tools/CorrelationMatrix.tsx` — Sole networked calculator; fetches OHLCV sequentially (not `Promise.all`), caches results, computes Pearson in a Web Worker
6. `components/dashboard/IBKRWidget.tsx` — Live positions panel with connection status, 30s polling, sync-now button

**Key patterns to follow:**
- Stateless API route for compute-heavy operations (Monte Carlo preview, AI response parsing)
- Settings table (existing) for all external service config — namespace with feature prefix (`ibkr_`, `ai_`, `tools_`, `montecarlo_`)
- Inline migration pattern in `lib/db.ts` for all schema changes — every new user-data table must include `user_id TEXT NOT NULL`
- Proxy pattern for IBKR: browser → Next.js API route → IBKR gateway — never browser direct to gateway

### Critical Pitfalls

1. **IBKR TWS socket in API route** — TWS is a stateful socket requiring a persistent EClient. Placing it in a stateless Next.js API route causes race conditions, interleaved responses, and silent failures. Use Client Portal REST API (localhost:5000) instead, which is HTTP-based and fits the proxy pattern. If TWS socket is ever needed (real-time), it must be a separate long-lived Node daemon that writes to SQLite.

2. **Unstructured AI vision output** — Prompting GPT-4o with "describe this chart" returns free-form prose that cannot be queried, aggregated, or used for similar trade matching. Define a strict JSON schema (`{ pattern, timeframe, trend, keyLevels, confidence, notes }`) and enforce it via OpenAI structured outputs / `response_format: json_schema` on the first API call. This cannot be retrofitted without re-analyzing all historical uploads.

3. **Monte Carlo blocking TradeModal main thread** — `runMonteCarlo()` with 5K iterations runs synchronously and takes 200-400ms. Embedded in TradeModal and triggered on price field changes, this freezes input. Solution: Web Worker + 500ms debounce + reduce to 1K iterations for the in-modal preview. The full 5K-iteration run stays on the standalone simulator page.

4. **Monte Carlo using wrong account balance** — When `activeAccountId === null` (All Accounts view), pulling balance from `account_size` settings key computes ruin probability against the wrong number. Always use `selectedAccountId` (the account the trade is assigned to) — never `activeAccountId` — when computing balance for position sizing and simulation.

5. **IBKR duplicate trades on recurring import** — The existing CSV import route does blind inserts with no deduplication. Auto-import must use an `ibkr_exec_id` column with `ON CONFLICT DO NOTHING` semantics. Running import twice on the same day must produce identical trade counts. Any manually-entered trade that matches an IBKR execution should be linkable via a "Link to IBKR" workflow.

## Implications for Roadmap

### Phase 1: Trading Tools Hub

**Rationale:** Zero external dependencies, no new DB migrations, no API keys required. Delivers immediate user value with six calculators. Establishes the `/tools` page pattern, `lib/calculators.ts` module structure, and `components/tools/` component conventions that later phases can learn from. Lowest risk, fastest to ship.

**Delivers:** Six calculators (R:R Visualizer, Compound Growth, Drawdown Recovery, Kelly Criterion, Fibonacci, Correlation Matrix) at `/tools`, with URL-param deep linking.

**Addresses:** All six Tools Hub table-stakes features from FEATURES.md.

**Build sequence within phase:** lib/calculators.ts → app/tools/page.tsx → five pure-math calculators → Navbar update → CorrelationMatrix last (requires OHLCV fetching + sequential request handling).

**Avoids:** Calculator state bleeding into global settings (fully local React state); Yahoo Finance throttling from concurrent OHLCV requests (sequential fetch + cache); UI jank in Correlation Matrix (Web Worker for Pearson computation).

---

### Phase 2: Monte Carlo Entry Integration

**Rationale:** Reuses `lib/simulation.ts` completely unchanged. Modifies only `TradeModal.tsx` and adds one small component (`MonteCarloPreview.tsx`). No new DB migrations, no new API routes required (can call `runMonteCarlo` client-side directly). Low risk, high value. Natural follow-on to Tools Hub as it builds on the "pure computation embedded in UI" pattern established there.

**Delivers:** Ruin probability preview, median outcome, and probability of profit displayed inline in TradeModal when entry price + stop loss are filled. Collapsed by default with preference persistence.

**Addresses:** Monte Carlo table-stakes features (in-modal preview, ruin warning, position size suggestion).

**Implements:** MonteCarloPreview component pattern; Web Worker for simulation execution; debounced trigger; account-scoped balance lookup via `selectedAccountId`.

**Avoids:** Main thread blocking (Web Worker + debounce); wrong-account balance (selectedAccountId, never activeAccountId); thin-data misleading output (20-trade minimum gate with clear messaging).

---

### Phase 3: AI Chart Pattern Recognition

**Rationale:** Introduces the first external API dependency (`OPENAI_API_KEY`), first DB migration in v2.0 (migration 019), and first file-handling requirement. These are meaningfully higher-complexity integration points than Phases 1-2. Building after Tools Hub and Monte Carlo means the team has practiced the routing and component patterns. This is the core v2.0 differentiator — it should ship before IBKR sync.

**Delivers:** Screenshot upload in TradeModal, GPT-4o pattern recognition with structured JSON output, analysis stored to `trades.ai_patterns`, similar trade finder querying stored pattern tags.

**Addresses:** All AI analysis table-stakes features; similar trade finder (differentiator achievable in same phase once analysis is stored).

**Uses:** `openai` npm package (server-side only); `app/api/ai/analyze/route.ts`; migration 019 (`ai_patterns TEXT`, `screenshot_analyzed_at TEXT` on trades).

**Avoids:** Storing images as SQLite BLOBs (analyze-and-discard, store only structured result); unstructured LLM output (enforce JSON schema from day one); API key exposure (never `NEXT_PUBLIC_`, server route only); guest mode API credit burn (`isGuest()` check + rate limiting); 413 upload errors (client-side JPEG compression + explicit size validation before upload).

---

### Phase 4: IBKR Broker Sync

**Rationale:** Most complex phase — requires external process dependency (IBKR gateway), two DB migrations (020 for `ibkr_exec_id`, 021 for settings keys), a new Settings tab, and a new Dashboard widget. Must go last because an architecture mistake here (TWS socket in API route) requires a fundamental redesign. By Phase 4, all simpler patterns are established and the team understands the codebase integration points fully.

**Delivers:** IBKR Client Portal API integration with manual sync trigger, live positions widget, deduplication by exec ID, last-sync timestamp, IBKR account-to-Ledger account mapping, and "Broker" settings tab.

**Addresses:** IBKR sync table-stakes features; live open positions display (differentiator achievable within phase); account mapping UI.

**Uses:** Native `fetch` for Client Portal REST API; `fast-xml-parser` if JSON format unavailable from Flex Query; migrations 020-021.

**Avoids:** TWS socket in API route (use Client Portal REST + proxy pattern); blind inserts (ibkr_exec_id + ON CONFLICT DO NOTHING); pacing violations (5-minute minimum poll interval, circuit breaker on error 162); account mapping failure (pending_imports state for unmapped IBKR sub-accounts).

---

### Phase Ordering Rationale

- **Dependencies drive order:** Tools Hub has none; Monte Carlo reuses existing engine; AI requires one new package + migration; IBKR requires the most moving parts and an external process.
- **Risk isolation:** The two highest-risk features (IBKR architecture, AI structured output) go in later phases after simpler patterns are validated.
- **Pitfall timing:** Critical IBKR pitfalls (socket vs. REST, deployment architecture) are architectural — they must be locked down before any IBKR code is written, making Phase 4 the right time after all other context is established.
- **Value delivery:** Each phase independently ships user-visible features. Phase 1 unlocks calculators immediately; Phase 2 improves the most-used modal; Phase 3 ships the headline AI feature; Phase 4 completes the automation story.

### Research Flags

Phases likely needing deeper research or validation during planning:

- **Phase 3 (AI Analysis):** Verify OpenAI `response_format: json_schema` is available for `gpt-4o` at the exact model version being used. Verify the 4.5MB Next.js App Router body limit behavior (may differ from the 4.5MB Pages Router limit). Validate that `request.formData()` in App Router handles large multipart uploads without explicit config.
- **Phase 4 (IBKR Sync):** Verify current IBKR Client Portal API gateway auth flow (OAuth session tickle requirements change between IBKR releases). Confirm Flex Query JSON output option availability in current IBKR accounts. Verify `ibkr-flex-webquery` npm package is maintained and supports current IBKR endpoint format.

Phases with standard, well-documented patterns (can skip `/gsd:research-phase`):

- **Phase 1 (Tools Hub):** Pure math + React state + recharts — all fully established patterns with no external unknowns.
- **Phase 2 (Monte Carlo):** Existing engine in `lib/simulation.ts` is already validated. Web Worker pattern in Next.js 15 is well-documented. No external APIs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | `openai`, `fast-xml-parser`, `simple-statistics` are well-established; IBKR Flex Query package version needs npm verification before pinning |
| Features | MEDIUM | Calculator formulas are HIGH confidence (established math); IBKR API capabilities are MEDIUM (external service, verify against current docs); AI vision pattern accuracy requires prompt engineering validation |
| Architecture | HIGH | Derived from direct codebase reading; integration points are concrete; patterns follow existing codebase conventions exactly |
| Pitfalls | MEDIUM-HIGH | Monte Carlo and multi-account scope pitfalls are HIGH (confirmed from reading source); IBKR TWS socket pitfalls are MEDIUM (architecture is well-established, specific SDK behavior may vary); Next.js App Router body limit specifics need verification |

**Overall confidence:** MEDIUM — sufficient to begin roadmap and requirements definition. Key uncertainties are in external API specifics (IBKR, OpenAI), not in the core architecture or feature set.

### Gaps to Address

- **OpenAI model availability:** Verify `gpt-4o` is the current recommended model for vision tasks (vs `gpt-4o-mini` for cost, or a newer model) before implementation. Research flag for Phase 3.
- **Next.js 15 App Router multipart body limit:** The 4.5MB limit applies to Pages Router. App Router behavior with `request.formData()` for large files needs verification against current Next.js 15 docs before assuming no config is needed.
- **IBKR Flex Query JSON format:** Research file notes this may allow skipping `fast-xml-parser` entirely. Verify in an actual IBKR account during Phase 4 planning.
- **IBKR Client Portal gateway auth session handling:** The gateway requires periodic session tickling (keepalive). The polling interval and session management specifics should be validated against current IBKR documentation before the IBKR implementation phase begins.
- **Web Worker in Next.js 15 App Router:** Verify the `new Worker(new URL(..., import.meta.url))` pattern works correctly with Next.js 15's webpack config and `output: "standalone"` mode. This affects both Monte Carlo (Phase 2) and Correlation Matrix (Phase 1).

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `lib/simulation.ts`, `lib/db.ts`, `lib/types.ts`, `lib/broker-parsers.ts`, `components/TradeModal.tsx`, `app/analytics/page.tsx`, `middleware.ts`, `next.config.ts` — architecture patterns and integration points
- Calculator formulas (Kelly, Fibonacci, compound growth, drawdown recovery) — established financial mathematics

### Secondary (MEDIUM confidence)
- Training knowledge (cutoff August 2025): `openai` npm package patterns, `fast-xml-parser` usage, `simple-statistics` API — confirm versions with `npm info <package> version` before pinning
- IBKR Client Portal API (REST): documented at ibkrcampus.com — verify current gateway auth flow and endpoint paths
- OpenAI GPT-4o Vision API structured outputs — verify `response_format: json_schema` availability for selected model at implementation time
- Next.js 15 App Router body size behavior with `request.formData()` — verify against Next.js 15 official docs

### Tertiary (LOW confidence)
- `ibkr-flex-webquery` npm package — thin wrapper around IBKR's Flex Web Query endpoint; verify package is maintained and version is current before using
- IBKR pacing violation specifics (error code 162, 10-minute backoff) — based on training data; verify against current IBKR API documentation

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
