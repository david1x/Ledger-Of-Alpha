# Phase 06 Context: Risk Management & AI Insights

## Goal
Enhance the platform with predictive risk modeling, automated pattern recognition, and robust multi-channel alerting.

## Core Requirements
- **Risk Simulator:** A Monte Carlo engine using bootstrap resampling of historical P&L percentages to model equity curve distribution and Risk of Ruin.
- **AI Pattern Matching:** A heuristic-based insight engine that identifies "Edge" traits (symbol, time, setup) with high win rates and profit factors.
- **Alerts System:** Expansion of current alerts to support Discord webhooks and Email notifications via background price polling.
- **Multi-Broker Import:** Support for importing trades from common broker formats (e.g., ThinkOrSwim, Interactive Brokers, Robinhood).

## Technical Constraints
- **Simulation:** Perform Monte Carlo calculations on the client-side to keep the UI responsive and avoid long-running server requests.
- **Alerts:** Use SQLite WAL mode for polling safety. Leverage existing `lib/email.ts`.
- **UI:** Integrate with the customizable dashboard. Use `recharts` for simulation visualizations.

## Relevant Files
- `lib/trade-utils.ts` (base for simulation logic)
- `lib/db.ts` (schema for alerts and imports)
- `lib/csv.ts` (base for multi-broker import logic)
- `components/dashboard/DashboardShell.tsx` (insight widget integration)
