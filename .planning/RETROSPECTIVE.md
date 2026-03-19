# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Intelligence & Automation

**Shipped:** 2026-03-19
**Phases:** 4 | **Plans:** 12 | **Timeline:** 2 days

### What Was Built
- Trading Tools Hub with 5 calculators (R:R, compound growth, drawdown recovery, Kelly criterion, correlation matrix)
- Monte Carlo risk preview integrated into trade entry modal with Web Worker, ruin probability warnings, and position sizing suggestions
- AI chart pattern recognition via Gemini 2.5 Flash with screenshot upload, confidence scoring, follow-up Q&A, and trade linking
- Pattern performance analytics with per-pattern win rate and P&L aggregation
- IBKR broker sync with Client Portal REST, manual trade import, deduplication, and live positions dashboard widget

### What Worked
- Rapid execution: 4 phases in 2 days across 12 plans
- Phase isolation: each phase was independently deployable with clear boundaries
- VERIFICATION.md caught the FibCalculator deletion before milestone completion
- Web Worker pattern for Monte Carlo kept UI responsive
- Sequential OHLCV fetches with progress bar turned a limitation into good UX

### What Was Inefficient
- FibCalculator.tsx was deleted after verification passed — caught during milestone audit but not during active development
- SUMMARY.md frontmatter `requirements_completed` never populated — metadata gap across all 12 plans
- Phase 9 roadmap checkbox never updated to `[x]` and plan count showed "1/2" despite 2/2 completion
- AI settings key named `openai_api_key` despite switching to Gemini — will cause confusion later
- Custom date range in IBKR sync route accepted but not actually used (always 30d)

### Patterns Established
- Web Worker for compute-heavy client-side operations (Monte Carlo)
- Collapsible panels with settings persistence for progressive disclosure (MC preview)
- `INSERT OR IGNORE` with partial UNIQUE index for external data deduplication
- Cloud AI with structured JSON schema for reliable pattern extraction
- Hidden-by-default dashboard widgets for optional features (IBKR positions)

### Key Lessons
1. **Verify after deletion, not just after creation** — The Fibonacci calculator was verified, then deleted. Verification should be re-run if files are removed.
2. **Name settings keys by function, not provider** — `openai_api_key` should have been `ai_api_key` from the start. Provider switches happen.
3. **Update roadmap progress atomically with execution** — Phase 9 roadmap showed stale data because progress wasn't updated when plans completed.

### Cost Observations
- Model mix: balanced profile (sonnet for executors, opus for orchestration)
- Notable: 12 plans in 2 days — high throughput enabled by clear phase boundaries and minimal cross-phase dependencies

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0.0 | 16 days | 7 | ~15 | Initial build, establishing patterns |
| v2.0 | 2 days | 4 | 12 | Mature codebase, faster execution, AI/broker integration |

### Top Lessons (Verified Across Milestones)

1. Phase isolation enables parallel and rapid execution
2. Verification catches gaps that unit logic cannot — always verify before shipping
3. Settings persistence via key-value store scales well across features
