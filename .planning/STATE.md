# Project State: Ledger Of Alpha

## Current Position

Phase: 8 — Trading Tools Hub
Plan: —
Status: Roadmap created, ready to plan Phase 8
Last activity: 2026-03-15 — v2.0 roadmap created (4 phases, 21 requirements)

Progress: [----------] 0% (Phase 8 of 11)

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics.
**Current focus:** v2.0 Intelligence & Automation — Phase 8: Trading Tools Hub

## Milestone Summary

**v2.0 goal:** Add AI-powered chart analysis, broker automation, integrated risk modeling, and a trading tools hub.

| Phase | Goal | Status |
|-------|------|--------|
| 8. Trading Tools Hub | Six calculators at /tools | Not started |
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
- New packages: `openai` (Phase 10), `fast-xml-parser` (Phase 11, maybe skippable), `simple-statistics` (Phase 8)
- DB migrations: 019 (AI fields on trades), 020 (ibkr_exec_id on trades), 021 (IBKR settings keys)
- Settings namespace: `ibkr_*`, `ai_*`, `tools_*`, `montecarlo_*`
- Account scope: Always use `selectedAccountId` (trade's account), never `activeAccountId`, for Monte Carlo balance

### Key files to modify in v2.0

- `lib/db.ts` — migrations 019-021
- `lib/types.ts` — new trade fields (ai_patterns, screenshot_analyzed_at, ibkr_exec_id)
- `components/TradeModal.tsx` — AI upload tab + Monte Carlo preview panel
- `components/dashboard/DashboardShell.tsx` — IBKR live positions widget
- `components/Navbar.tsx` — /tools link

### New files to create in v2.0

- `lib/calculators.ts` — pure math functions for all 6 calculators
- `lib/ai-vision.ts` — OpenAI client wrapper (server-side only)
- `lib/ibkr-client.ts` — IBKR Client Portal REST proxy
- `app/tools/page.tsx` — Tools Hub page
- `components/tools/` — calculator components
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

## Session Continuity

To resume: read this file + .planning/ROADMAP.md + current phase plan (when created).
Next action: Run `/gsd:plan-phase 8` to create the Trading Tools Hub execution plan.
