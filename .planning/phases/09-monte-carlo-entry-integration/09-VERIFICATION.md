---
phase: 09-monte-carlo-entry-integration
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Simulation auto-computes in TradeModal after entering entry + stop loss"
    expected: "After ~500ms debounce, simulation results appear (median outcome, prob of profit, max drawdown, ruin probability) in the panel below PositionSizer"
    why_human: "Web Worker execution and async state update cannot be verified by static analysis"
  - test: "Risk badge updates in real-time when panel is collapsed"
    expected: "Collapsed header shows green/yellow/red badge that reflects the current ruin probability vs threshold"
    why_human: "React state update during collapsed state requires runtime observation"
  - test: "Panel collapsed state persists across modal open/close"
    expected: "If user collapses the panel and reopens the modal, it remains collapsed"
    why_human: "Settings API round-trip and state initialization sequence requires runtime testing"
  - test: "Apply button updates shares field in trade form"
    expected: "Clicking Apply in the position size row sets the Shares field to the MC-suggested value"
    why_human: "Requires runtime interaction to verify onApplyShares callback propagates to form state"
  - test: "Strategy filter dropdown re-runs simulation with filtered trades"
    expected: "Selecting a strategy from the dropdown shows trade count and updates simulation results"
    why_human: "Requires runtime interaction with live trade data"
  - test: "Low-data warning appears when fewer than 10 historical trades"
    expected: "Amber banner 'Not enough trade history (X/10 trades)' shown when tradeCount < 10"
    why_human: "Depends on account having fewer than 10 closed trades in the database"
  - test: "Ruin threshold setting in Settings page persists on save"
    expected: "Changing threshold value, clicking Save, refreshing page retains the new value; TradeModal reflects the new threshold"
    why_human: "Full settings persistence round-trip requires browser interaction"
---

# Phase 9: Monte Carlo Entry Integration — Verification Report

**Phase Goal:** Inline risk simulation in TradeModal — Monte Carlo preview with ruin probability, median outcome, suggested position size, strategy filtering
**Verified:** 2026-03-17
**Status:** HUMAN NEEDED (all automated checks passed)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Simulation runs off main thread via Web Worker with 1K iterations | VERIFIED | `lib/use-monte-carlo.ts:36` — `new Worker("/mc-worker.js")`; worker sends `iterations: 1000` at line 101 |
| 2 | User sees ruin probability with green/yellow/red severity indicator | VERIFIED | `MonteCarloPreview.tsx:44-52` — `getSeverity()` maps to low/moderate/high; rendered with emerald/yellow/red classes at lines 305-313 |
| 3 | User sees median outcome and probability of profit | VERIFIED | `MonteCarloPreview.tsx:251-287` — 2x2 grid renders Median Outcome and Prob. of Profit with color coding |
| 4 | User sees MC-suggested position size vs current shares comparison | VERIFIED | `MonteCarloPreview.tsx:322-352` — position row shows MC Suggested vs current shares with delta text and Apply button |
| 5 | User can filter simulation by strategy with trade count shown | VERIFIED | `MonteCarloPreview.tsx:354-374` — strategy filter dropdown with per-strategy trade counts; strategies < 5 disabled with "(min 5)" |
| 6 | Panel is collapsible with mini risk badge visible when collapsed | VERIFIED | `MonteCarloPreview.tsx:163-197` — header button always visible; badge shown in header row regardless of collapsed state |
| 7 | MonteCarloPreview panel appears below PositionSizer in Setup tab | VERIFIED | `TradeModal.tsx:459-480` — `<PositionSizer />` immediately followed by `<MonteCarloPreview />` in same div |
| 8 | Panel auto-computes when entry + stop + account are filled | VERIFIED | `use-monte-carlo.ts:75-140` — debounced useEffect fires on entry/stopLoss/startingBalance changes and posts to worker |
| 9 | Panel collapsed state persists via settings API | VERIFIED | `TradeModal.tsx:110-112` loads `montecarlo_panel_collapsed` from settings; `onCollapsedChange` callback at line 477 saves via `saveSetting()` |
| 10 | User can configure ruin probability threshold in Settings | VERIFIED | `app/settings/page.tsx:732-781` — Monte Carlo Simulation section with threshold input (min=1, max=50, default=5) and severity preview |
| 11 | Apply button updates the shares field in the trade form | VERIFIED | `TradeModal.tsx:476` — `onApplyShares={(s) => set("shares", s)}`; button in `MonteCarloPreview.tsx:344` calls `onApplyShares(suggestedShares)` |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `public/mc-worker.js` | Web Worker running runMonteCarlo off main thread | VERIFIED | 241 lines; contains full `runMonteCarlo` function (copied from lib/simulation.ts), `findSuggestedSize` binary search, `self.onmessage` handler dispatching `run` and `findSuggestedSize` message types |
| `lib/use-monte-carlo.ts` | React hook wrapping Worker lifecycle, debounce, binary search sizing | VERIFIED | 149 lines; exports `useMonteCarloPreview`; creates Worker on mount, terminates on unmount, 500ms debounce, posts both `run` and `findSuggestedSize` messages |
| `components/MonteCarloPreview.tsx` | Collapsible simulation panel with risk badge, results, strategy filter, apply button | VERIFIED | 379 lines; default export; collapsible panel with badge, 2x2 stats grid, position row, strategy dropdown |
| `components/TradeModal.tsx` | MonteCarloPreview integrated below PositionSizer with trade data fetching | VERIFIED | Contains `import MonteCarloPreview`; `mcTrades`, `mcCollapsed`, `mcRuinThreshold` state; fetch at `/api/trades?account_id=X&status=closed`; renders `<MonteCarloPreview>` after `<PositionSizer>` |
| `app/settings/page.tsx` | Ruin threshold setting in settings page | VERIFIED | `montecarlo_ruin_threshold` in Settings interface (line 55) with default "5"; input at lines 745-753; severity preview at lines 758-778; saved via bulk `PUT /api/settings` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/use-monte-carlo.ts` | `public/mc-worker.js` | `new Worker('/mc-worker.js')` | VERIFIED | Line 36: `const worker = new Worker("/mc-worker.js")` |
| `components/MonteCarloPreview.tsx` | `lib/use-monte-carlo.ts` | `useMonteCarloPreview` hook | VERIFIED | Line 6: `import { useMonteCarloPreview } from "@/lib/use-monte-carlo"`; called at line 72 |
| `components/TradeModal.tsx` | `components/MonteCarloPreview.tsx` | import and render in Setup tab | VERIFIED | Line 7: `import MonteCarloPreview from "./MonteCarloPreview"`; rendered at line 464 |
| `components/TradeModal.tsx` | `/api/trades` | fetch historical trades for account | VERIFIED | Line 134: `fetch(\`/api/trades?account_id=${selectedAccountId}&status=closed\`)` with full mapping to `{ pnl_percent, strategy_id }` |
| `components/TradeModal.tsx` | `/api/settings` | load/save montecarlo_ keys | VERIFIED | Loads `montecarlo_panel_collapsed` and `montecarlo_ruin_threshold` in settings useEffect; saves `montecarlo_panel_collapsed` via `saveSetting()` on collapse toggle |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-01 | 09-01, 09-02 | User sees ruin probability warning when proposed trade risk is too high | SATISFIED | `getSeverity()` + risk warning banners in `MonteCarloPreview.tsx:203-221`; green/yellow/red severity badge always visible |
| MC-02 | 09-01, 09-02 | User sees inline simulation preview (median outcome, probability of profit) in trade modal | SATISFIED | 2x2 results grid in `MonteCarloPreview.tsx:244-319`; rendered inside `TradeModal.tsx` Setup tab |
| MC-03 | 09-01, 09-02 | System suggests optimal position size based on historical performance | SATISFIED | `findSuggestedSize` binary search in `mc-worker.js:128-179`; position row with Apply button in `MonteCarloPreview.tsx:322-352` |
| MC-04 | 09-01, 09-02 | User can filter simulation by strategy/setup type for targeted risk analysis | SATISFIED | Strategy filter dropdown in `MonteCarloPreview.tsx:354-374`; hook filters trades by `strategy_id` in `use-monte-carlo.ts:65-69` |

All four MC requirements are marked Complete in REQUIREMENTS.md traceability table. No orphaned requirements found for Phase 9.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No anti-patterns found | — | — | — | — |

Scanned `public/mc-worker.js`, `lib/use-monte-carlo.ts`, `components/MonteCarloPreview.tsx`, `components/TradeModal.tsx`, `app/settings/page.tsx` for TODO/FIXME/placeholder comments, empty implementations, stub returns. None found.

TypeScript compile: **PASSED** (zero errors, `npx tsc --noEmit` returned no output).

---

## Human Verification Required

### 1. Simulation auto-computes in TradeModal

**Test:** Open the trade modal (Add Trade or edit existing). Go to the Setup tab. Enter an entry price and stop loss value. Wait ~500ms.
**Expected:** The Monte Carlo Risk Preview panel below PositionSizer shows median outcome, prob of profit, max drawdown, and ruin probability populated with numeric values.
**Why human:** Web Worker execution and async React state updates cannot be verified by static analysis.

### 2. Risk badge updates in real-time when collapsed

**Test:** Run simulation until results appear. Collapse the panel. Verify the mini badge in the header row still shows the correct green/yellow/red status.
**Expected:** Badge reflects current ruin severity without expanding the panel.
**Why human:** Requires runtime observation of React conditional rendering in the collapsed state.

### 3. Collapsed state persists across modal sessions

**Test:** Collapse the MC panel. Close the modal. Reopen it.
**Expected:** Panel opens already collapsed (saved state restored from settings API).
**Why human:** Settings API round-trip and state initialization order require runtime testing.

### 4. Apply button updates shares field

**Test:** When a suggested position size is shown, click the "Apply" button.
**Expected:** The Shares field in the trade form updates to the MC-suggested value.
**Why human:** Requires runtime interaction to confirm the callback chain fires correctly.

### 5. Strategy filter re-runs simulation

**Test:** With simulation results showing, change the strategy dropdown to a strategy with >= 5 trades.
**Expected:** Simulation re-runs and trade count in the dropdown reflects the filtered count.
**Why human:** Requires live trade data and runtime dropdown interaction.

### 6. Low-data warning

**Test:** Open the modal on an account with fewer than 10 closed trades.
**Expected:** Amber banner "Not enough trade history (X/10 trades). Results may be unreliable." appears.
**Why human:** Depends on specific account state in the database.

### 7. Ruin threshold persists from Settings to TradeModal

**Test:** Go to Settings, change Monte Carlo ruin threshold to 10, save. Open a trade modal.
**Expected:** The warning threshold in the simulation panel reflects 10% (severity bands shift accordingly).
**Why human:** Full settings → TradeModal round-trip requires browser interaction.

---

## Summary

All 11 observable truths are verified at all three levels (exists, substantive, wired). All 4 MC requirements are satisfied with implementation evidence. TypeScript compiles cleanly. No stubs, placeholders, or anti-patterns found.

The phase goal is architecturally complete. The only remaining work is runtime confirmation of the async simulation pipeline (Web Worker communication, debounced state updates, settings persistence) which cannot be confirmed through static analysis alone.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
