# Phase 21: Summary Stats Bar - Research

**Researched:** 2026-03-21
**Domain:** React component authoring, recharts sparklines, trades-page integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three individual card containers (not a horizontal strip) with dashboard widget styling (dark:bg-slate-800, rounded-xl, shadow)
- Each card: label at top, headline value (color-coded), subtitle text, sparkline at bottom
- 3-column grid layout, responsive (MOBI-03 specifies 2-column on small screens — Phase 23 handles that)
- Cards placed where AccountBanner currently sits — **replaces AccountBanner** on the trades page (AccountBanner removed from trades page only, still used on journal/dashboard)
- Sparklines: decorative only — no hover tooltip, no interactivity
- Data points ordered by trade exit_date (one point per closed trade)
- Small inline area charts using recharts (not lightweight-charts)
- Stats respond to ALL active filters (symbol, setup, side, date, account, etc.) — not just date range
- Shows "Based on X of Y trades" label below the cards when filters are active
- Zero filtered trades: show zeros/dashes with flat sparklines, no layout shift (cards remain visible)
- **Cumulative Return**: Sum of P&L for filtered closed trades. Primary: dollar amount. Subtitle: percentage of starting balance. Color: emerald if positive, red if negative.
- **P/L Ratio**: Average winning trade / |average losing trade|. Primary: ratio number. Subtitle: "Avg $X / $Y". Color: emerald if > 1.0, red if < 1.0.
- **Win %**: Winners / total closed trades * 100. Primary: percentage. Subtitle: "XW / YL". Color: emerald if > 50%, red if < 50%.
- Headline values color-coded: emerald-400 for positive/good, red-400 for negative/bad
- Must respect usePrivacy() hook — mask all dollar amounts, percentages, and counts when privacy mode is active

### Claude's Discretion
- Exact sparkline content per stat card (cumulative curve vs rolling metric)
- Sparkline height and styling details
- Card internal spacing and typography scale
- Edge case handling (no losers for P/L ratio, single trade, etc.)
- Whether to animate stat transitions on filter change

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAT-01 | User can see cumulative return, P/L ratio, and win % in a summary stats bar | Component architecture and stat computation patterns documented below |
| STAT-02 | User can see sparkline charts in each summary stat card | Recharts decorative-sparkline pattern documented below |
| STAT-03 | Summary stats reflect all trades unless a date filter is active (then scoped to date range) | Note: CONTEXT.md overrides this — stats scope to ALL active filters via filteredTrades, not just date |
</phase_requirements>

---

## Summary

Phase 21 adds a `SummaryStatsBar` component to the trades page that replaces `AccountBanner`. It is a pure client-side component: it receives `filteredTrades`, `allTrades`, and `accountSize` as props and derives three stat cards (Cumulative Return, P/L Ratio, Win %) from them using `useMemo`. Each card contains a decorative recharts `AreaChart` sparkline. No new API routes, no new data fetching, and no new database interactions are required.

The implementation is entirely within `components/trades/`. The single new file is `SummaryStatsBar.tsx`. The only other change is to `TradesShell.tsx`: swap the `AccountBanner` usage for `SummaryStatsBar` and pass the correct props. `AccountBanner` itself is untouched and continues to be used on journal and dashboard pages.

All recharts primitives needed (ResponsiveContainer, AreaChart, Area, linearGradient) are already installed and in use across the codebase. The privacy masking pattern via `usePrivacy()` is established and straightforward to apply.

**Primary recommendation:** Build `SummaryStatsBar` as a single self-contained file in `components/trades/`. It computes all stats and sparkline data internally via `useMemo`, then renders three cards each using an inline stripped-down `AreaChart` with no axes, no tooltip, and no interactivity.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | installed | Sparkline area charts | Already used throughout dashboard; `AreaChart`, `Area`, `ResponsiveContainer` patterns proven |
| React (useMemo) | installed | Stat derivation | AccountBanner establishes this pattern; no external computation needed |
| Tailwind CSS v3 | installed | Card layout and color coding | Entire app uses Tailwind; `dark:bg-slate-800`, `rounded-xl`, `emerald-400`, `red-400` classes confirmed |
| next-themes / usePrivacy | installed | Privacy masking | PrivacyProvider wraps the app; `usePrivacy()` hook gives `{ hidden }` boolean |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | installed | Optional icon accents per card | Use if card headers benefit from small icons (optional) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts sparkline | lightweight-charts | User explicitly chose recharts; lightweight-charts is for full TradingView-style charts |
| inline useMemo stats | separate hook | Premature abstraction for 3 derived values — keep inline |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

The new component lives alongside other trades-page sub-components:

```
components/trades/
├── SummaryStatsBar.tsx     ← NEW (this phase)
├── TradesShell.tsx         ← MODIFIED (swap AccountBanner for SummaryStatsBar)
├── TradeFilterBar.tsx
├── TradeFilterChips.tsx
├── SavedViewsDropdown.tsx
└── TradeImportExport.tsx
```

### Pattern 1: Stats Computation via useMemo (AccountBanner Pattern)

**What:** Derive all stats from the filtered trades array in a single `useMemo` block.
**When to use:** Any time a component needs multiple aggregate values from a trades array — avoids multiple passes and prevents stale values.

```typescript
// Mirrors AccountBanner.tsx lines 15-35
const stats = useMemo(() => {
  const closed = filteredTrades.filter(t => t.status === "closed");
  const winners = closed.filter(t => (t.pnl ?? 0) > 0);
  const losers  = closed.filter(t => (t.pnl ?? 0) < 0);

  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winRate  = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const avgWin  = winners.length > 0
    ? winners.reduce((s, t) => s + (t.pnl ?? 0), 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length)
    : 0;
  const plRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  return { totalPnl, winRate, avgWin, avgLoss, plRatio,
           winners: winners.length, losers: losers.length, closed: closed.length };
}, [filteredTrades]);
```

### Pattern 2: Decorative Sparkline (No Axes, No Tooltip)

**What:** A minimal recharts `AreaChart` rendered at fixed height with all interactive/decorative chrome stripped away. Recharts supports this — remove `XAxis`, `YAxis`, `CartesianGrid`, and `Tooltip`; keep only `AreaChart`, `Area`, `linearGradient`, and `ResponsiveContainer`.
**When to use:** Whenever a chart is purely decorative and interactivity would clutter a small card.

```typescript
// Decorative sparkline — no axes, no tooltip, no interactive dots
// Source: recharts AreaChart API (decorative pattern confirmed in codebase)
<ResponsiveContainer width="100%" height={48}>
  <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
        <stop offset="95%" stopColor={color} stopOpacity={0}    />
      </linearGradient>
    </defs>
    <Area
      type="monotone"
      dataKey="value"
      stroke={color}
      strokeWidth={1.5}
      fill={`url(#${gradientId})`}
      dot={false}
      activeDot={false}
      isAnimationActive={false}
    />
  </AreaChart>
</ResponsiveContainer>
```

Key: `activeDot={false}` and no `<Tooltip>` make the chart completely non-interactive.
`isAnimationActive={false}` prevents recharts animation on every filter change (avoids distracting motion).

### Pattern 3: Privacy Masking

**What:** Conditionally replace sensitive values with a fixed mask string when `hidden` is `true`.
**When to use:** Any numeric value that reveals trading performance.

```typescript
// Source: components/AccountBanner.tsx line 37-38 + privacy-context.tsx
const { hidden } = usePrivacy();
const MASK = "------";

// Usage:
<span className={...}>{hidden ? MASK : `$${stats.totalPnl.toFixed(2)}`}</span>
```

Privacy masking applies to: dollar amounts, percentages, win/loss counts, and ratio numbers. Sparkline shapes can remain visible (they don't reveal actual values).

### Pattern 4: "Based on X of Y trades" Label

**What:** Show a contextual count label below the stat cards when any filter is active.
**When to use:** When `filteredTrades.length < allTrades.length`.

```typescript
const isFiltered = filteredTrades.length < allTrades.length;
// Below the cards grid:
{isFiltered && (
  <p className="text-center text-xs dark:text-slate-500 text-slate-400 mt-2">
    Based on {filteredTrades.length} of {allTrades.length} trades
  </p>
)}
```

The count itself should also be masked when `hidden` is true.

### Pattern 5: Sparkline Data Derivation

**What:** Build sparkline data arrays from the sorted closed-trade sequence.

Recommended sparkline content per card (Claude's discretion):
- **Cumulative Return card:** Running cumulative P&L curve. Each point is `{ value: runningSum }` after sorting closed trades by `exit_date`.
- **P/L Ratio card:** Rolling 10-trade P/L ratio (or flat if fewer than 2 trades). Shows trend of ratio improving or degrading.
- **Win % card:** Rolling 10-trade win rate. Each point is `{ value: rollingWinPct }`.

```typescript
const sparkData = useMemo(() => {
  const sorted = [...filteredTrades]
    .filter(t => t.status === "closed" && t.exit_date)
    .sort((a, b) => (a.exit_date! > b.exit_date! ? 1 : -1));

  // Cumulative P&L sparkline
  let running = 0;
  const cumulativeSpark = sorted.map(t => {
    running += t.pnl ?? 0;
    return { value: running };
  });

  // Rolling win % sparkline (window of 10)
  const WINDOW = 10;
  const winRateSpark = sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const wins = slice.filter(t => (t.pnl ?? 0) > 0).length;
    return { value: (wins / slice.length) * 100 };
  });

  // Rolling P/L ratio sparkline (window of 10)
  const plRatioSpark = sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const w = slice.filter(t => (t.pnl ?? 0) > 0);
    const l = slice.filter(t => (t.pnl ?? 0) < 0);
    const avgW = w.length > 0 ? w.reduce((s, t) => s + (t.pnl ?? 0), 0) / w.length : 0;
    const avgL = l.length > 0 ? Math.abs(l.reduce((s, t) => s + (t.pnl ?? 0), 0) / l.length) : 0;
    return { value: avgL > 0 ? avgW / avgL : 0 };
  });

  return { cumulativeSpark, winRateSpark, plRatioSpark };
}, [filteredTrades]);
```

### Pattern 6: TradesShell Integration Point

**What:** Replace the `AccountBanner` block (lines 239-246 of TradesShell.tsx) with `SummaryStatsBar`.

```typescript
// REMOVE:
import AccountBanner from "@/components/AccountBanner";
// ...
<AccountBanner
  trades={allTrades}
  quotes={quotes}
  accountSize={accountSize}
  hidden={hidden}
  onToggleHidden={toggleHidden}
/>

// ADD:
import SummaryStatsBar from "./SummaryStatsBar";
// ...
<SummaryStatsBar
  filteredTrades={filteredTrades}
  allTrades={allTrades}
  accountSize={accountSize}
/>
```

`SummaryStatsBar` calls `usePrivacy()` internally — no need to pass `hidden` as prop.

### Anti-Patterns to Avoid

- **Passing `hidden` as a prop:** The component should call `usePrivacy()` directly. `AccountBanner` took it as a prop because it predates `PrivacyProvider`; new components should use the hook.
- **Fetching data inside SummaryStatsBar:** All data is already loaded in TradesShell. Pass it as props; no additional API calls.
- **Showing tooltip on sparkline:** The CONTEXT.md explicitly requires decorative-only charts. Adding `<Tooltip>` creates unexpected interaction.
- **Using unique gradientId strings that collide:** Three `AreaChart` instances on the same page each need a distinct `id` for their `linearGradient` (e.g., `statGradCumulative`, `statGradPL`, `statGradWin`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sparkline chart | Custom SVG path | recharts AreaChart (stripped) | Recharts handles SVG path math, responsive sizing, and edge cases (single point, all-same values) |
| Privacy masking | Custom context | usePrivacy() from lib/privacy-context | Already wired at app root; cross-tab sync built in |
| Responsive container | `useRef` + ResizeObserver | recharts `ResponsiveContainer` | Built into recharts, already used in 10+ places in this codebase |

**Key insight:** Every tool needed for this phase is already installed and proven in this codebase. The work is composition, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Gradient ID Collision
**What goes wrong:** Three `AreaChart` instances each define a `<linearGradient id="grad">`. SVG `id` attributes are document-scoped, so all three charts share the first gradient — wrong colors appear on two of the three sparklines.
**Why it happens:** recharts generates its own SVG `<defs>` per chart, but if all use the same `id`, the browser deduplicates.
**How to avoid:** Use unique gradient IDs per chart: `statGradCumulative`, `statGradPL`, `statGradWin`.
**Warning signs:** Two cards look identical color-wise despite different stats.

### Pitfall 2: Zero-Data Edge Case Causes Layout Shift
**What goes wrong:** When `filteredTrades` has 0 closed trades, recharts renders nothing and the sparkline container collapses, causing the card to shrink.
**Why it happens:** recharts `AreaChart` with an empty `data` array renders an empty SVG.
**How to avoid:** When `sparkData` is empty, render a flat line instead:
```typescript
const safeData = sparkData.length > 0 ? sparkData : [{ value: 0 }, { value: 0 }];
```
The card's height is determined by its CSS (e.g., `h-12` on the sparkline container), not by chart content.

### Pitfall 3: Infinite P/L Ratio Display
**What goes wrong:** If all filtered trades are winners (no losers), `avgLoss = 0` and `plRatio = Infinity`. Displaying `Infinity` breaks formatting.
**Why it happens:** Division by zero in ratio formula.
**How to avoid:** Special-case `Infinity` in the display string:
```typescript
const plRatioDisplay = !isFinite(stats.plRatio) ? "—" : stats.plRatio.toFixed(2);
```
Subtitle: when no losers exist, show "Avg $X / $0" or "No losers".

### Pitfall 4: Sparkline Animates on Every Filter Change
**What goes wrong:** Each filter change causes all three sparklines to animate their area fill from zero, which is visually distracting on a page where filters change frequently.
**Why it happens:** recharts animates AreaChart by default.
**How to avoid:** Set `isAnimationActive={false}` on the `<Area>` component.

### Pitfall 5: Open Trades Included in Stats
**What goes wrong:** Stats accidentally include open trades where `pnl` is null or a live value, distorting Cumulative Return and Win %.
**Why it happens:** Not filtering `t.status === "closed"` before computing stats.
**How to avoid:** All stat computation MUST filter to `status === "closed"` first — same as AccountBanner does.

---

## Code Examples

### Complete Card Shell (layout reference)

```typescript
// Source: AccountBanner.tsx pattern + CONTEXT.md layout spec
<div className="grid grid-cols-3 gap-4">
  {/* Cumulative Return Card */}
  <div className="dark:bg-slate-800 bg-white rounded-xl shadow p-4 flex flex-col gap-1">
    <span className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">
      Cumulative Return
    </span>
    <span className={`text-2xl font-bold ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {hidden ? MASK : `${stats.totalPnl >= 0 ? "+" : ""}$${Math.abs(stats.totalPnl).toFixed(2)}`}
    </span>
    <span className="text-xs dark:text-slate-400 text-slate-500">
      {hidden ? "" : `${(stats.totalPnl / accountSize * 100).toFixed(1)}% of account`}
    </span>
    {/* Sparkline */}
    <div className="mt-auto pt-2 h-12">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparkData.cumulativeSpark.length > 0 ? sparkData.cumulativeSpark : FLAT}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="statGradCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={stats.totalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.35} />
              <stop offset="95%" stopColor={stats.totalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value"
            stroke={stats.totalPnl >= 0 ? "#22c55e" : "#ef4444"}
            strokeWidth={1.5}
            fill="url(#statGradCumulative)"
            dot={false} activeDot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>

  {/* P/L Ratio Card — same shell, different data/color logic */}
  {/* Win % Card — same shell, different data/color logic */}
</div>
```

### "Based on X of Y trades" label

```typescript
// Below the 3-column grid
{filteredTrades.length < allTrades.length && (
  <p className="text-center text-xs dark:text-slate-500 text-slate-400 -mt-2">
    {hidden ? "Based on — of — trades" : `Based on ${filteredTrades.length} of ${allTrades.length} trades`}
  </p>
)}
```

### Prop Interface

```typescript
interface SummaryStatsBarProps {
  filteredTrades: Trade[];
  allTrades: Trade[];
  accountSize: number;
}
```

No `hidden` or `onToggleHidden` — the component uses `usePrivacy()` internally.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AccountBanner: flat horizontal strip of stats | SummaryStatsBar: three individual cards with sparklines | Phase 21 | More visual weight per stat; sparkline adds trend context |
| Privacy state passed as prop | Privacy state from usePrivacy() hook | Phase 19 | New components should use the hook directly |

**Deprecated/outdated:**
- AccountBanner on the trades page: Replaced by SummaryStatsBar. Keep the file — it's still used on journal and dashboard pages.

---

## Open Questions

1. **P/L ratio subtitle when no losers exist**
   - What we know: `avgLoss = 0` when there are no losers.
   - What's unclear: Best user-facing text ("No losers" vs "—" vs "N/A").
   - Recommendation: Show "—" as the ratio and "No losing trades" as subtitle. This is the clearest.

2. **Color of P/L ratio sparkline**
   - What we know: The headline uses emerald/red based on ratio vs 1.0.
   - What's unclear: Should the sparkline color match the headline or use a neutral color.
   - Recommendation: Use a neutral blue (same as the dashboard's win% chart — `#3b82f6`) so the sparkline trend is readable regardless of the current ratio value, which avoids the gradient flipping color as the rolling window crosses 1.0.

---

## Sources

### Primary (HIGH confidence)
- `components/AccountBanner.tsx` — stat computation pattern, privacy masking pattern, color scheme
- `components/dashboard/ChartWidgets.tsx` — AreaChart + ResponsiveContainer + linearGradient patterns
- `components/trades/TradesShell.tsx` — integration point location (lines 239-246), available state (`filteredTrades`, `allTrades`, `accountSize`)
- `lib/privacy-context.tsx` — usePrivacy() hook API
- `lib/types.ts` — Trade interface (status, pnl, exit_date fields confirmed)
- `.planning/phases/21-summary-stats-bar/21-CONTEXT.md` — locked decisions and stat definitions

### Secondary (MEDIUM confidence)
- recharts AreaChart API — decorative sparkline pattern (stripping axes/tooltip) verified by existing codebase usage and recharts documentation behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed and in use
- Architecture: HIGH — direct code inspection of AccountBanner, ChartWidgets, TradesShell, and PrivacyProvider
- Pitfalls: HIGH — gradient ID collision and animation issues are well-known recharts gotchas, zero-data and Infinity cases are logic-visible from the stat definitions

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable stack; no fast-moving dependencies)
