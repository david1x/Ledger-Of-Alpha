---
phase: 10-ai-chart-pattern-recognition
plan: 01
subsystem: api
tags: [openai, gpt-4o, vision, sqlite, file-upload, next.js]

# Dependency graph
requires:
  - phase: 08-trading-tools-hub
    provides: project foundation, lib/db.ts migration pattern, settings page pattern
  - phase: 09-monte-carlo-entry-integration
    provides: settings page with montecarlo_ruin_threshold field
provides:
  - openai npm package installed
  - DB migration 019 with ai_patterns, ai_screenshots, ai_qa_history, ai_primary_pattern on trades
  - lib/ai-vision.ts: analyzeChartScreenshot, askFollowUp, PatternResult, AnalysisResult, QAEntry, PATTERN_NAMES, ANALYSIS_SCHEMA
  - POST /api/screenshots: authenticated multipart file upload to data/screenshots/
  - GET /api/screenshots/[filename]: serve screenshot with ownership check and MIME type
  - DELETE /api/screenshots/[filename]: remove screenshot file with ownership check
  - POST /api/ai/analyze: GPT-4o chart pattern analysis returning structured AnalysisResult JSON
  - POST /api/ai/followup: GPT-4o follow-up Q&A on chart screenshot
  - openai_api_key field in Settings Integrations tab
affects: [10-02, 10-03]

# Tech tracking
tech-stack:
  added: [openai ^6.32.0]
  patterns:
    - GPT-4o vision with json_schema structured output (strict:true) for guaranteed schema adherence
    - Filesystem screenshot storage in data/screenshots/ served via API route (not SQLite BLOB)
    - User-scoped filename pattern: {user.id}-{uuid}.{ext} for ownership validation without DB lookup
    - Settings API key pattern mirroring FMP key — per-user DB row with masked input in Settings

key-files:
  created:
    - lib/ai-vision.ts
    - app/api/screenshots/route.ts
    - app/api/screenshots/[filename]/route.ts
    - app/api/ai/analyze/route.ts
    - app/api/ai/followup/route.ts
  modified:
    - lib/db.ts
    - lib/types.ts
    - next.config.ts
    - app/settings/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Use json_schema with strict:true (not json_object) for GPT-4o — guarantees schema adherence so patterns cannot be mis-typed or missing"
  - "Store ai_primary_pattern as denormalized indexed column alongside ai_patterns JSON for fast similar-trade SQL queries"
  - "User-scoped filenames ({user.id}-{uuid}.ext) allow ownership validation without DB lookup on every file serve/delete"
  - "detail:high for chart images — pattern recognition benefits from full image resolution despite higher token cost"

patterns-established:
  - "AI API routes: check NO_API_KEY before calling OpenAI, return {code:'NO_API_KEY'} for UI to show settings link"
  - "Filename safety: validate !includes('/') && !includes('..') + startsWith(userId+'-') before any fs operation"
  - "Screenshot routes: return 200 success on ENOENT in DELETE (idempotent delete is correct behavior)"

requirements-completed: [AI-01, AI-02, AI-03]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 10 Plan 01: AI Analysis Foundation Summary

**GPT-4o vision API wired end-to-end: openai SDK, DB migration 019, typed AI wrapper, screenshot upload/serve/delete routes, analyze/followup endpoints, and OpenAI API key in Settings**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-17T19:55:24Z
- **Completed:** 2026-03-17T20:00:59Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Full server-side AI infrastructure in place: openai package, GPT-4o wrapper with structured JSON output, 5 new API routes
- DB migration 019 adds 4 AI columns to trades table with index on ai_primary_pattern for fast pattern queries
- Screenshot upload/serve/delete with auth, ownership validation, and path traversal protection
- Settings page "AI Chart Analysis" section with masked OpenAI API key input and platform.openai.com link

## Task Commits

1. **Task 1: openai install, DB migration, types, AI vision library, screenshot API routes** - `f81935e` (feat)
2. **Task 2: Settings OpenAI key, AI analyze/followup routes** - `5b72e52` (feat)

## Files Created/Modified

- `lib/ai-vision.ts` - OpenAI GPT-4o client wrapper with analyzeChartScreenshot, askFollowUp, PatternResult, AnalysisResult, QAEntry interfaces, PATTERN_NAMES, ANALYSIS_SCHEMA
- `app/api/screenshots/route.ts` - POST: multipart upload, PNG/JPEG/WebP validation, 5MB limit, UUID filename
- `app/api/screenshots/[filename]/route.ts` - GET: serve with MIME type + Cache-Control; DELETE: unlink with ownership check
- `app/api/ai/analyze/route.ts` - POST: retrieve API key from settings, validate filename ownership, call analyzeChartScreenshot
- `app/api/ai/followup/route.ts` - POST: validate body, call askFollowUp, return {answer}
- `lib/db.ts` - Migration 019: ai_patterns, ai_screenshots, ai_qa_history, ai_primary_pattern columns + index
- `lib/types.ts` - Trade interface extended with 4 AI fields
- `next.config.ts` - Added "openai" to serverExternalPackages
- `app/settings/page.tsx` - Added openai_api_key to Settings interface + AI Chart Analysis section with BrainCircuit icon
- `package.json` / `package-lock.json` - openai ^6.32.0 added

## Decisions Made

- Used `json_schema` with `strict: true` (not `json_object`) for GPT-4o — guarantees schema adherence, eliminates a class of runtime errors
- Denormalized `ai_primary_pattern` column alongside `ai_patterns` JSON for fast indexed SQL queries without JSON parsing
- User-scoped filenames (`{user.id}-{uuid}.ext`) allow ownership validation without a DB lookup on every file request
- Used `detail: "high"` for chart image analysis — chart pattern recognition needs full image resolution despite higher token cost

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `.next` directory had a stale locked `trace` file preventing build; killed node processes and cleared `.next` before build succeeded.

## User Setup Required

None — user enters their own OpenAI API key in Settings > Integrations > AI Chart Analysis.

## Next Phase Readiness

- Plan 02 (AI screenshot uploader UI component) can now import from `lib/ai-vision.ts` and use all 5 API routes
- Plan 03 (analytics integration) can query `ai_primary_pattern` via the indexed column
- All server-side AI infrastructure is complete — no additional backend work needed in subsequent plans

---
*Phase: 10-ai-chart-pattern-recognition*
*Completed: 2026-03-17*
