# Phase 9: Monte Carlo Entry Integration - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Traders see live risk simulation results and position size suggestions directly inside the trade entry modal before submitting a trade. Covers ruin probability warning (MC-01), inline simulation preview (MC-02), suggested position size (MC-03), and strategy-based filtering (MC-04). Does not modify the standalone Monte Carlo page or add new simulation algorithms — extends the existing `lib/simulation.ts` engine for in-modal use.

</domain>

<decisions>
## Implementation Decisions

### Simulation placement & layout
- Collapsible panel below the existing PositionSizer in the Setup tab of TradeModal
- Collapsed by default; remembers last state via settings
- Mini risk badge visible even when collapsed (e.g., "⚠ Ruin: 12.3%" or "✅ Low risk")
- Auto-computes via Web Worker when entry + stop + account are filled (500ms debounce, 1K iterations per architecture decision)
- Results update in real-time including the collapsed badge

### Risk warning presentation
- Ruin probability threshold is user-configurable in Settings (default 5%)
- Three severity levels: green (below threshold), yellow (1-2x threshold), red (above 2x threshold)
- Inline red/yellow banner at top of expanded MC panel when threshold exceeded: "⚠ Ruin: 12.3% (threshold: 5%) — Consider reducing position size"
- Non-blocking — user can still submit the trade regardless of risk level
- When fewer than 10 trades exist: show panel with warning message "Not enough trade history (X/10 trades). Results may be unreliable." — still compute and display results

### Position size suggestion
- MC-suggested size shown as recommendation inside the MC panel, separate from existing PositionSizer
- Sizing method: binary search for the largest position size that keeps ruin probability under the user's threshold
- "Apply" button updates the shares field only (not risk %)
- Explicit comparison shown: "MC Suggested: 100 shares" vs "Your current: 200 shares" with percentage difference note
- Existing PositionSizer component stays unchanged above the MC panel

### Strategy filter
- Dropdown defaults to "All Strategies" regardless of the trade's selected strategy
- Strategies with fewer than 5 trades are disabled (auto-fallback to All)
- Trade count per strategy visible in dropdown: "Wyckoff Buying (23 trades)"
- Strategies only — no tag-based filtering
- Changing the filter re-runs the simulation with filtered historical trades

### Claude's Discretion
- Exact Web Worker implementation details and message protocol
- MC panel styling, spacing, and animations
- Ruin threshold settings UI placement (likely in existing Settings page)
- "Apply" button styling and positioning
- Handling of edge cases (zero trades, all losses, single strategy)
- Default ruin threshold value (suggested 5%)
- Minimum trades threshold for strategy filter (suggested 5)

</decisions>

<specifics>
## Specific Ideas

- Collapsed badge should feel like a health indicator — green/yellow/red at a glance without expanding
- The comparison between MC suggestion and current shares should make the delta obvious ("MC suggests 50% less risk")
- Strategy dropdown should show trade counts to help users judge data quality

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/simulation.ts`: Existing `runMonteCarlo()` function — takes returns[], startingBalance, numTrades, iterations, ruinThreshold. Returns medianFinalBalance, maxDrawdown, probOfRuin, probOfProfit, paths, distribution. Extend for Web Worker wrapper.
- `components/PositionSizer.tsx`: Position sizing from account size + risk % + stop distance. MC panel sits below this, reads its shares value for comparison.
- `components/RiskCalculator.tsx`: R:R calculation logic already in TradeModal — MC panel can read entry/stop/target from form state.
- `lib/account-context.tsx`: AccountProvider with `accounts`, `activeAccountId` — MC uses `selectedAccountId` (trade's account) for balance.

### Established Patterns
- TradeModal uses `useState` for form state, 3 tabs (setup/execution/reflection)
- Settings persistence via `/api/settings` as JSON strings — use for MC panel collapsed state and ruin threshold
- `strategy_id` column on trades with indexed query support

### Integration Points
- `components/TradeModal.tsx`: Add MonteCarloPreview component below PositionSizer in Setup tab
- `components/MonteCarloPreview.tsx` (new): Compact simulation panel component
- `/api/trades/`: Fetch historical trades for account (already supports `?account_id=` filter)
- `/api/settings/`: Store `montecarlo_ruin_threshold` and `montecarlo_panel_collapsed` settings
- Web Worker file (new): Offload simulation computation from main thread

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-monte-carlo-entry-integration*
*Context gathered: 2026-03-17*
