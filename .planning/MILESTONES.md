# Milestones

## v2.0 Intelligence & Automation (Shipped: 2026-03-19)

**Phases completed:** 4 phases, 12 plans
**Timeline:** 2 days (2026-03-16 → 2026-03-18)
**Files modified:** 72 | **LOC:** 21,540 TypeScript
**Git range:** feat(08-01) → feat(11-03)

**Key accomplishments:**
1. Trading Tools Hub — 5 standalone calculators (R:R, compound growth, drawdown recovery, Kelly criterion, correlation matrix) on dedicated /tools page
2. Monte Carlo risk preview integrated into trade entry modal with Web Worker, ruin probability warnings, and suggested position sizing
3. AI chart pattern recognition via Gemini 2.5 Flash — screenshot upload, pattern identification with confidence scores, trade linking
4. Pattern performance analytics — aggregate stats by AI-detected pattern type with expandable trade rows
5. IBKR broker sync — gateway connection, manual trade import with deduplication, live positions dashboard widget

### Known Gaps
- **TOOLS-06**: Fibonacci calculator — descoped by user decision. `FibCalculator.tsx` and orphaned `lib/calculators.ts` code were removed. 5 of 6 original calculators remain on /tools page (R:R, compound growth, drawdown recovery, Kelly criterion, correlation matrix). Resolved in Phase 17.

---

