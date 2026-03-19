# Project: Ledger Of Alpha

## What This Is

A professional-grade trade journaling and performance analytics platform for solo traders. Combines deep reflection tools, risk management, AI-powered chart analysis, broker integration, and data-driven insights with an analytics dashboard, journal, chart integration, and trading tools.

## Core Value

Traders can track, analyze, and improve their trading through structured journaling and actionable analytics. Every feature serves the goal of turning raw trade data into better decisions.

## Requirements

### Validated

- ✓ Core trade CRUD with rich metadata (setup/execution/reflection) — v1.0.0
- ✓ Performance dashboard with 24 widget cards, heatmap, weekly calendar — v1.0.0
- ✓ Journal with review mode and card view — v1.0.0
- ✓ Monte Carlo risk simulator (standalone) — v1.0.0
- ✓ AI edge discovery (heuristic pattern matching) — v1.0.0
- ✓ Multi-channel alerts (Discord/Email) — v1.0.0
- ✓ Multi-broker CSV import (TOS, IBKR, Robinhood) — v1.0.0
- ✓ Multi-account system — v1.0.0
- ✓ Settings, auth, 2FA — v1.0.0
- ✓ Trading Tools Hub (R:R, compound growth, drawdown, Kelly, correlation) — v2.0
- ✓ AI chart pattern recognition from screenshots (Gemini 2.5 Flash) — v2.0
- ✓ Similar trade finder by AI-detected pattern type — v2.0
- ✓ Pattern performance analytics (win rate, avg P&L by pattern) — v2.0
- ✓ Monte Carlo integration in trade entry (ruin probability, suggested sizing) — v2.0
- ✓ IBKR broker sync (manual import with deduplication) — v2.0
- ✓ IBKR live positions dashboard widget — v2.0

### Active

<!-- Next milestone scope -->

(None yet — run /gsd:new-milestone to define next milestone)

### Out of Scope

- Mobile app (PWA/React Native) — web-first priority
- Real-time chat/social features — solo trader focus
- Options/futures-specific calculators — equity/forex focus
- Multi-broker live sync beyond IBKR — expand later based on demand
- Two-way broker sync (send orders to IBKR) — regulatory complexity
- On-device AI model — cloud API is sufficient
- Offline mode — real-time data is core value

## Context

- v1.0.0 shipped 2026-03-14 after 16 days and 7 phases
- v2.0 shipped 2026-03-19 after 2 days and 4 phases (12 plans)
- Codebase: ~21,540 LOC TypeScript, Next.js 15, SQLite, Recharts, lightweight-charts
- AI: Gemini 2.5 Flash via @google/generative-ai (settings key named `openai_api_key` — naming inconsistency)
- Broker: IBKR Client Portal REST API (not TWS socket)
- Monte Carlo: Web Worker with 1K iterations + 500ms debounce for in-modal preview
- DB migrations through 021 (inline in lib/db.ts)
- 25 dashboard widgets (including IBKR positions, hidden by default)

## Constraints

- **Tech stack**: Next.js 15 + SQLite — no stack changes, extend existing
- **AI processing**: Cloud API only (Gemini); no GPU requirement
- **Broker API**: IBKR Client Portal REST requires gateway running on trader's machine
- **Performance**: Calculators instant; AI/broker async

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IBKR first (not multi-broker) | Most common among active traders, well-documented API | ✓ Good — Client Portal REST works well |
| Cloud vision for AI patterns | Local models too heavy for typical trader hardware | ✓ Good — switched to Gemini 2.5 Flash (was OpenAI GPT-4o) |
| Tools as dedicated /tools page | Keeps navigation clean, logical grouping | ✓ Good — 5 tabs, clean layout |
| Monte Carlo in Web Worker | Blocks main thread at 5K iterations | ✓ Good — 1K iterations with debounce |
| Sequential OHLCV fetches | Avoid Yahoo Finance throttling | ✓ Good — progress bar UX |
| IBKR dedup via UNIQUE index | Blind inserts create duplicates | ✓ Good — INSERT OR IGNORE pattern |
| Structured JSON AI output | Cannot retrofit without re-analyzing | ✓ Good — json_schema strict mode |

---
*Last updated: 2026-03-19 after v2.0 milestone*
