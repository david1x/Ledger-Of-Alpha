# Milestones

## v2.1 Settings & Polish (Shipped: 2026-03-21)

**Phases completed:** 6 phases (12-17), 10 plans
**Timeline:** 2 days (2026-03-19 → 2026-03-21)
**Files modified:** 82 | **Commits:** 51
**Git range:** feat(12-01) → docs(phase-17)

**Key accomplishments:**
1. Email URL auto-detection — request-aware URL resolver with 5-level priority chain (DB override > X-Forwarded > Host > env > localhost)
2. Settings page decomposed — 2380-line monolith split into per-tab components with full-width layout, dirty-state indicators, and "Appearance" tab rename
3. Admin panel as runtime config hub — system-level API keys (FMP, Gemini) with sentinel masking, auto-detected URL, and connection test buttons for SMTP/FMP/Gemini
4. Dashboard layout templates — save/load/delete named presets with 2 built-in templates (Performance Review, Daily Monitor), per-account layout storage
5. Strategy & checklist overhaul — 5 built-in strategies in lib/strategies.ts, per-trade checklist editing, ad-hoc checklists, ChecklistRing progress badges
6. Fibonacci cleanup — orphaned code removed from lib/calculators.ts and planning docs

### Known Gaps
- **SETT-02**: Settings page split into per-tab components — code is shipped (13 tab components exist), but ROADMAP progress table was not updated to reflect 2/2 completion. Documentation-only gap.

---

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
