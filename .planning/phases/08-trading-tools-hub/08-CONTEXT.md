# Phase 8: Trading Tools Hub - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver six standalone calculators on a dedicated /tools page accessible from the sidebar navigation. Calculators are ephemeral (no state saved to DB). No external dependencies beyond `simple-statistics` for correlation math. The six tools: Risk/Reward, Compound Growth, Drawdown Recovery, Kelly Criterion, Fibonacci, and Correlation Matrix.

</domain>

<decisions>
## Implementation Decisions

### Page layout & navigation
- Tab bar across the top of /tools page — one calculator visible at a time
- Active tab reflected via `?tab=` query param (same pattern as Settings page) — bookmarkable
- Wrench icon in sidebar nav, positioned last (after Chart): Dashboard → Trades → Journal → Analytics → Chart → Tools
- Tab labels: R:R, Growth, Drawdown, Kelly, Fibonacci, Correlation

### R:R calculator
- Vertical price ladder visualization with colored zones (green for reward, red for risk) plus numeric stats
- Long/Short direction toggle (matches trade modal pattern)
- Optional collapsible position sizing section below core R:R calc — enter account size + risk % to see total $ risk, $ reward, and recommended shares (reuses PositionSizer logic)

### Compound growth calculator
- Inputs: starting balance, return rate (%), period (months)
- Recharts area chart showing the growth curve over time (matches existing dashboard chart patterns)
- Show final balance and total gain ($ and %)

### Drawdown recovery calculator
- Single input for drawdown % → shows required recovery gain %
- Reference table of common drawdowns (5%, 10%, 20%, 25%, 30%, 50%, 75%) with recovery percentages
- Highlight the user's entered value in the reference table when it matches

### Kelly criterion calculator
- Inputs: win rate (%), average win ($), average loss ($)
- Output: optimal position size percentage via Kelly formula
- Show fractional Kelly variants (full, half, quarter) as most traders use fractional Kelly

### Fibonacci calculator
- Inputs: high price, low price
- Color-coded table with all standard retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- Extension levels included: 127.2%, 161.8%, 261.8%
- Click-to-copy on individual price levels

### Correlation matrix
- Symbol selection via type-to-search (reuse SymbolSearch component) + pre-populated from user's trade history
- Add/remove chips UI for selected symbols
- Maximum 10 symbols
- Time period dropdown: 1D, 5D, 30D, 60D, 90D, 180D, YTD, 365D
- Progress bar with symbol names during OHLCV loading ("Fetching MSFT 3/8...")
- Sequential OHLCV fetches (avoid Yahoo Finance throttling per architecture decision)
- Color-coded matrix cells (green for positive correlation, red for negative)

### Calculator input patterns
- Live update as you type for all calculators (instant recalculation)
- Correlation matrix: explicit "Calculate" button since it requires external data fetching
- Number inputs with proper validation

### Claude's Discretion
- Exact spacing, typography, and card styling
- Error state messaging for invalid inputs
- Exact color gradient for correlation matrix and Fibonacci levels
- Kelly formula edge case handling (0% win rate, 100% win rate)
- Default values for inputs on first load
- Mobile responsiveness details
- Tab order and keyboard navigation

</decisions>

<specifics>
## Specific Ideas

- R:R visual should show a vertical price ladder with entry/stop/target as horizontal lines, colored zones between them
- Drawdown reference table should highlight the user's entered value with a marker (◀) when it matches a common level
- Growth chart uses Recharts area chart to stay consistent with dashboard visualizations
- Fibonacci table has click-to-copy per level for quick use in trading platforms

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/RiskCalculator.tsx`: R:R calculation logic (entry/stop/target → ratio, risk per share, reward per share). Standalone version will extend this with visual ladder and optional position sizing.
- `components/PositionSizer.tsx`: Position sizing from account size + risk % + stop distance. Math can be reused in R:R calculator's optional section.
- `components/SymbolSearch.tsx`: Type-to-search symbol autocomplete — reuse for correlation matrix symbol picker.
- `lib/simulation.ts`: Monte Carlo engine — pattern reference for math-heavy modules.
- Recharts (already in project): Area charts used across dashboard — use for compound growth curve.

### Established Patterns
- Settings page uses `?tab=` query params for tab navigation — same pattern for /tools
- Dashboard time filter (30/60/90/All) — similar selector pattern for correlation period
- Dark-first styling with `dark:` Tailwind prefix throughout

### Integration Points
- `components/Navbar.tsx`: Add Tools to `NAV_LINKS` array (Wrench icon, last position)
- `/api/ohlcv/` endpoint: Already fetches candle data — use for correlation matrix historical prices
- `lib/calculators.ts` (new): Pure math functions for all 6 calculators, imported by components
- `app/tools/page.tsx` (new): Tools Hub page with tab shell

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-trading-tools-hub*
*Context gathered: 2026-03-16*
