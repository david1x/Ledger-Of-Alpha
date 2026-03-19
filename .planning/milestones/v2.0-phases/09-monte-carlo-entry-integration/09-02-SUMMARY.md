---
phase: 09-monte-carlo-entry-integration
plan: 02
status: complete
started: 2026-03-17
completed: 2026-03-17
duration: ~6min
---

## What was built

Wired the MonteCarloPreview component into the trade entry flow and settings page:

1. **TradeModal Integration** — MonteCarloPreview renders below PositionSizer in the Setup tab. Fetches historical closed trades for the selected account via `/api/trades?account_id=X&status=closed`, maps them to `{ pnl_percent, strategy_id }` for simulation input. Loads collapsed state and ruin threshold from settings API on mount.

2. **Settings Page** — Added "Monte Carlo Simulation" section with ruin probability threshold input (1-50%, default 5%) and severity preview showing green/yellow/red risk ranges.

## Key files

### Created
(none — this plan modifies existing files only)

### Modified
- `components/TradeModal.tsx` — Added MC state vars, historical trade fetch, settings load/save, MonteCarloPreview render
- `app/settings/page.tsx` — Added montecarlo_ruin_threshold to Settings interface and defaults, Monte Carlo section UI

## Commits
- `ee74116` feat(09-02): integrate MonteCarloPreview into TradeModal with data fetching
- `d0d1b24` feat(09-02): add Monte Carlo ruin threshold setting to Settings page

## Deviations
None — implementation follows plan exactly.

## Self-Check: PASSED
- [x] MonteCarloPreview renders below PositionSizer in Setup tab
- [x] Historical trades fetched for selected account
- [x] Collapsed state persisted via settings API
- [x] Ruin threshold configurable in Settings page with severity preview
- [x] Apply button updates shares field
- [x] Build passes cleanly
