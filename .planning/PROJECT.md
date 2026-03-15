# Project: Ledger Of Alpha

## What This Is

A professional-grade trade journaling and performance analytics platform for solo traders. Combines deep reflection tools, risk management, and data-driven insights with an analytics dashboard, journal, and chart integration.

## Core Value

Traders can track, analyze, and improve their trading through structured journaling and actionable analytics. Every feature serves the goal of turning raw trade data into better decisions.

## Current Milestone: v2.0 Intelligence & Automation

**Goal:** Add AI-powered chart analysis, broker automation, integrated risk modeling, and a trading tools hub to transform Ledger Of Alpha from a manual journal into an intelligent trading companion.

**Target features:**
- AI chart pattern recognition and similar trade matching from screenshots
- Monte Carlo risk simulation integrated into trade entry flow
- Real-time IBKR/TWS broker sync (live positions + auto-import)
- Trading Tools Hub with 6 calculators (R:R, compound growth, drawdown recovery, Kelly criterion, Fibonacci, correlation matrix)

## Requirements

### Validated

<!-- Shipped and confirmed valuable in v1.0.0. -->

- ✓ Core trade CRUD with rich metadata (setup/execution/reflection) — v1.0.0
- ✓ Performance dashboard with 24 widget cards, heatmap, weekly calendar — v1.0.0
- ✓ Journal with review mode and card view — v1.0.0
- ✓ Monte Carlo risk simulator (standalone) — v1.0.0
- ✓ AI edge discovery (heuristic pattern matching) — v1.0.0
- ✓ Multi-channel alerts (Discord/Email) — v1.0.0
- ✓ Multi-broker CSV import (TOS, IBKR, Robinhood) — v1.0.0
- ✓ Multi-account system — v1.0.0
- ✓ Settings, auth, 2FA — v1.0.0

### Active

<!-- v2.0 scope. Building toward these. -->

- [ ] AI chart pattern recognition from uploaded screenshots
- [ ] Similar trade finder (compare setups across history)
- [ ] Monte Carlo integration in trade entry for position sizing
- [ ] IBKR/TWS live position sync
- [ ] IBKR/TWS automatic trade import
- [ ] Trading Tools Hub sub-page
- [ ] Risk/Reward Visualizer
- [ ] Compound Growth Calculator
- [ ] Drawdown Recovery Calculator
- [ ] Kelly Criterion Calculator
- [ ] Fibonacci Calculator
- [ ] Correlation Matrix

### Out of Scope

<!-- Explicit boundaries for v2.0. -->

- Mobile app (PWA/React Native) — Deferred post-v2.0; web-first priority
- Real-time chat/social features — Not aligned with solo trader focus
- Options/futures-specific calculators — Equity/forex focus for now
- Multi-broker live sync beyond IBKR — Start with one broker, expand later

## Context

- v1.0.0 shipped 2026-03-14 after 16 days and 7 phases
- Existing codebase: Next.js 15, TypeScript, SQLite, Recharts, lightweight-charts
- AI features will need image processing capabilities (likely cloud vision API or local model)
- IBKR integration requires TWS API or Client Portal API
- Monte Carlo engine already exists in `lib/simulation.ts` — extend for entry integration

## Constraints

- **Tech stack**: Next.js 15 + SQLite — no stack changes, extend existing
- **AI processing**: Must work without GPU; cloud API or lightweight local model
- **Broker API**: IBKR TWS API requires TWS/Gateway running locally on trader's machine
- **Performance**: Calculators must be instant; AI/broker can be async

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IBKR first (not multi-broker) | Most common among active traders, well-documented API | — Pending |
| Cloud vision for AI patterns | Local models too heavy for typical trader hardware | — Pending |
| Tools as sub-page under analytics | Keeps navigation clean, logical grouping | — Pending |

---
*Last updated: 2026-03-15 after v2.0 milestone initialization*
