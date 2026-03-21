# Project: Ledger Of Alpha

## What This Is

A professional-grade trade journaling and performance analytics platform for solo traders. Combines deep reflection tools, risk management, AI-powered chart analysis, broker integration, and data-driven insights with an analytics dashboard, journal, chart integration, and trading tools. Features a fully configurable admin panel, saveable dashboard layouts, and per-trade strategy checklists.

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
- ✓ Email URL auto-detection (request headers, npm/Docker/Cloudflare tunnel) — v2.1
- ✓ Settings page overhaul (component split, full-width layout, tab reorganization) — v2.1
- ✓ Admin panel as single source of truth for runtime config (API keys, SMTP, App URL) — v2.1
- ✓ Dashboard layout templates (saveable presets with built-in defaults) — v2.1
- ✓ Strategy enhancements (built-in defaults, per-trade checklist editing, ad-hoc checklists, ChecklistRing) — v2.1

### Active

(None — planning next milestone)

### Out of Scope

- Mobile app (PWA/React Native) — web-first priority
- Real-time chat/social features — solo trader focus
- Options/futures-specific calculators — equity/forex focus
- Multi-broker live sync beyond IBKR — expand later based on demand
- Two-way broker sync (send orders to IBKR) — regulatory complexity
- On-device AI model — cloud API is sufficient
- Offline mode — real-time data is core value
- Fibonacci calculator — user decision: not wanted
- Dashboard widget height adjustment — deferred to later milestone
- Template sharing/export — no multi-user sharing infrastructure needed yet
- Per-strategy performance breakdown — deferred to later milestone

## Context

- v1.0.0 shipped 2026-03-14 after 16 days and 7 phases
- v2.0 shipped 2026-03-19 after 2 days and 4 phases (12 plans)
- v2.1 shipped 2026-03-21 after 2 days and 6 phases (10 plans)
- Codebase: ~23,650 LOC TypeScript (+2,100 net from v2.1), Next.js 15, SQLite, Recharts, lightweight-charts
- AI: Gemini 2.5 Flash via @google/generative-ai (settings key named `openai_api_key` — naming inconsistency)
- Broker: IBKR Client Portal REST API (not TWS socket)
- Monte Carlo: Web Worker with 1K iterations + 500ms debounce for in-modal preview
- DB migrations through 022 (inline in lib/db.ts)
- 25 dashboard widgets (including IBKR positions, hidden by default)
- Settings decomposed into 13 per-tab components (was 2380-line monolith)
- Admin panel manages system-level API keys, SMTP, App URL with sentinel masking
- 5 built-in strategies with per-trade checklist editing and ChecklistRing badges

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
| Settings split into per-tab components | 2380-line monolith unmaintainable | ✓ Good — 13 focused tab components |
| Sentinel masking for admin secrets | Cannot round-trip real keys through UI | ✓ Good — POST skips upsert when value equals sentinel |
| Per-account layout storage | Users want different layouts per account | ✓ Good — scoped keys with legacy fallback |
| checklist_state column per-trade | Global strategies immutable; per-trade edits need own storage | ✓ Good — migration 022, backward compat |
| getBaseUrl 5-level priority chain | Must work across npm dev, Docker, Cloudflare Tunnel | ✓ Good — zero-config in all environments |

---
*Last updated: 2026-03-21 after v2.1 milestone*
