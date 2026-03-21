# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.1 — Settings & Polish

**Shipped:** 2026-03-21
**Phases:** 6 | **Plans:** 10 | **Timeline:** 2 days

### What Was Built
- Email URL auto-detection with 5-level priority chain (DB override > X-Forwarded > Host > env > localhost)
- Settings page decomposed from 2380-line monolith into 13 per-tab components with full-width layout and dirty-state indicators
- Admin panel as runtime config hub with system-level API keys, sentinel masking, auto-detected URL, and connection test buttons
- Dashboard layout templates with save/load/delete, 2 built-in presets, per-account storage
- Strategy & checklist overhaul: 5 built-in strategies, per-trade checklist editing, ad-hoc checklists, ChecklistRing badges
- Fibonacci orphaned code cleanup from codebase and planning docs

### What Worked
- Phase isolation continued to enable rapid execution: 6 phases in 2 days
- Sentinel masking pattern cleanly solved the "don't overwrite secrets on re-save" problem
- Per-account layout storage with legacy fallback handled migration gracefully
- ChecklistRing null-return guard prevented rendering issues for trades without checklist data
- getBaseUrl priority chain works zero-config across all deployment modes (npm dev, Docker, Cloudflare Tunnel)

### What Was Inefficient
- Phase 13 ROADMAP progress table was never updated to 2/2 despite both plans completing — same pattern as v2.0 Phase 9
- SETT-02 requirement left unchecked in traceability despite code being shipped — doc tracking lagged implementation
- STATE.md accumulated multiple YAML frontmatter blocks instead of being cleanly overwritten
- summary-extract tool returned null one_liners — summaries didn't use the expected frontmatter field format

### Patterns Established
- Sentinel masking for admin secrets (bullets on GET, skip-upsert on POST when value equals sentinel)
- Per-account settings keys: `dashboard_layout_{accountId}` pattern for account-scoped UI state
- Tab decomposition pattern: thin shell page + self-contained tab components + shared types module
- baselineRef + TAB_FIELDS map for dirty-state tracking across settings tabs
- lib/strategies.ts as single source of truth for built-in strategies (immutable defaults, user copies editable)

### Key Lessons
1. **Roadmap progress tracking is still a gap** — Phase 13 and v2.0 Phase 9 both showed stale progress. Need atomic progress updates when plans complete.
2. **Requirements traceability needs post-execution sweep** — SETT-02 was shipped but not checked off. Traceability should be verified before milestone completion, not during.
3. **STATE.md needs clean overwrite semantics** — Multiple YAML blocks accumulated across sessions. The file should be fully rewritten, not appended to.
4. **Summary frontmatter should include one_liner field** — The summary-extract tool expects it, but none of the v2.1 summaries populated it.

### Cost Observations
- Model mix: balanced profile
- Sessions: multiple across 2 days
- Notable: 10 plans in 2 days — settings decomposition was the heaviest lift (Phase 13), other phases were lighter

---

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
| v2.1 | 2 days | 6 | 10 | Settings/polish — refactoring existing code, no new packages |

### Top Lessons (Verified Across Milestones)

1. Phase isolation enables parallel and rapid execution
2. Verification catches gaps that unit logic cannot — always verify before shipping
3. Settings persistence via key-value store scales well across features
4. **Roadmap progress tracking is a recurring gap** — v2.0 Phase 9 and v2.1 Phase 13 both had stale progress tables (verified across 2 milestones)
5. Documentation tracking lags implementation — traceability sweeps needed before milestone close
