# Technology Stack — v2.0 New Capabilities

**Project:** Ledger Of Alpha v2.0 — Intelligence & Automation
**Researched:** 2026-03-15
**Scope:** NEW libraries only. Existing stack (Next.js 15, TypeScript, SQLite, Recharts, lightweight-charts, @dnd-kit, next-themes, lucide-react, jose) is validated and unchanged.

---

## Confidence Note

External search tools were unavailable during this research session. All findings are based on training knowledge (cutoff August 2025). Confidence levels reflect source quality: HIGH = well-established APIs with stable versioning at cutoff; MEDIUM = established but evolving; LOW = verify before pinning version.

---

## Recommended Additions by Feature Area

### 1. AI Chart Pattern Recognition

#### Core: AI Vision API Client

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `openai` | `^4.x` | GPT-4o vision API client for image analysis | HIGH |

**Why OpenAI over Anthropic SDK or Google Vision:**

GPT-4o (multimodal) is the strongest choice for chart pattern recognition because:
- Superior spatial reasoning for candlestick/chart interpretation vs. Claude Sonnet at same cost tier
- `openai` npm package is the industry-standard client with stable Node.js/Next.js support
- API Route in Next.js (server-side) keeps the API key off the client and avoids CORS
- No GPU required — cloud inference, fits the "no GPU" constraint

**Why NOT local models (TensorFlow.js, ONNX, transformers.js):**
- Minimum viable vision model for chart analysis is 1-7B parameters — too slow on CPU for real-time use
- Model weights (1–4 GB) cannot be bundled with a Next.js app or SQLite deployment
- Adds massive dependency surface; contradicts "no stack changes" constraint

**Why NOT Google Cloud Vision:**
- Optimized for OCR and object detection, not financial chart semantic understanding
- Would still need a second LLM call to interpret detected objects as trading patterns

#### Image Upload Handling

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Native `File` / `FormData` (browser) | — | Screenshot upload from client | HIGH |
| Next.js Route Handler (`app/api/...`) | existing | Receive multipart/form-data, forward to OpenAI | HIGH |
| Node.js `Buffer` | built-in | Convert uploaded file to base64 for OpenAI API | HIGH |

**No additional library needed.** Next.js 15 Route Handlers accept `request.formData()` natively. Convert the file buffer to base64 and pass it to `openai.chat.completions.create()` with `image_url: data:image/...;base64,...`.

File size constraint: OpenAI Vision accepts images up to 20 MB. Screenshots are typically under 2 MB — no compression library needed.

#### Similar Trade Matching (Vector Similarity)

The "similar trade finder" compares chart screenshots or trade metadata across history. Two viable approaches:

| Approach | Libraries | When to Use |
|----------|-----------|-------------|
| **Embedding + cosine similarity** (recommended) | `openai` (embeddings API) — no new package | Best semantic matching; use `text-embedding-3-small` on trade notes/metadata |
| Pixel hash matching | `sharp` + custom hash | Only if comparing raw screenshots; far less semantic value |

**Recommendation:** Use OpenAI `text-embedding-3-small` on the concatenated trade metadata (setup notes, ticker, direction, outcome) stored in SQLite. Embeddings are stored as JSON blobs in a new `trade_embeddings` column. Cosine similarity is computed in JavaScript (no new library — 10 lines of math). This keeps everything in SQLite with no vector database dependency (scale doesn't justify Pinecone/pgvector for a solo trader app).

**Confidence:** MEDIUM — embedding approach is well-established; verify `text-embedding-3-small` is still the recommended small model at implementation time.

---

### 2. IBKR/TWS Broker Sync

#### Primary Option: TWS API via ibkr-flex-webquery (Scheduled Import)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `ibkr-flex-webquery` | `^1.x` | Fetch IBKR Flex Query reports via HTTP (no TWS running) | MEDIUM |

**Why Flex Query over TWS Socket API:**

The TWS Socket API (`@stoqey/ib` or raw socket connection to port 7496/7497) requires TWS or IB Gateway to be running locally on the trader's machine. This creates a hard operational dependency — the app breaks if TWS is closed. The IBKR Client Portal API (REST, port 5000) has the same local-gateway requirement.

IBKR Flex Web Query is a REST endpoint that IBKR hosts. The user configures a Flex Query in their IBKR account (one-time setup), saves a token + query ID in the app's settings, and the app polls IBKR's servers on a schedule. No local TWS required. Returns XML/JSON with full trade history.

**Tradeoff:** Not real-time (15-min to 24-hour delay depending on IBKR plan). For a trade journal, this is acceptable — traders review fills after the fact. True real-time requires TWS.

**If real-time TWS sync is required (future):**

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@stoqey/ib` | `^1.x` | TWS Socket API wrapper for Node.js | MEDIUM |

`@stoqey/ib` wraps the official IBKR Java API in a typed Node.js interface. It connects to TWS/Gateway on localhost:7496. The Next.js API route would need to maintain a persistent socket — this is incompatible with serverless deployment but works for `next start` / Docker. Recommend deferring this to a later phase and shipping Flex Query first.

**XML Parsing for Flex Query Response:**

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `fast-xml-parser` | `^4.x` | Parse IBKR Flex Query XML responses | HIGH |

`fast-xml-parser` is the standard lightweight XML parser for Node.js. No DOM dependency. Zero config for the attribute-heavy IBKR XML format. Already in common use with financial APIs.

**Alternative:** IBKR also offers JSON output from Flex Query (configurable). If JSON is available, `JSON.parse()` is sufficient and `fast-xml-parser` is not needed. Verify in IBKR account settings — if JSON format is supported, skip the XML parser entirely.

**Polling / Scheduling:**

No new library needed. Use `setInterval` in a long-lived Next.js API route, or trigger sync on user action (button press). For the v2.0 scope, user-triggered sync (poll on demand) is simpler and avoids background process complexity.

---

### 3. Monte Carlo in Trade Entry

**No new libraries needed.** `lib/simulation.ts` already contains the full Monte Carlo engine. The integration work is UI-only:

- Import `runMonteCarlo` from `lib/simulation.ts` into the `TradeModal.tsx` component
- Run simulation client-side with the account's historical P&L returns (already available via the trades API)
- Display outcome distribution and ruin probability inline in the modal

The simulation runs synchronously and completes in ~50ms for 5,000 iterations — no async, no worker thread, no new dependencies needed.

**One consideration:** If the historical returns array needs to be loaded from the API during modal open, this is a single `fetch` call to the existing `/api/trades` endpoint. No new infrastructure.

---

### 4. Trading Tools Hub

All six calculators (R:R Visualizer, Compound Growth, Drawdown Recovery, Kelly Criterion, Fibonacci, Correlation Matrix) are pure math — no external library is strictly required. However, two calculators benefit from a library:

#### Correlation Matrix

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `simple-statistics` | `^7.x` | Pearson correlation, mean, standard deviation | HIGH |

`simple-statistics` is a zero-dependency, browser-compatible statistics library. It provides `sampleCorrelation(x, y)` for the correlation matrix computation. Alternative is implementing Pearson correlation manually (~15 lines) — both are valid. Recommend `simple-statistics` for correctness and future expansion (additional stat tools).

**Why NOT math.js:** math.js is 500KB+ minified. Overkill for six calculators. `simple-statistics` is ~20KB.
**Why NOT d3-array:** d3 modules are fine but introduce d3 conventions; `simple-statistics` is more readable for stat-focused code.

#### R:R Visualizer

No library needed. The visual is a horizontal bar or number line rendered with Tailwind/SVG inline. Recharts (already installed) can render a simple bar if needed.

#### Fibonacci Calculator

No library needed. Pure math — Fibonacci levels are static ratios (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0) applied to a high/low range. ~10 lines of JavaScript.

#### Compound Growth, Drawdown Recovery, Kelly Criterion

All pure arithmetic formulas. No library.

---

## Complete New Dependencies

```bash
# Production dependencies to add
npm install openai fast-xml-parser simple-statistics

# Type definitions
npm install -D @types/simple-statistics
```

Note: `openai` and `fast-xml-parser` ship their own TypeScript types. `simple-statistics` requires `@types/simple-statistics`.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI Vision | `openai` (GPT-4o) | `@anthropic-ai/sdk` (Claude) | Claude vision is comparable but GPT-4o has stronger chart spatial reasoning and is the industry default for this use case |
| AI Vision | `openai` (GPT-4o) | Local ONNX/TF.js model | Too heavy for CPU, no GPU constraint, unacceptable latency |
| IBKR Sync | Flex Query REST + `fast-xml-parser` | TWS Socket API (`@stoqey/ib`) | TWS Socket requires local TWS running; Flex Query needs no local process |
| Statistics | `simple-statistics` | `mathjs` | math.js is 25x larger, overkill for correlation + basic stats |
| Embeddings storage | SQLite JSON column | Pinecone / pgvector | Solo trader scale doesn't justify a vector database; cosine similarity in JS is sufficient |
| Image compression | `sharp` | None (no compression) | Screenshots are under 2 MB; OpenAI 20 MB limit not an issue |

---

## Integration Points in Existing Codebase

| New Capability | Integration Point | Notes |
|----------------|------------------|-------|
| AI Vision API call | New `app/api/ai/analyze-chart/route.ts` | Server-side only; API key in `.env.local` |
| Trade embeddings | New column on `trades` table via inline migration in `lib/db.ts` | JSON blob, computed on trade save |
| IBKR Flex credentials | New settings keys (`ibkr_flex_token`, `ibkr_flex_query_id`) via existing `/api/settings` | User configures in Settings page |
| IBKR sync endpoint | New `app/api/broker/ibkr-sync/route.ts` | Calls Flex Query, parses XML, calls existing trade import logic |
| Monte Carlo in modal | Import `runMonteCarlo` in `components/TradeModal.tsx` | Client-side; no API call needed if returns passed as prop |
| Tools Hub page | New `app/tools/page.tsx` + `components/tools/` directory | Static calculators, no API routes needed |
| Correlation Matrix data | Fetch from existing `/api/trades` endpoint | Compute correlations client-side |

---

## Environment Variables to Add

```bash
# .env.local additions
OPENAI_API_KEY=sk-...          # Required for AI chart analysis + embeddings
OPENAI_MODEL=gpt-4o            # Override for model selection (optional, default gpt-4o)
```

No additional environment variables needed for IBKR (credentials stored in settings table per-user) or calculators (pure client-side).

---

## What NOT to Add

| Temptation | Why to Avoid |
|------------|-------------|
| Vector database (Pinecone, Qdrant, pgvector) | Solo trader data volume; SQLite + JS cosine similarity is sufficient |
| WebSocket server for real-time IBKR | Requires persistent process incompatible with Next.js serverless model; defer to v3.0 |
| TensorFlow.js / ONNX Runtime | Local vision models too large and slow without GPU |
| `bull` / `bullmq` job queue | No background jobs needed; user-triggered sync is sufficient |
| `zod` for input validation | Project uses inline validation (validate-trade.ts); consistent to extend that pattern |
| `prisma` / `drizzle` ORM | Project uses raw better-sqlite3 with inline migrations; no ORM change justified |
| `multer` for file uploads | Next.js 15 Route Handlers handle multipart natively via `request.formData()` |
| `sharp` for image processing | No server-side image resizing needed; pass screenshot directly to OpenAI |

---

## Sources

- Training knowledge (cutoff August 2025) — HIGH confidence for `openai` npm package patterns, `fast-xml-parser`, `simple-statistics`
- IBKR Flex Web Query: documented API, no library required for HTTP call; `ibkr-flex-webquery` is a thin wrapper — MEDIUM confidence on exact package version
- External verification tools unavailable during this research session; verify package versions with `npm info <package> version` before pinning
