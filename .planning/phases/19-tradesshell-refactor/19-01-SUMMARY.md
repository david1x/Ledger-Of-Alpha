---
phase: 19-tradesshell-refactor
plan: "01"
subsystem: ui
tags: [react, context, privacy, localStorage, next.js]

# Dependency graph
requires: []
provides:
  - "lib/privacy-context.tsx — PrivacyProvider + usePrivacy hook (single source of truth for privacy state)"
  - "Privacy state shared across dashboard, journal, and future consumers via React context"
affects:
  - 19-tradesshell-refactor
  - trades-page
  - any component consuming privacy_hidden

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PrivacyProvider context pattern: lazy useState initializer reads localStorage synchronously to avoid flash"
    - "StorageEvent listener in provider for cross-tab sync"
    - "Settings API fallback in provider for backward-compat with old privacy_mode setting"

key-files:
  created:
    - lib/privacy-context.tsx
  modified:
    - app/layout.tsx
    - components/dashboard/DashboardShell.tsx
    - app/journal/page.tsx

key-decisions:
  - "PrivacyProvider placed inside AccountProvider in layout.tsx — no dependency between them, consistent nesting order"
  - "Lazy useState initializer (not useEffect) reads localStorage synchronously — eliminates flash of unmasked content on page load"
  - "Settings API fallback lives in PrivacyProvider useEffect (single fetch), not in each consumer"

patterns-established:
  - "Privacy pattern: usePrivacy() hook replaces all localStorage privacy_hidden boilerplate"
  - "Context file structure: interface, createContext with default, named hook export, named provider export — mirrors account-context.tsx"

requirements-completed: [FILT-05, FILT-06]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 19 Plan 01: PrivacyContext Provider Summary

**Centralized PrivacyProvider using lazy localStorage initializer eliminates 3 copies of ~15-line privacy boilerplate from DashboardShell, journal page, and enables TradesShell integration**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T14:00:34Z
- **Completed:** 2026-03-21T14:05:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `lib/privacy-context.tsx` with PrivacyProvider + usePrivacy hook mirroring the AccountProvider pattern
- Lazy useState initializer reads localStorage synchronously, preventing flash of unmasked content on initial render
- Removed ~30 lines of duplicated privacy boilerplate across DashboardShell and journal page
- Cross-tab sync and settings API fallback centralized in provider's single useEffect

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PrivacyContext provider and wrap in layout** - `e7b4f4c` (feat)
2. **Task 2: Migrate DashboardShell and journal page to usePrivacy** - `54333c0` (feat)

## Files Created/Modified
- `lib/privacy-context.tsx` - PrivacyProvider context + usePrivacy hook, exports both
- `app/layout.tsx` - Added PrivacyProvider import and wrapper around app content
- `components/dashboard/DashboardShell.tsx` - Replaced local privacy state with usePrivacy(), removed useEffect + toggle inline logic
- `app/journal/page.tsx` - Replaced local privacy state with usePrivacy(), removed useEffect + AccountBanner toggle inline logic

## Decisions Made
- Lazy useState initializer (not useEffect) for localStorage read: synchronous read on first render avoids flash of unmasked content
- PrivacyProvider placed inside AccountProvider — both are independent, but consistent nesting depth
- Settings API fallback fetches once in PrivacyProvider, not per-consumer — removes duplicate /api/settings calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run build` returned EPERM on `.next/trace` file — caused by dev server holding file lock, not related to our changes. TypeScript (`npx tsc --noEmit`) passed clean.

## Next Phase Readiness
- `usePrivacy()` hook is ready for Plan 02 (TradesShell) to consume without any additional setup
- `app/trades/page.tsx` still has the old privacy boilerplate — Plan 02 handles that migration as part of the full trades page refactor

---
*Phase: 19-tradesshell-refactor*
*Completed: 2026-03-21*
