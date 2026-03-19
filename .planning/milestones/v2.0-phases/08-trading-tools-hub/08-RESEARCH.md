# Phase 8: Trading Tools Hub - Research

**Researched:** 2026-03-16
**Domain:** Trading calculators, pure math, React UI patterns, Recharts, Yahoo Finance OHLCV, Pearson correlation
**Confidence:** HIGH

## Summary

Phase 8 delivers six standalone calculators at `/tools` with no new DB dependencies. All calculator logic is ephemeral (no storage). The codebase already provides the primary reusable primitives: `RiskCalculator.tsx` for R:R math, `PositionSizer.tsx` for position sizing, `SymbolSearch.tsx` for symbol autocomplete, the existing `/api/ohlcv` endpoint for historical data, and Recharts for charting. The only external dependency to add is `simple-statistics` for Pearson correlation.

The page follows the established Settings tab pattern (`?tab=` query param via `useSearchParams`) and uses the standard Next.js App Router page structure. All six calculators are client-only components under `components/tools/`. Pure math lives in `lib/calculators.ts` for testability and separation.

**Primary recommendation:** Build `lib/calculators.ts` first (pure math, zero dependencies), then each calculator component, then the page shell and navbar link. The correlation matrix is the most complex piece — plan it last within the phase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page layout & navigation**
- Tab bar across the top of /tools page — one calculator visible at a time
- Active tab reflected via `?tab=` query param (same pattern as Settings page) — bookmarkable
- Wrench icon in sidebar nav, positioned last (after Chart): Dashboard → Trades → Journal → Analytics → Chart → Tools
- Tab labels: R:R, Growth, Drawdown, Kelly, Fibonacci, Correlation

**R:R calculator**
- Vertical price ladder visualization with colored zones (green for reward, red for risk) plus numeric stats
- Long/Short direction toggle (matches trade modal pattern)
- Optional collapsible position sizing section below core R:R calc — enter account size + risk % to see total $ risk, $ reward, and recommended shares (reuses PositionSizer logic)

**Compound growth calculator**
- Inputs: starting balance, return rate (%), period (months)
- Recharts area chart showing the growth curve over time (matches existing dashboard chart patterns)
- Show final balance and total gain ($ and %)

**Drawdown recovery calculator**
- Single input for drawdown % → shows required recovery gain %
- Reference table of common drawdowns (5%, 10%, 20%, 25%, 30%, 50%, 75%) with recovery percentages
- Highlight the user's entered value in the reference table when it matches

**Kelly criterion calculator**
- Inputs: win rate (%), average win ($), average loss ($)
- Output: optimal position size percentage via Kelly formula
- Show fractional Kelly variants (full, half, quarter) as most traders use fractional Kelly

**Fibonacci calculator**
- Inputs: high price, low price
- Color-coded table with all standard retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- Extension levels included: 127.2%, 161.8%, 261.8%
- Click-to-copy on individual price levels

**Correlation matrix**
- Symbol selection via type-to-search (reuse SymbolSearch component) + pre-populated from user's trade history
- Add/remove chips UI for selected symbols
- Maximum 10 symbols
- Time period dropdown: 1D, 5D, 30D, 60D, 90D, 180D, YTD, 365D
- Progress bar with symbol names during OHLCV loading ("Fetching MSFT 3/8...")
- Sequential OHLCV fetches (avoid Yahoo Finance throttling per architecture decision)
- Color-coded matrix cells (green for positive correlation, red for negative)

**Calculator input patterns**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOLS-01 | User can access a Trading Tools page from the navigation | Navbar NAV_LINKS array extension with Wrench icon; `app/tools/page.tsx` route |
| TOOLS-02 | User can calculate risk/reward ratio with visual entry/stop/target display | Extends existing `RiskCalculator.tsx` math; new vertical ladder SVG/div visualization |
| TOOLS-03 | User can project account growth with compound growth calculator | Pure math: `balance * (1 + rate)^period`; Recharts AreaChart from `ChartWidgets.tsx` pattern |
| TOOLS-04 | User can determine recovery requirements from drawdown percentage | Pure math: `gain = (1 / (1 - drawdown)) - 1`; reference table component |
| TOOLS-05 | User can calculate optimal position size via Kelly Criterion | Pure math: `kelly = (W/L * winRate - lossRate) / (W/L)`; fractional variants |
| TOOLS-06 | User can compute Fibonacci retracement and extension levels | Pure math: fixed multipliers against (high - low) range; click-to-copy via `navigator.clipboard` |
| TOOLS-07 | User can view correlation matrix for traded symbols using historical data | Sequential `/api/ohlcv` fetches; `simple-statistics` `sampleCorrelation`; color grid render |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js App Router) | 19 (Next 15) | Page and component rendering | Already in project |
| Recharts | ^2.15.0 | Compound growth area chart | Already in project; used across dashboard |
| simple-statistics | ^7.8.3 | `sampleCorrelation` for Pearson correlation | Locked project decision; lightweight, no deps |
| lucide-react | ^0.469.0 | Wrench icon for navbar | Already in project |
| clsx | ^2.1.1 | Conditional class joining | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useSearchParams` (Next.js) | built-in | `?tab=` bookmarkable tabs | Same pattern as Settings page |
| `navigator.clipboard.writeText` | Web API | Click-to-copy Fibonacci levels | No library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| simple-statistics | Manual Pearson formula | simple-statistics handles edge cases (NaN, identical arrays, length mismatch) correctly; manual is error-prone |
| Recharts AreaChart | Raw SVG | Recharts already in bundle; consistent with dashboard |
| navigator.clipboard | copy-to-clipboard package | Web API is sufficient for modern browsers; no extra package |

**Installation:**
```bash
npm install simple-statistics
```

## Architecture Patterns

### Recommended Project Structure
```
app/
└── tools/
    └── page.tsx              # Tab shell, ?tab= routing, lazy renders each calculator

components/
└── tools/
    ├── RRCalculator.tsx       # TOOLS-02: R:R with price ladder
    ├── GrowthCalculator.tsx   # TOOLS-03: Compound growth + Recharts chart
    ├── DrawdownCalculator.tsx # TOOLS-04: Recovery calc + reference table
    ├── KellyCalculator.tsx    # TOOLS-05: Kelly criterion + fractional variants
    ├── FibCalculator.tsx      # TOOLS-06: Fibonacci levels + click-to-copy
    └── CorrelationMatrix.tsx  # TOOLS-07: Symbol chips + matrix grid

lib/
└── calculators.ts             # Pure math functions (no React, no imports)
```

### Pattern 1: Tab Navigation via `?tab=` (Settings page pattern)
**What:** Read `useSearchParams().get("tab")` to determine active calculator. Default to `"rr"` when absent.
**When to use:** All tab switches — push new URL, do not use `useState` for active tab.
**Example:**
```typescript
// Source: app/settings/page.tsx (existing pattern)
"use client";
import { useSearchParams, useRouter } from "next/navigation";

const TABS = [
  { id: "rr",          label: "R:R" },
  { id: "growth",      label: "Growth" },
  { id: "drawdown",    label: "Drawdown" },
  { id: "kelly",       label: "Kelly" },
  { id: "fibonacci",   label: "Fibonacci" },
  { id: "correlation", label: "Correlation" },
] as const;

export default function ToolsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") ?? "rr") as typeof TABS[number]["id"];

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 border-b dark:border-slate-800 border-slate-200 px-6">
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => router.push(`/tools?tab=${t.id}`)}
            className={clsx(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent dark:text-slate-400 text-slate-500"
            )}
          >{t.label}</button>
        ))}
      </div>
      {/* Active calculator */}
      <div className="p-6">
        {tab === "rr" && <RRCalculator />}
        {tab === "growth" && <GrowthCalculator />}
        ...
      </div>
    </>
  );
}
```

### Pattern 2: Pure Math in `lib/calculators.ts`
**What:** All calculation logic as pure functions — no React, no side effects, fully testable.
**When to use:** Called from `useMemo` inside each calculator component.
**Example:**
```typescript
// Source: derived from standard financial formulas

// Drawdown recovery
export function drawdownRecovery(drawdownPct: number): number {
  if (drawdownPct <= 0 || drawdownPct >= 100) return 0;
  const d = drawdownPct / 100;
  return ((1 / (1 - d)) - 1) * 100;
}

// Kelly criterion
export function kellyFraction(winRate: number, avgWin: number, avgLoss: number): number {
  if (winRate <= 0 || winRate >= 100 || avgLoss <= 0 || avgWin <= 0) return 0;
  const W = winRate / 100;
  const L = 1 - W;
  const b = avgWin / avgLoss; // win/loss ratio
  return (b * W - L) / b;     // Kelly %
}

// Fibonacci levels
export function fibLevels(high: number, low: number): { label: string; price: number; isExtension: boolean }[] {
  const range = high - low;
  const RETRACEMENTS = [0, 23.6, 38.2, 50, 61.8, 78.6, 100];
  const EXTENSIONS = [127.2, 161.8, 261.8];
  return [
    ...RETRACEMENTS.map(pct => ({ label: `${pct}%`, price: high - (range * pct / 100), isExtension: false })),
    ...EXTENSIONS.map(pct => ({ label: `${pct}%`, price: high + (range * (pct - 100) / 100), isExtension: true })),
  ];
}

// Compound growth curve
export function compoundGrowthCurve(
  startBalance: number, monthlyReturnPct: number, months: number
): { month: number; balance: number }[] {
  const rate = monthlyReturnPct / 100;
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    balance: startBalance * Math.pow(1 + rate, i),
  }));
}
```

### Pattern 3: Recharts AreaChart for Compound Growth
**What:** Reuse `AreaChartWidget` pattern from `components/dashboard/ChartWidgets.tsx` — `ResponsiveContainer` + `AreaChart`.
**When to use:** Growth calculator chart output.
**Example:**
```typescript
// Source: components/dashboard/ChartWidgets.tsx (existing pattern)
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, GRID_STROKE, TICK } from "@/components/dashboard/ChartWidgets";

// data shape: { month: number; balance: number }[]
<ResponsiveContainer width="100%" height={200}>
  <AreaChart data={curveData}>
    <defs>
      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
    <XAxis dataKey="month" tick={TICK} tickFormatter={(v) => `Mo ${v}`} />
    <YAxis tick={TICK} tickFormatter={(v) => `$${v.toLocaleString()}`} />
    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, "Balance"]} />
    <Area type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={2} fill="url(#growthGrad)" dot={false} />
  </AreaChart>
</ResponsiveContainer>
```

### Pattern 4: Sequential OHLCV Fetches (Correlation Matrix)
**What:** Fetch one symbol at a time with `await` inside a `for` loop. Update progress state after each fetch.
**When to use:** Correlation matrix "Calculate" button handler. Never `Promise.all` for Yahoo Finance.
**Example:**
```typescript
// Source: STATE.md — "Sequential OHLCV fetches (not Promise.all) to avoid Yahoo Finance throttling"
async function fetchAll(symbols: string[], range: string) {
  const results: Record<string, number[]> = {};
  for (let i = 0; i < symbols.length; i++) {
    setProgress({ current: i + 1, total: symbols.length, symbol: symbols[i] });
    const bars = await fetch(`/api/ohlcv?symbol=${symbols[i]}&interval=1d&range=${range}`)
      .then(r => r.json());
    results[symbols[i]] = bars.map((b: { close: number }) => b.close);
  }
  return results;
}
```

### Pattern 5: `simple-statistics` Pearson Correlation
**What:** Call `sampleCorrelation(seriesA, seriesB)` from `simple-statistics`. Align series by intersecting timestamps first.
**When to use:** After all OHLCV data is fetched, compute the N×N matrix.
**Example:**
```typescript
import { sampleCorrelation } from "simple-statistics";

function buildMatrix(data: Record<string, number[]>, symbols: string[]): number[][] {
  return symbols.map(a =>
    symbols.map(b => {
      if (a === b) return 1;
      const seriesA = data[a];
      const seriesB = data[b];
      const minLen = Math.min(seriesA.length, seriesB.length);
      if (minLen < 2) return 0;
      // Use most-recent shared window
      return sampleCorrelation(seriesA.slice(-minLen), seriesB.slice(-minLen));
    })
  );
}
```

### Pattern 6: Navbar Addition
**What:** Add Tools to `NAV_LINKS` array in `components/Navbar.tsx`. Use `Wrench` icon from `lucide-react`.
**When to use:** The single change to Navbar for TOOLS-01.
**Example:**
```typescript
// Source: components/Navbar.tsx — existing NAV_LINKS array
import { Wrench } from "lucide-react";

const NAV_LINKS = [
  { href: "/",          label: "Dashboard", icon: Layout },
  { href: "/trades",    label: "Trades",    icon: TrendingUp },
  { href: "/journal",   label: "Journal",   icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/chart",     label: "Chart",     icon: LineChart },
  { href: "/tools",     label: "Tools",     icon: Wrench },  // ADD
];
```

### Pattern 7: R:R Price Ladder Visualization
**What:** A vertical div-based ladder showing three price lines (entry, stop, target) with colored zone bands. No SVG or canvas needed.
**When to use:** Main R:R calculator display, replaces the flat stat grid from `RiskCalculator.tsx` for the standalone tool.
**Example:**
```typescript
// Vertical ladder via CSS — map prices to percentage positions in a fixed-height container
// Normalize: positionPct = (price - minPrice) / (maxPrice - minPrice) * 100
// Entry line: neutral color (slate-400)
// Stop zone: red background between entry and stop
// Target zone: green background between entry and target
const minPrice = Math.min(entry, stopLoss, takeProfit);
const maxPrice = Math.max(entry, stopLoss, takeProfit);
const range = maxPrice - minPrice;
const toPercent = (p: number) => ((p - minPrice) / range) * 100;
// Render as absolute-positioned divs inside a relative container
```

### Anti-Patterns to Avoid
- **`Promise.all` for OHLCV fetches:** Yahoo Finance rate-limits parallel requests. Always use sequential `for` loop with `await`.
- **Storing calculator results in DB:** Out of scope per REQUIREMENTS.md. All state is component-local.
- **Importing `RiskCalculator.tsx` directly into the R:R tool:** The standalone R:R calculator needs a visual price ladder not present in `RiskCalculator.tsx`. Extract the math logic into `lib/calculators.ts` instead of inheriting the component.
- **Using `useState` for active tab:** Use `useSearchParams()` + `router.push()` to keep tabs bookmarkable (established Settings page pattern).
- **Fetching trade history client-side in `CorrelationMatrix.tsx` on every render:** Fetch once on mount and memoize the symbol list.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pearson correlation coefficient | Custom correlation loop | `simple-statistics` `sampleCorrelation` | Handles NaN, short series, identical arrays; correct Fisher-Pearson implementation |
| Area chart for growth curve | Raw SVG path drawing | Recharts `AreaChart` (already in bundle) | Already in project; matches dashboard visual language exactly |
| Symbol autocomplete with debounce | Custom search input | `SymbolSearch` component (reuse as-is) | Already has debounce, FMP API integration, dropdown UX |
| Position sizing math | Reimplemented formulas | Extract from `PositionSizer.tsx` into `lib/calculators.ts` | Math already validated and correct |
| R:R math (stop distance, ratio) | Reimplemented formulas | Extract from `RiskCalculator.tsx` into `lib/calculators.ts` | Math already handles trailing stop edge cases |

**Key insight:** This phase is primarily UI composition over existing infrastructure. The hardest part (OHLCV data, symbol search, charting, R:R math, position sizing) is already solved — the work is assembling it with the new calculator UI.

## Common Pitfalls

### Pitfall 1: OHLCV Range Parameter Mismatch
**What goes wrong:** The existing `/api/ohlcv` route accepts `range` values: `"1d"`, `"2d"`, `"5d"`, `"14d"`, `"1mo"`, `"3mo"`, `"1y"`. The correlation matrix UI exposes `1D, 5D, 30D, 60D, 90D, 180D, YTD, 365D`. These do NOT map 1-to-1.
**Why it happens:** The UI periods are user-friendly; the API range strings are Yahoo Finance native.
**How to avoid:** Create a mapping object in `CorrelationMatrix.tsx`:
```typescript
const PERIOD_TO_RANGE: Record<string, string> = {
  "1D": "1d", "5D": "5d", "30D": "1mo", "60D": "3mo",
  "90D": "3mo", "180D": "1y", "YTD": "1y", "365D": "1y",
};
```
For YTD, fetch `1y` and trim to Jan 1 client-side.
**Warning signs:** Empty matrix cells, 0 correlations across all pairs.

### Pitfall 2: Pearson Correlation with Misaligned Series Lengths
**What goes wrong:** Different symbols may have different trading days (holidays, halted trading, different exchanges). `sampleCorrelation` requires equal-length arrays.
**Why it happens:** OHLCV bars are indexed by timestamp, not guaranteed to align across symbols.
**How to avoid:** Align by common timestamps before computing correlation — intersect timestamp sets:
```typescript
function alignSeries(a: {time:number; close:number}[], b: {time:number; close:number}[]) {
  const bMap = new Map(b.map(x => [x.time, x.close]));
  const aligned = a.filter(x => bMap.has(x.time));
  return {
    seriesA: aligned.map(x => x.close),
    seriesB: aligned.map(x => bMap.get(x.time)!),
  };
}
```
**Warning signs:** `NaN` values in correlation matrix.

### Pitfall 3: Kelly Criterion Edge Cases
**What goes wrong:** Kelly formula returns negative (bet nothing) or > 1 (bet everything). Both are valid mathematical outputs but need UI clamping.
**Why it happens:** Win rate < 50% at unfavorable odds gives negative Kelly. High win rates at high W/L ratios give > 100%.
**How to avoid:** Clamp to `[0, 100]%` for display. Show a warning when full Kelly > 25% ("High Kelly — consider fractional"). Handle 0% and 100% win rate explicitly (return 0).
**Warning signs:** Negative percentages or percentages over 100% displayed to user.

### Pitfall 4: `useSearchParams` Requires Suspense
**What goes wrong:** Next.js App Router throws an error if a component calls `useSearchParams()` without being wrapped in `<Suspense>`.
**Why it happens:** `useSearchParams` is a dynamic API; Next.js requires Suspense for static rendering compatibility.
**How to avoid:** Wrap the inner component that calls `useSearchParams` in `<Suspense>` at the page level, or use a pattern like:
```typescript
// app/tools/page.tsx
import { Suspense } from "react";
export default function ToolsPage() {
  return <Suspense fallback={<div>Loading...</div>}><ToolsContent /></Suspense>;
}
function ToolsContent() {
  const searchParams = useSearchParams(); // safe inside Suspense
  ...
}
```
**Warning signs:** Build error: "useSearchParams() should be wrapped in a suspense boundary".

### Pitfall 5: Pre-populating Correlation Symbols from Trade History
**What goes wrong:** Fetching the user's trade history in `CorrelationMatrix.tsx` on every render or in a `useEffect` without proper deduplication.
**Why it happens:** Trade endpoint returns all trades; symbols need to be deduplicated and limited.
**How to avoid:** Fetch `GET /api/trades?account_id=...&status=closed` once on mount, extract unique symbols (top 5 by frequency), set as default chips. Use `useEffect` with empty deps array.

### Pitfall 6: `simple-statistics` TypeScript Import
**What goes wrong:** `import sampleCorrelation from "simple-statistics"` may fail — the package uses named exports.
**Why it happens:** simple-statistics uses ES module named exports.
**How to avoid:** Use named import: `import { sampleCorrelation } from "simple-statistics"`. Install types if needed: `npm install --save-dev @types/simple-statistics` (though types are bundled in v7+).

## Code Examples

Verified patterns from official sources and existing codebase:

### Drawdown Recovery Formula
```typescript
// Standard financial formula — verified against multiple sources
// If drawdown = 50%, you need +100% gain to recover: 1/(1-0.5) - 1 = 1.0
export function drawdownRecovery(drawdownPct: number): number {
  if (drawdownPct <= 0) return 0;
  if (drawdownPct >= 100) return Infinity;
  const d = drawdownPct / 100;
  return ((1 / (1 - d)) - 1) * 100;
}

// Reference table (common levels):
const COMMON_DRAWDOWNS = [5, 10, 20, 25, 30, 50, 75];
// Pre-compute: [5 → 5.26%, 10 → 11.11%, 20 → 25%, 25 → 33.33%, 30 → 42.86%, 50 → 100%, 75 → 300%]
```

### Kelly Criterion Formula
```typescript
// Standard Kelly formula: f* = (bp - q) / b
// where b = avg_win/avg_loss, p = win_rate, q = 1 - p
export function kellyFraction(winRatePct: number, avgWin: number, avgLoss: number): number {
  if (winRatePct <= 0 || winRatePct >= 100 || avgLoss <= 0 || avgWin <= 0) return 0;
  const p = winRatePct / 100;
  const q = 1 - p;
  const b = avgWin / avgLoss;
  const k = (b * p - q) / b;
  return Math.max(0, Math.min(k * 100, 100)); // clamp to [0, 100]%
}
// Fractional variants: half = k/2, quarter = k/4
```

### Fibonacci Levels (Standard Trading Levels)
```typescript
// Source: Standard Fibonacci retracement/extension — universal in trading
// For UPTREND: retracements pull back from HIGH toward LOW
// price = high - (range * ratio)
const FIBO_RETRACEMENTS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIBO_EXTENSIONS   = [1.272, 1.618, 2.618];

export function fibonacciLevels(high: number, low: number) {
  const range = high - low;
  return [
    ...FIBO_RETRACEMENTS.map(r => ({
      label: `${(r * 100).toFixed(1)}%`, price: high - range * r, isExtension: false
    })),
    ...FIBO_EXTENSIONS.map(r => ({
      label: `${(r * 100).toFixed(1)}%`, price: low - range * (r - 1), isExtension: true
    })),
  ];
}
```

### Click-to-Copy Pattern (Fibonacci)
```typescript
// Source: Web API — no library needed
const [copied, setCopied] = useState<string | null>(null);

async function handleCopy(price: number) {
  await navigator.clipboard.writeText(price.toFixed(2));
  setCopied(price.toFixed(2));
  setTimeout(() => setCopied(null), 1500);
}

// In JSX:
<button onClick={() => handleCopy(level.price)}
  className="text-xs dark:text-slate-400 hover:text-emerald-400 transition-colors">
  {copied === level.price.toFixed(2) ? "Copied!" : level.price.toFixed(2)}
</button>
```

### `/api/ohlcv` Route Parameters (Existing)
```typescript
// Source: app/api/ohlcv/route.ts (read directly)
// GET /api/ohlcv?symbol=AAPL&interval=1d&range=3mo
// Valid range values: "1d", "2d", "5d", "14d", "1mo", "3mo", "1y"
// Returns: Array<{ time: number; open: number; high: number; low: number; close: number }>
// Server-side cache: 5 minutes per (symbol, interval, range) key
```

### Pre-populate Symbols from Trade History
```typescript
// Source: existing /api/trades pattern from app/trades/page.tsx
async function loadDefaultSymbols(accountId: string | null): Promise<string[]> {
  const url = accountId
    ? `/api/trades?account_id=${accountId}&status=closed`
    : `/api/trades?status=closed`;
  const trades = await fetch(url).then(r => r.json());
  const freq: Record<string, number> = {};
  for (const t of trades) freq[t.symbol] = (freq[t.symbol] ?? 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sym]) => sym);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate pages per calculator | Single /tools page with tab bar | Phase 8 design decision | Better discoverability; single nav entry |
| Promise.all for batch OHLCV | Sequential for-loop fetches | Architecture decision (STATE.md) | Avoids Yahoo Finance 429 rate limiting |
| Hand-rolled correlation math | simple-statistics sampleCorrelation | Phase 8 dependency decision | Correct Fisher-Pearson; handles edge cases |
| RiskCalculator as display-only component | Extracted math + visual ladder | Phase 8 design | Standalone tool with richer visualization |

**Deprecated/outdated:**
- None for this phase — all dependencies are current.

## Open Questions

1. **YTD period in OHLCV API**
   - What we know: The API supports `range=1y` (1 year), but not a "year-to-date" concept.
   - What's unclear: Whether YTD should trim the 1y data client-side to Jan 1 of current year.
   - Recommendation: Fetch `1y` and filter bars client-side to `timestamp >= Jan 1 this year`. Simple and accurate.

2. **Trade history fetch for pre-population — guest mode**
   - What we know: Guest mode uses `demo-data.ts` and returns demo trades. The OHLCV endpoint accepts guest cookies.
   - What's unclear: Whether the demo trades have symbols that exist in Yahoo Finance.
   - Recommendation: Pre-populate with demo symbols regardless; if OHLCV fetch returns `[]`, show an empty-state message per symbol.

3. **`simple-statistics` bundle size impact**
   - What we know: `simple-statistics` v7 is ~45KB minified, tree-shakeable with named imports.
   - What's unclear: Whether Next.js tree-shaking will eliminate unused functions.
   - Recommendation: Import only `{ sampleCorrelation }` and verify bundle with `npm run build` — no action needed unless build warns.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no jest.config, no vitest.config) |
| Config file | None — see Wave 0 gaps |
| Quick run command | `npm run build` (TypeScript type-check) |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOLS-01 | /tools page accessible from nav | manual-only | N/A | N/A |
| TOOLS-02 | R:R calculation correct | manual-only (no test framework) | `npm run build` | N/A |
| TOOLS-03 | Compound growth curve correct | manual-only | `npm run build` | N/A |
| TOOLS-04 | Drawdown recovery math correct | manual-only | `npm run build` | N/A |
| TOOLS-05 | Kelly formula output correct | manual-only | `npm run build` | N/A |
| TOOLS-06 | Fibonacci levels correct | manual-only | `npm run build` | N/A |
| TOOLS-07 | Correlation matrix loads and displays | manual-only | `npm run build` | N/A |

**Note:** This project has no test framework configured. `npm run build` is the only automated validation available (TypeScript type-checking). All functional correctness is verified manually per CLAUDE.md: "No lint or test commands are configured. `npm run build` is the primary validation step."

### Sampling Rate
- **Per task commit:** `npm run build`
- **Per wave merge:** `npm run build`
- **Phase gate:** Build passes + manual smoke test of each calculator before `/gsd:verify-work`

### Wave 0 Gaps
- None for test infrastructure (no framework exists; project standard is build-only validation)
- `lib/calculators.ts` — new file with all pure math functions (must be created in Wave 1 before calculator components)

## Sources

### Primary (HIGH confidence)
- `components/RiskCalculator.tsx` — R:R math, existing implementation
- `components/PositionSizer.tsx` — position sizing math, existing implementation
- `components/SymbolSearch.tsx` — symbol autocomplete, exact reuse
- `components/Navbar.tsx` — NAV_LINKS array, exact modification point
- `app/api/ohlcv/route.ts` — valid range strings, response shape
- `components/dashboard/ChartWidgets.tsx` — Recharts pattern, TOOLTIP_STYLE constants
- `app/settings/page.tsx` — `?tab=` query param pattern
- `package.json` — confirmed dependencies (recharts ^2.15.0, lucide-react ^0.469.0, no simple-statistics yet)
- `.planning/phases/08-trading-tools-hub/08-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- [simple-statistics npm](https://www.npmjs.com/package/simple-statistics) — `sampleCorrelation` function availability confirmed, Fisher-Pearson implementation verified
- [simple-statistics GitHub](https://github.com/simple-statistics/simple-statistics) — named exports confirmed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are in package.json or confirmed via npm search; simple-statistics API confirmed
- Architecture: HIGH — patterns directly derived from reading existing codebase files
- Math formulas: HIGH — drawdown recovery, Kelly, Fibonacci are standard financial formulas with deterministic outputs
- OHLCV integration: HIGH — route read directly, response shape known
- Pitfalls: HIGH — derived from reading actual code and architecture decisions in STATE.md

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (stable dependencies, no fast-moving APIs)
