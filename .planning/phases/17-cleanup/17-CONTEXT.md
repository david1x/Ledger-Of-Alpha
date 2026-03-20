# Phase 17: Cleanup - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove orphaned Fibonacci code and planning doc references, leaving no dead code or stale feature claims in the codebase. Source code cleanup is already complete — this phase is planning doc cleanup only.

</domain>

<decisions>
## Implementation Decisions

### Source code (CLEAN-01)
- Already satisfied: `lib/calculators.ts` contains no `fibonacciLevels` function or Fibonacci-related exports
- `components/tools/FibCalculator.tsx` already deleted, tab already removed from `/tools` page
- No `.ts`/`.tsx` files reference Fibonacci — zero code changes needed

### Planning doc cleanup scope (CLEAN-02)
- Clean active/current docs only: MILESTONES.md, STATE.md, PROJECT.md, REQUIREMENTS.md, research/SUMMARY.md, research/FEATURES.md
- Leave archived v2.0 phase 08 docs untouched — they are historical records of what was built and shipped
- v2.0-MILESTONE-AUDIT.md: leave as-is (historical audit record)
- RETROSPECTIVE.md: leave as-is (historical lessons learned)

### What "clean" means
- Remove Fibonacci as a "current or planned feature" from active docs
- Mark TOOLS-06 requirement as descoped/removed (not "complete" — the feature was intentionally removed)
- Update tool counts where they say "6 calculators" to "5 calculators"
- Remove Fibonacci from "Active" requirements lists
- Keep "Out of Scope" entry in PROJECT.md (it correctly says "not wanted")

### Claude's Discretion
- Exact wording of updated doc entries
- Whether to add a brief note explaining the removal or just silently update

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- No code changes needed — this is a docs-only phase

### Established Patterns
- Planning docs follow consistent markdown structure with frontmatter in STATE.md
- REQUIREMENTS.md uses checkbox format with requirement IDs

### Integration Points
- MILESTONES.md: references TOOLS-06 as a gap
- STATE.md: references Phase 17 resolving the orphaned code
- PROJECT.md: lists Fibonacci cleanup in "Active" requirements
- REQUIREMENTS.md: CLEAN-01 and CLEAN-02 need status updates after completion
- research/SUMMARY.md and research/FEATURES.md: reference FibCalculator cleanup tasks

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward doc cleanup with clear "active docs only" boundary.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-cleanup*
*Context gathered: 2026-03-21*
