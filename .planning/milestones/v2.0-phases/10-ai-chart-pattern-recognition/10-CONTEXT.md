# Phase 10: AI Chart Pattern Recognition - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload chart screenshots, run AI-powered pattern analysis (GPT-4o), ask follow-up questions about the chart, link results to trades, and view aggregate pattern performance on the Analytics page. Covers AI-01 through AI-05: screenshot upload, pattern detection with confidence scores, trade-linked storage, similar trade finder by pattern type, and per-pattern performance stats.

</domain>

<decisions>
## Implementation Decisions

### Screenshot capture flow
- Manual file upload via drag-and-drop or click-to-browse file picker
- Supports PNG, JPG, WebP; max 5MB
- Upload available on both Chart page (inside the right-side trade panel) and Analytics page
- Analyze-first, link-to-trade-later workflow — screenshots are not auto-associated with a trade; user links after analysis when ready
- Users can delete uploaded screenshots
- Multiple screenshots per trade supported (e.g., daily + 15m charts, before/after)

### AI analysis trigger
- Manual "Analyze" button — not auto-triggered on upload
- Upload shows preview thumbnail with file size, Analyze button, and Remove button
- Analysis takes 2-3 seconds via GPT-4o; show loading state
- Users can re-analyze a screenshot later

### Pattern detection
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

### Follow-up AI questions
- Quick prompt buttons for common asks: "Supply/Demand Zones", "Support/Resistance Levels", "Trend Direction"
- Freeform text input for custom questions ("Do you see a head and shoulders forming?", "Where are the demand zones?")
- AI responds inline below the initial pattern results
- All follow-up Q&A stored on the trade record alongside initial analysis — full history preserved

### Similar trade finder
- Similarity defined by same primary pattern type (e.g., all Bull Flag trades)
- Analytics page gets a "Pattern Performance" section:
  - Breakdown table per pattern type: trade count, win rate, avg P&L
  - Click a pattern row to see filtered list of individual trades
- AI analysis panel shows brief inline hint after pattern detection:
  - "You've traded this pattern X times (Y% win rate)" with link to Analytics for full breakdown
- Only AI-analyzed trades included in pattern stats (no manual tagging)

### Image storage
- Local filesystem: `data/screenshots/` directory alongside SQLite DB
- Served via Next.js API route (`/api/screenshots/[filename]`)
- Thumbnails generated for preview (webp)

### API key configuration
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

</decisions>

<specifics>
## Specific Ideas

- Confidence bars should be visual and color-coded (green for high confidence, yellow for medium)
- Pattern history hint below results should feel like a quick data point, not a full dashboard — one line with a link
- Quick prompt buttons should look like small pills/chips, not full buttons — unobtrusive but discoverable
- The "Analyze first, link later" flow allows exploratory chart analysis without committing to a trade

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/PersistentChart.tsx`: Has ImageCapture API pattern for screen capture (Discord feature) — reference for image handling, though upload is simpler
- `components/SymbolSearch.tsx`: Type-to-search component — could be reused for trade picker when linking screenshots
- `/api/discord/route.ts`: Posts images to webhooks — pattern for handling image data in API routes
- `app/analytics/page.tsx`: Existing analytics page — Pattern Performance section integrates here
- Settings page API key pattern: FMP API key input already exists — mirror for OpenAI key

### Established Patterns
- Settings persistence via `/api/settings` as JSON strings — use for OpenAI API key
- Dark-first Tailwind styling with `dark:` prefix
- Trade panel in PersistentChart.tsx is a resizable right sidebar — add upload zone within it
- `lib/types.ts` Trade interface — needs new fields for AI analysis data

### Integration Points
- `components/PersistentChart.tsx`: Add upload zone inside the trade panel (right sidebar)
- `app/analytics/page.tsx`: Add Pattern Performance section
- `lib/db.ts`: Migration 019 for AI fields on trades (ai_patterns, screenshot paths, analysis history)
- `lib/types.ts`: Extend Trade type with AI analysis fields
- `app/api/ai/analyze/route.ts` (new): Server-side GPT-4o analysis endpoint
- `app/api/ai/followup/route.ts` (new): Follow-up question endpoint
- `app/api/screenshots/` (new): Image upload, serve, and delete routes
- `app/settings/page.tsx`: Add AI Analysis section with OpenAI API key input
- `lib/ai-vision.ts` (new): OpenAI client wrapper, structured JSON output

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ai-chart-pattern-recognition*
*Context gathered: 2026-03-17*
