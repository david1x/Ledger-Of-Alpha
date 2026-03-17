---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Intelligence & Automation
status: in-progress
last_updated: "2026-03-17T17:23:38.051Z"
last_activity: 2026-03-16 — 08-03 completed (CorrelationMatrix, simple-statistics, TOOLS-07 done)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Intelligence & Automation
status: in-progress
last_updated: "2026-03-16T15:41:51.311Z"
last_activity: 2026-03-16 — 08-03 completed (CorrelationMatrix, simple-statistics, TOOLS-07 done)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Intelligence & Automation
status: in-progress
last_updated: "2026-03-16T15:40:34Z"
last_activity: 2026-03-16 — 08-03 completed (CorrelationMatrix component, simple-statistics, Phase 8 complete)
progress:
  [██████████] 100%
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State: Ledger Of Alpha

## Current Position

Phase: 8 — Trading Tools Hub (COMPLETE)
Plan: 03 complete — all 3 plans done
Status: Phase 8 complete — all 6 calculators shipped
Last activity: 2026-03-16 — 08-03 completed (CorrelationMatrix, simple-statistics, TOOLS-07 done)

Progress: [██████████] 100% (Phase 8)

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics.
**Current focus:** v2.0 Intelligence & Automation — Phase 9: Monte Carlo Entry Integration

## Milestone Summary

**v2.0 goal:** Add AI-powered chart analysis, broker automation, integrated risk modeling, and a trading tools hub.

| Phase | Goal | Status |
|-------|------|--------|
| 8. Trading Tools Hub | Six calculators at /tools | Complete (3/3 plans done) |
| 9. Monte Carlo Entry Integration | Inline risk simulation in TradeModal | Not started |
| 10. AI Chart Pattern Recognition | GPT-4o screenshot analysis + similar trade finder | Not started |
| 11. IBKR Broker Sync | Client Portal REST integration, live positions | Not started |

## Performance Metrics

- v1.0.0: 7 phases, 58 commits, 16 days (shipped 2026-03-14)
- v2.0 start: 2026-03-15
- v2.0 phases: 4
- v2.0 requirements: 21

## Accumulated Context

### Architecture decisions locked for v2.0

- IBKR: Use Client Portal REST API (not TWS socket) — HTTP-based, fits proxy pattern, no persistent daemon needed
- AI vision: GPT-4o via `openai` npm package, server-side only, structured JSON output enforced from day one
- Monte Carlo: Web Worker + 500ms debounce + 1K iterations for in-modal preview (not 5K like standalone page)
- Correlation Matrix: Sequential OHLCV fetches (not Promise.all) to avoid Yahoo Finance throttling
- New packages: `openai` (Phase 10), `fast-xml-parser` (Phase 11, maybe skippable), `simple-statistics` (Phase 8, installed)
- DB migrations: 019 (AI fields on trades), 020 (ibkr_exec_id on trades), 021 (IBKR settings keys)
- Settings namespace: `ibkr_*`, `ai_*`, `tools_*`, `montecarlo_*`
- Account scope: Always use `selectedAccountId` (trade's account), never `activeAccountId`, for Monte Carlo balance

### Key files to modify in v2.0

- `lib/db.ts` — migrations 019-021
- `lib/types.ts` — new trade fields (ai_patterns, screenshot_analyzed_at, ibkr_exec_id)
- `components/TradeModal.tsx` — AI upload tab + Monte Carlo preview panel
- `components/dashboard/DashboardShell.tsx` — IBKR live positions widget
- `components/Navbar.tsx` — /tools link (done in Phase 8)

### New files to create in v2.0

- `lib/calculators.ts` — pure math functions for all 6 calculators (DONE - Phase 8)
- `lib/ai-vision.ts` — OpenAI client wrapper (server-side only)
- `lib/ibkr-client.ts` — IBKR Client Portal REST proxy
- `app/tools/page.tsx` — Tools Hub page (DONE - Phase 8)
- `components/tools/` — calculator components (DONE - Phase 8)
- `components/MonteCarloPreview.tsx` — compact simulation panel for TradeModal
- `components/dashboard/IBKRWidget.tsx` — live positions panel
- `app/api/ai/analyze/route.ts` — AI screenshot analysis endpoint
- `app/api/broker/ibkr/` — IBKR proxy API routes

### Critical pitfalls (from research)

1. Monte Carlo must run in Web Worker — blocks main thread at 5K iterations; use 1K + debounce for modal
2. AI output must be structured JSON from day one — cannot retrofit without re-analyzing all uploads
3. IBKR: never TWS socket in API route — use Client Portal REST (HTTP, stateless, proxy-friendly)
4. IBKR deduplication: ibkr_exec_id + ON CONFLICT DO NOTHING — blind inserts create duplicates
5. Monte Carlo balance: use selectedAccountId (trade's account), not activeAccountId (UI selection)

## Decisions (v2.0)

- Tools tab default is "rr" (Risk/Reward); stub components allow Plans 02/03 to work independently without touching page.tsx
- Fibonacci retracements styled sky-400, extensions violet-400 for visual distinction
- FibCalculator uses per-row copiedLabel string key to support individual row copy feedback
- Correlation Matrix uses sequential OHLCV fetches (for loop + await) with client-side series alignment by common timestamps before computing sampleCorrelation
- Price ladder uses CSS absolute positioning with bottom% derived from normalized price range (no SVG/canvas needed)
- GrowthCalculator imports TOOLTIP_STYLE/GRID_STROKE/TICK from ChartWidgets for visual consistency with dashboard charts

## Performance Metrics (v2.0)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 08-trading-tools-hub | 01 | 227s | 2/2 | 9 |
| 08-trading-tools-hub | 02 | 143s | 2/2 | 2 |
| 08-trading-tools-hub | 03 | 3min | 1/1 | 3 |
| Phase 08-trading-tools-hub P04 | 5 | 1 tasks | 2 files |

## Session Continuity

To resume: read this file + .planning/ROADMAP.md + current phase plan.
Last session: 2026-03-17T17:23:38.049Z
Next action: Run `/gsd:execute-phase 9` to start Phase 9 (Monte Carlo Entry Integration).
