# Phase 10: AI Chart Pattern Recognition - Research

**Researched:** 2026-03-17
**Domain:** OpenAI GPT-4o Vision API, Next.js file upload, filesystem image storage, SQLite migration
**Confidence:** HIGH (core API patterns), MEDIUM (prompt engineering specifics)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Screenshot capture flow**
- Manual file upload via drag-and-drop or click-to-browse file picker
- Supports PNG, JPG, WebP; max 5MB
- Upload available on both Chart page (inside the right-side trade panel) and Analytics page
- Analyze-first, link-to-trade-later workflow — screenshots are not auto-associated with a trade; user links after analysis when ready
- Users can delete uploaded screenshots
- Multiple screenshots per trade supported (e.g., daily + 15m charts, before/after)

**AI analysis trigger**
- Manual "Analyze" button — not auto-triggered on upload
- Upload shows preview thumbnail with file size, Analyze button, and Remove button
- Analysis takes 2-3 seconds via GPT-4o; show loading state
- Users can re-analyze a screenshot later

**Pattern detection**
- Core price action patterns (auto-detected on Analyze):
  - Head & Shoulders / Inverse Head & Shoulders
  - Bull Flag / Bear Flag
  - Ascending / Descending Triangle
  - Rising / Falling Wedge
  - Double Top / Double Bottom
  - Cup & Handle
  - Channel (up/down/sideways)
- Results shown as ranked list (top 2-3 patterns) with confidence bars and brief descriptions
- User can tag the primary pattern on the trade from the results

**Follow-up AI questions**
- Quick prompt buttons for common asks: "Supply/Demand Zones", "Support/Resistance Levels", "Trend Direction"
- Freeform text input for custom questions
- AI responds inline below the initial pattern results
- All follow-up Q&A stored on the trade record alongside initial analysis — full history preserved

**Similar trade finder**
- Similarity defined by same primary pattern type
- Analytics page gets a "Pattern Performance" section:
  - Breakdown table per pattern type: trade count, win rate, avg P&L
  - Click a pattern row to see filtered list of individual trades
- AI analysis panel shows brief inline hint after pattern detection: "You've traded this pattern X times (Y% win rate)"
- Only AI-analyzed trades included in pattern stats (no manual tagging)

**Image storage**
- Local filesystem: `data/screenshots/` directory alongside SQLite DB
- Served via Next.js API route (`/api/screenshots/[filename]`)
- Thumbnails generated for preview (webp)

**API key configuration**
- OpenAI API key entered in Settings page (similar to existing FMP API key pattern)
- Stored in settings DB
- User controls their own API costs
- UI shows masked key with eye toggle, link to platform.openai.com

### Claude's Discretion
- Exact GPT-4o prompt engineering for pattern detection
- Thumbnail size and compression settings
- Confidence score thresholds for displaying patterns (minimum cutoff)
- Loading/error state UI details
- Exact placement within trade panel sidebar
- Analytics page section positioning relative to existing content
- File naming convention for screenshots
- How "link to trade" picker works (dropdown, search, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | User can upload a chart screenshot from the trade view | File upload via `request.formData()` in Next.js App Router API route; filesystem write to `data/screenshots/`; drag-and-drop via HTML5 File API |
| AI-02 | AI identifies chart patterns (H&S, flags, wedges, triangles) with confidence scores | GPT-4o vision API with `json_schema` response_format; base64 image encoding; structured JSON output with pattern name + confidence float |
| AI-03 | Analysis results are stored and linked to the trade record | Migration 019 adds `ai_patterns` (JSON), `ai_screenshots` (JSON), `ai_qa_history` (JSON) columns to trades; PATCH trade endpoint |
| AI-04 | User can find similar past trades by AI-detected pattern type | Query trades WHERE `ai_patterns` JSON contains primary pattern type; client-side filter or SQL JSON function |
| AI-05 | User can view aggregate performance stats per pattern type (win rate, avg P&L) | Derive stats from closed trades with `ai_patterns` data; new PatternPerformance component on Analytics page |
</phase_requirements>

---

## Summary

Phase 10 integrates GPT-4o vision into Ledger Of Alpha so traders can upload chart screenshots, receive AI-identified pattern labels with confidence scores, ask follow-up questions, link results to trades, and view aggregate pattern performance. The implementation spans: a new file upload API, a server-side OpenAI client wrapper, three new API routes (upload/serve/analyze/followup), a DB migration adding AI fields to trades, UI additions to the Chart page trade panel and Analytics page, and a new Settings section for the OpenAI API key.

The core technical decisions are already locked: GPT-4o via the `openai` npm package (server-side only), local filesystem for image storage at `data/screenshots/`, structured JSON output enforced from day one. The main engineering work is wiring together the Next.js App Router file upload pattern, the OpenAI Chat Completions API with vision + structured output, and storing the resulting JSON on the trade record.

The key risk is prompt engineering: GPT-4o's pattern detection quality depends heavily on prompt specificity. The model is capable of identifying standard chart patterns but returns hallucinated confidence scores unless the prompt constrains the output format precisely. Research recommends using `response_format: { type: "json_schema", json_schema: { strict: true, ... } }` rather than `json_object` to guarantee schema adherence, and using the `high` detail parameter for chart images to preserve visual fidelity.

**Primary recommendation:** Use `openai` npm package with `chat.completions.create()` passing `response_format: { type: "json_schema" }` and base64-encoded image data. Store structured JSON output directly in SQLite TEXT columns. No external thumbnail library needed — use browser `canvas` for client-side thumbnail generation before upload.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^4.x (latest ~6.31.0) | OpenAI API client for GPT-4o vision calls | Official OpenAI Node.js SDK; server-side only per architecture decision |
| `fs/promises` (Node built-in) | Node 18+ | Save uploaded files to `data/screenshots/` | No extra dep; same pattern as `lib/db.ts` using `process.cwd()` |
| `path` (Node built-in) | Node 18+ | Construct safe file paths | Same as db.ts DATA_DIR pattern |
| `crypto` (Node built-in) | Node 18+ | `randomUUID()` for screenshot filenames | Already used in migration 015 for account IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sharp` | ^0.33 | Server-side thumbnail generation to WebP | Only if thumbnails must be generated server-side; see note below |

**Thumbnail note:** The CONTEXT.md says "thumbnails generated for preview (webp)." The simplest approach is client-side canvas resizing before upload (no new server dep). If server-side thumbnail generation is preferred, `sharp` is the standard for Node.js — it is already implicitly available because Next.js bundles it for the `<Image>` component. However, adding `sharp` as an explicit dependency for this use case adds complexity. Recommendation: generate thumbnails client-side in the browser using `<canvas>` (draw the image at 300px max width, `toBlob('image/webp', 0.7)`) and upload both files, OR skip separate thumbnails entirely and serve the original with CSS `object-fit: cover` at thumbnail dimensions.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `openai` npm | raw `fetch` to OpenAI API | openai npm handles streaming, retries, type safety; use it |
| `json_schema` structured output | `json_object` mode + manual parsing | `json_schema` with `strict: true` guarantees schema adherence; `json_object` only guarantees valid JSON — patterns could be missing or mis-typed |
| Filesystem storage | SQLite BLOB storage | Filesystem is simpler for large binaries; consistent with project's `data/` pattern |

### Installation
```bash
npm install openai
```

No other new dependencies required. `fs`, `path`, `crypto` are Node.js built-ins. Sharp is already in Next.js but avoid adding as explicit dep unless needed.

---

## Architecture Patterns

### Recommended Project Structure
```
app/api/
├── screenshots/
│   ├── route.ts           # POST: upload + save file; GET: list (not needed)
│   └── [filename]/
│       └── route.ts       # GET: serve file; DELETE: delete file
├── ai/
│   ├── analyze/
│   │   └── route.ts       # POST: GPT-4o pattern analysis
│   └── followup/
│       └── route.ts       # POST: follow-up Q&A

lib/
└── ai-vision.ts           # OpenAI client wrapper, prompt templates, output types

components/
└── ai/
    ├── ScreenshotUploader.tsx    # Drag-drop zone + preview thumbnails
    ├── PatternResults.tsx        # Ranked pattern list with confidence bars
    ├── FollowUpChat.tsx          # Quick chips + freeform input + Q&A history
    └── PatternPerformance.tsx    # Analytics page: per-pattern stats table
```

### Pattern 1: Next.js App Router File Upload
**What:** Accept multipart form data in an API route using the native `request.formData()` method, validate file type/size, write to disk using `fs/promises`.
**When to use:** All screenshot upload operations.
**Example:**
```typescript
// app/api/screenshots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSessionUser } from "@/lib/auth";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Validate
  const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const filename = `${user.id}-${crypto.randomUUID()}.${ext}`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return NextResponse.json({ filename, url: `/api/screenshots/${filename}` });
}
```

### Pattern 2: Serving Uploaded Images via API Route
**What:** Read file from disk and return as streamed Response with correct Content-Type.
**When to use:** `GET /api/screenshots/[filename]` — serving uploaded chart screenshots.
**Example:**
```typescript
// app/api/screenshots/[filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Security: only allow files belonging to this user
  const { filename } = params;
  if (!filename.startsWith(user.id + "-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filepath = path.join(SCREENSHOTS_DIR, filename);
  try {
    const buffer = await readFile(filepath);
    const ext = path.extname(filename).slice(1);
    const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
    return new Response(buffer, { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // ... validate ownership, unlink file, update trade record
}
```

### Pattern 3: GPT-4o Vision with Structured JSON Output
**What:** Send base64-encoded image to GPT-4o with a strict JSON schema, receive structured pattern analysis.
**When to use:** `POST /api/ai/analyze` endpoint.
**Example:**
```typescript
// lib/ai-vision.ts
import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

export interface PatternResult {
  name: string;           // e.g. "Bull Flag"
  confidence: number;     // 0.0 – 1.0
  description: string;    // 1-2 sentence explanation
}

export interface AnalysisResult {
  patterns: PatternResult[];   // top 2-3, sorted by confidence desc
  primary_pattern: string;     // patterns[0].name
  summary: string;             // overall chart context sentence
}

const PATTERN_NAMES = [
  "Head & Shoulders", "Inverse Head & Shoulders",
  "Bull Flag", "Bear Flag",
  "Ascending Triangle", "Descending Triangle",
  "Rising Wedge", "Falling Wedge",
  "Double Top", "Double Bottom",
  "Cup & Handle", "Channel Up", "Channel Down", "Sideways Channel",
  "None Detected"
];

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", enum: PATTERN_NAMES },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          description: { type: "string" }
        },
        required: ["name", "confidence", "description"],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 3
    },
    primary_pattern: { type: "string", enum: PATTERN_NAMES },
    summary: { type: "string" }
  },
  required: ["patterns", "primary_pattern", "summary"],
  additionalProperties: false
};

export async function analyzeChartScreenshot(
  apiKey: string,
  filename: string
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey });
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  const imageBuffer = await readFile(filepath);
  const base64 = imageBuffer.toString("base64");

  // Determine MIME type from extension
  const ext = path.extname(filename).slice(1);
  const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert technical analyst. Analyze this trading chart screenshot and identify the top price action patterns present. For each pattern you detect, assign a confidence score from 0.0 to 1.0. Only return patterns with confidence >= 0.3. If you cannot identify any pattern with confidence >= 0.3, return a single entry with name "None Detected" and confidence 0.0. Return at most 3 patterns, sorted by confidence descending. The primary_pattern field should match patterns[0].name.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${base64}`,
              detail: "high"
            }
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "chart_analysis",
        strict: true,
        schema: ANALYSIS_SCHEMA
      }
    },
    max_tokens: 800
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as AnalysisResult;
}

export async function askFollowUp(
  apiKey: string,
  filename: string,
  question: string,
  priorAnalysis: AnalysisResult
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  const imageBuffer = await readFile(filepath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(filename).slice(1);
  const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "assistant",
        content: `I analyzed this chart and detected: ${priorAnalysis.summary}`
      },
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}`, detail: "high" } }
        ]
      }
    ],
    max_tokens: 500
  });

  return response.choices[0].message.content ?? "";
}
```

### Pattern 4: DB Migration 019 — AI Fields on Trades
**What:** Add new TEXT columns to the trades table for AI data storage as JSON strings.
**When to use:** DB init on first startup after deploy.
```typescript
// In lib/db.ts, inside runMigrations():
if (!hasMigration(db, "019_ai_analysis")) {
  const cols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
  if (!cols.includes("ai_patterns")) {
    // JSON: AnalysisResult object or null
    db.exec(`ALTER TABLE trades ADD COLUMN ai_patterns TEXT;`);
  }
  if (!cols.includes("ai_screenshots")) {
    // JSON: string[] of filenames
    db.exec(`ALTER TABLE trades ADD COLUMN ai_screenshots TEXT;`);
  }
  if (!cols.includes("ai_qa_history")) {
    // JSON: Array<{ question: string; answer: string; ts: string }>
    db.exec(`ALTER TABLE trades ADD COLUMN ai_qa_history TEXT;`);
  }
  if (!cols.includes("ai_primary_pattern")) {
    // Denormalized string for fast SQL queries — derived from ai_patterns
    db.exec(`ALTER TABLE trades ADD COLUMN ai_primary_pattern TEXT;`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trades_ai_pattern ON trades(ai_primary_pattern);`);
  }
  markMigration(db, "019_ai_analysis");
}
```

**Key insight:** Store `ai_primary_pattern` as a separate indexed TEXT column in addition to the full `ai_patterns` JSON. This makes the SQL query for similar trades (`WHERE ai_primary_pattern = ?`) fast without JSON parsing in SQL. SQLite's JSON functions exist but are less ergonomic than a denormalized column.

### Pattern 5: Settings API Key Pattern (Mirror FMP)
**What:** OpenAI API key stored as `openai_api_key` in user settings, following the exact pattern of `fmp_api_key`.
**When to use:** Settings page "Integrations" tab — add an "AI Analysis" section below FMP.

DB: key `openai_api_key`, value = the raw key string, stored per-user in settings table.
API retrieval: Same `getUserSettings()` call that all routes already use.
UI: Follow the existing FMP section pattern in `app/settings/page.tsx` — `type="password"` input with Eye/EyeOff toggle.

### Anti-Patterns to Avoid
- **Calling OpenAI from the client:** Never put the API key in client-side code. All OpenAI calls go through `/api/ai/` server routes.
- **`json_object` mode instead of `json_schema`:** `json_object` only guarantees valid JSON; the model may omit fields, use wrong types, or invent pattern names outside the allowed enum. Use `json_schema` with `strict: true`.
- **Storing full image data in SQLite:** Images in BLOB columns bloat the DB and complicate backups. Keep images in `data/screenshots/`, store only filenames in the DB.
- **Auto-triggering analysis on upload:** User decision is manual trigger — do not call OpenAI on file save. The API key may not be set, and users need to review uploads before incurring cost.
- **Path traversal in screenshot serving:** Always validate that the requested filename starts with `user.id + "-"` before serving. Never join arbitrary user-provided filenames to SCREENSHOTS_DIR.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI API client | Custom fetch wrapper | `openai` npm package | Handles retries, streaming, type-safe responses, auth headers |
| JSON schema validation of AI output | Manual field checking | `response_format: json_schema` with `strict: true` | Schema adherence is guaranteed by the model; no runtime validation layer needed |
| Image type detection | MIME sniffing from buffer magic bytes | Check `file.type` from FormData (browser sets it) + whitelist | Simple and sufficient; never trust file extension alone |
| Similar trade DB query | Complex JSON function SQL | Denormalized `ai_primary_pattern` indexed column | Fast indexed lookup; SQLite JSON functions work but are verbose |
| Confidence visualization | Custom SVG progress bar | Standard HTML `<div>` with percentage width + Tailwind colors | Simpler, dark-mode compatible, matches existing component style |

**Key insight:** The OpenAI SDK's `json_schema` structured output eliminates an entire class of bugs. The model literally cannot return a response that violates the schema when `strict: true`. This is the correct approach per the architecture decision "structured JSON output enforced from day one."

---

## Common Pitfalls

### Pitfall 1: API Key Not Set — No Clear Error
**What goes wrong:** User clicks Analyze; the request hits `/api/ai/analyze`; `openai_api_key` is empty; OpenAI throws an authentication error; the UI shows a generic "Error" message.
**Why it happens:** Settings API key was never saved, or user is on a fresh account.
**How to avoid:** In the analyze route, check for `openai_api_key` before calling OpenAI. Return a specific 400 with `{ error: "OpenAI API key not configured", code: "NO_API_KEY" }`. The UI should show a settings link when it receives this code.
**Warning signs:** 401 error from OpenAI vs. the custom 400 — distinguish by checking before calling.

### Pitfall 2: Image Too Large for OpenAI API
**What goes wrong:** User uploads a 5MB screenshot; the base64 payload is 6.7MB; combined with the prompt this exceeds GPT-4o's image size limit or causes slow requests.
**Why it happens:** 5MB images are large for vision APIs. High detail mode with a 5MB image generates many tiles (170 tokens each).
**How to avoid:** The 5MB client-side limit prevents the worst cases. Additionally, consider client-side canvas resizing to max 1920×1080 before upload — this dramatically reduces token cost while preserving pattern visibility. Use `detail: "high"` for chart images; the additional detail is worth it for pattern recognition.
**Warning signs:** Requests taking >10 seconds, OpenAI returning token limit errors.

### Pitfall 3: Path Traversal Attack on Screenshot Serving
**What goes wrong:** Malicious request to `GET /api/screenshots/../../../etc/passwd` reads sensitive server files.
**Why it happens:** Naively joining `SCREENSHOTS_DIR + params.filename` without sanitization.
**How to avoid:** Validate that `filename` matches a strict pattern (alphanumeric, hyphens, dots only; no slashes). Also verify it starts with `user.id + "-"` to scope to the authenticated user's files.

### Pitfall 4: Analyze-First Flow Without Trade Linking — Orphaned Screenshots
**What goes wrong:** User uploads and analyzes screenshots but never links them to a trade. Files accumulate in `data/screenshots/` indefinitely.
**Why it happens:** The "analyze-first, link-later" flow means screenshots may never be associated.
**How to avoid:** Store unlinked screenshots with a `pending` state tracking. Consider a periodic cleanup (or manual admin cleanup) for screenshots older than 30 days that have no trade association. For Phase 10, accept orphaned files as a known limitation and document for Phase 11+.

### Pitfall 5: Re-analyzing Overwrites QA History
**What goes wrong:** User re-analyzes a screenshot after asking follow-up questions; the QA history stored on the trade is overwritten by the new analysis.
**Why it happens:** Naive implementation replaces the entire `ai_patterns` + `ai_qa_history` JSON on re-analyze.
**How to avoid:** On re-analyze: replace `ai_patterns` and `ai_primary_pattern`, but preserve (or optionally clear) `ai_qa_history`. The UI should warn "Re-analyzing will clear Q&A history" or preserve history with a timestamp marker.

### Pitfall 6: Confidence Scores Are Not Objective Probabilities
**What goes wrong:** GPT-4o returns confidence: 0.9 for a pattern but the actual pattern is not present; users treat these as ground truth.
**Why it happens:** LLMs produce confidence scores that reflect linguistic certainty, not calibrated probabilities. They hallucinate confidently.
**How to avoid:** UI copy: "AI confidence" not "accuracy". Show only the top patterns (threshold >= 0.3). Encourage users to verify patterns visually. Do not block trading decisions on AI pattern detection alone.

---

## Code Examples

Verified patterns from research:

### GPT-4o Vision Call with Base64 Image (Core Pattern)
```typescript
// Source: OpenAI official SDK + getstream.io GPT-4o Vision Guide
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Analyze this chart..." },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${base64Image}`,
          detail: "high"  // use high for chart pattern recognition
        }
      }
    ]
  }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "chart_analysis",
      strict: true,
      schema: ANALYSIS_SCHEMA  // see lib/ai-vision.ts pattern above
    }
  },
  max_tokens: 800
});
const result = JSON.parse(response.choices[0].message.content!);
```

### File Upload in Next.js App Router (No External Libraries)
```typescript
// Source: Next.js App Router docs + multiple verified blog posts
export async function POST(req: NextRequest) {
  const formData = await req.formData();          // native App Router feature
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);              // fs/promises.writeFile
}
```

### Client-Side Drag-Drop Upload Component Pattern
```typescript
// Standard HTML5 drag-drop + FileReader for preview
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  setPreview(URL.createObjectURL(file));
  setPendingFile(file);
};

const handleUpload = async () => {
  const fd = new FormData();
  fd.append("file", pendingFile);
  const res = await fetch("/api/screenshots", { method: "POST", body: fd });
  const { filename } = await res.json();
  // store filename; user presses Analyze separately
};
```

### Pattern Performance Aggregation (Client-Side)
```typescript
// Aggregate per-pattern stats from trades array
// trades have ai_primary_pattern: string | null
const patternStats = trades
  .filter(t => t.status === "closed" && t.ai_primary_pattern && t.pnl != null)
  .reduce((acc, t) => {
    const p = t.ai_primary_pattern!;
    if (!acc[p]) acc[p] = { count: 0, wins: 0, totalPnl: 0 };
    acc[p].count++;
    if (t.pnl! > 0) acc[p].wins++;
    acc[p].totalPnl += t.pnl!;
    return acc;
  }, {} as Record<string, { count: number; wins: number; totalPnl: number }>);

const table = Object.entries(patternStats).map(([pattern, s]) => ({
  pattern,
  count: s.count,
  winRate: s.wins / s.count,
  avgPnl: s.totalPnl / s.count,
})).sort((a, b) => b.count - a.count);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `json_object` response_format | `json_schema` with `strict: true` | GPT-4o Aug 2024 | Schema adherence guaranteed; no custom validation needed |
| `gpt-4-vision-preview` model | `gpt-4o` (unified multimodal) | May 2024 | Faster, cheaper, better pattern recognition |
| `response_format: { type: "json_object" }` | `response_format: { type: "json_schema", json_schema: { strict: true } }` | Aug 2024 | Strict schema adherence vs. best-effort |
| `openai` v3 (`createChatCompletion`) | `openai` v4+ (`chat.completions.create`) | Late 2023 | New SDK shape; v3 patterns are invalid |
| Pages Router `multer` middleware | App Router `request.formData()` | Next.js 13.4+ | Native FormData; no external middleware needed |

**Deprecated/outdated:**
- `gpt-4-vision-preview`: Replaced by `gpt-4o`. Do not use.
- `openai` v3 API shape: `configuration = new Configuration(...)`, `createChatCompletion`. All v3 patterns are wrong. Use `new OpenAI({ apiKey })`.
- Multer/Formidable for Next.js App Router file uploads: Not needed. `request.formData()` is native.

---

## Open Questions

1. **Thumbnail generation approach**
   - What we know: CONTEXT.md says "thumbnails generated for preview (webp)"; not specified where
   - What's unclear: Client-side canvas vs. server-side sharp; whether separate thumbnail files are stored or inline preview is generated client-side from the File object before upload
   - Recommendation: Use client-side `URL.createObjectURL(file)` for preview before upload; store only the original file. No separate thumbnail files. This eliminates the sharp dependency and simplifies storage.

2. **Trade linking UX for the "link later" flow**
   - What we know: Screenshots are uploaded without trade association; user links after analysis
   - What's unclear: How unlinked screenshots are tracked (settings JSON vs. separate DB table vs. just stored as files with no record)
   - Recommendation: Store unlinked screenshots in a user-settings key `ai_pending_screenshots` as JSON array of `{ filename, uploadedAt, analysisResult }`. When user links to a trade, move the analysis data to the trade record and remove from pending list. Simple, no new table needed.

3. **Multi-screenshot trade association**
   - What we know: Multiple screenshots per trade supported; `ai_screenshots` column stores JSON string[]
   - What's unclear: Which screenshot's analysis is "primary" when a trade has multiple analyzed screenshots
   - Recommendation: Last analyzed wins; `ai_patterns` and `ai_primary_pattern` always reflect the most recent analysis. QA history accumulates across all screenshots (with a `screenshotFilename` field per Q&A entry).

---

## Sources

### Primary (HIGH confidence)
- OpenAI Chat Completions API — vision + structured output (json_schema with strict:true) confirmed working on gpt-4o-2024-08-06 and later
- OpenAI npm package v4+ API shape: `new OpenAI({ apiKey })`, `chat.completions.create()` — official SDK
- Next.js App Router `request.formData()` — documented in Next.js App Router route handlers
- Node.js `fs/promises` writeFile + readFile for file storage — standard Node.js

### Secondary (MEDIUM confidence)
- getstream.io GPT-4o Vision Guide — base64 image encoding pattern, detail parameter values, image specs (50MB max, PNG/JPEG/WEBP/GIF supported)
- ericburel.tech Next.js streaming files guide — pattern for serving files from disk via API route
- OpenAI community: `json_schema` with vision inputs is compatible (multiple sources confirm)

### Tertiary (LOW confidence)
- GPT-4o chart pattern detection accuracy — no independent benchmark exists; capability confirmed but calibration of confidence scores is subjective
- Sharp for thumbnails — capability confirmed, but recommendation is to avoid adding dependency

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — openai npm, fs/promises, Next.js formData() all verified against official sources
- Architecture patterns: HIGH — all patterns derived from official docs and verified examples
- Prompt engineering: MEDIUM — GPT-4o capability confirmed but exact prompt wording requires iteration; starting point provided
- Pitfalls: HIGH — path traversal, orphaned files, and API key errors are well-known and verified

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (OpenAI SDK stable; Next.js file upload pattern stable)
