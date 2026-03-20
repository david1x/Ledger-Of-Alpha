---
phase: 16-strategy-checklist-enhancements
plan: "01"
subsystem: trade-modal
tags: [checklist, strategies, trade-modal, db-migration]
dependency_graph:
  requires: []
  provides:
    - lib/strategies.ts (5 built-in default strategies, single source of truth)
    - checklist_state column on trades (migration 022)
    - per-trade checklist editing without mutating strategy templates
  affects:
    - components/TradeModal.tsx
    - components/settings/tabs/StrategiesTab.tsx
    - app/api/trades/route.ts
    - app/api/trades/[id]/route.ts
    - lib/types.ts
    - lib/db.ts
    - lib/validate-trade.ts
tech_stack:
  added: []
  patterns:
    - copy-on-select checklist snapshot (strategy items → per-trade ChecklistItem[])
    - inline edit pattern (pencil icon → input → commit on blur/Enter)
    - confirmation dialog for destructive state change (switching strategy with checked items)
    - JSON column backfill migration with per-user settings cache
key_files:
  created:
    - lib/strategies.ts
  modified:
    - lib/types.ts
    - lib/db.ts
    - lib/validate-trade.ts
    - app/api/trades/route.ts
    - app/api/trades/[id]/route.ts
    - components/TradeModal.tsx
    - components/settings/tabs/StrategiesTab.tsx
decisions:
  - "5 built-in strategies with max 5 items each: Wyckoff, SMC, Breakout, Reversal, 150 SMA"
  - "checklist_state is a JSON column (ChecklistItem[]) on trades; checklist_items kept for backward compat"
  - "Confirmation dialog is inline in TradeModal (not AlertModal which is for price alerts)"
  - "No Strategy option clears checklist state entirely"
  - "Migration 022 backfills from checklist_items + strategy template with per-user strategies cache"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-03-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
  files_created: 1
---

# Phase 16 Plan 01: Strategy Checklist Core Data Model Summary

**One-liner:** Per-trade checklist editing via ChecklistItem[] state with copy-on-select from strategy templates, stored in new checklist_state JSON column (migration 022), with lib/strategies.ts as single source of truth for 5 built-in strategies.

## What Was Built

### lib/strategies.ts (new)
Single source of truth for 5 built-in default strategies, each with max 5 checklist items:
- **Wyckoff** — supply/demand objective, volume confirmation, spring/upthrust, trend structure, RR
- **SMC** — break of structure, order block/FVG, liquidity sweep, HTF bias, RR
- **Breakout** — key level, volume surge, retest holds, clear overhead, RR
- **Reversal** — overextended move, reversal candle, divergence, volume climax, RR
- **150 SMA** — price reclaiming, slope, base visible, tight price action, volume contraction

### lib/types.ts
- Added `ChecklistItem` interface: `{ text: string; checked: boolean }`
- Added `checklist_state?: string | null` to `Trade` (JSON string of `ChecklistItem[]`)

### lib/db.ts — Migration 022
- Adds `checklist_state TEXT` column to trades table
- Backfills existing trades: parses `checklist_items` (comma-sep checked text) + strategy template to build `ChecklistItem[]`
- Uses per-user strategies cache to avoid repeated DB lookups

### API routes
- POST `/api/trades`: now inserts `checklist_state`
- PUT `/api/trades/[id]`: now updates `checklist_state`
- `lib/validate-trade.ts`: `checklist_state` added to `TRADE_FIELDS` allowlist

### components/TradeModal.tsx (overhauled StrategyChecklist)
- Removed local `DEFAULT_STRATEGIES` constant; imports from `@/lib/strategies`
- Local `checklistState: ChecklistItem[]` state (not stored in `form`)
- Initializes from `trade.checklist_state` JSON, or backfills from `trade.checklist_items` + template
- Serializes to `checklist_state` JSON and `checklist_items` (backward compat) on save
- `StrategyChecklist` now has typed props (no `any`)
- **"No Strategy"** option in dropdown — clears checklist state
- **Copy-on-select**: selecting strategy snapshots items as unchecked `ChecklistItem[]`
- **Confirmation dialog**: inline amber dialog when switching strategy with checked items
- **Per-item controls**: checkbox toggle, inline edit (pencil → input → blur/Enter commits), remove (trash)
- **Ad-hoc input**: always-visible text input + Add button below checklist
- **Score badge**: `X / Y` computed from `checklistState`

### components/settings/tabs/StrategiesTab.tsx
- Imports `DEFAULT_STRATEGIES` from `@/lib/strategies`
- Seeds with 5 defaults on fresh install (empty strategies setting)

## Verification

- TypeScript compiles clean (`tsc --noEmit` — no errors)
- Build blocked by running dev server (`.next/trace` lock), TypeScript check substituted per CLAUDE.md

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing feature] Added checklist_state to validate-trade.ts TRADE_FIELDS**
- **Found during:** Task 1
- **Issue:** `pickTradeFields` in `validate-trade.ts` would strip `checklist_state` from PUT requests since it wasn't in the allowlist
- **Fix:** Added `checklist_state` to `TRADE_FIELDS` array
- **Files modified:** `lib/validate-trade.ts`
- **Commit:** 5e26b8c

**2. [Rule 1 - Design] Inline confirmation dialog instead of AlertModal**
- **Found during:** Task 2
- **Issue:** `AlertModal` component is a price alert creation modal, not a general-purpose confirmation dialog
- **Fix:** Built inline amber-styled confirmation section within `StrategyChecklist` component
- **Commit:** 5e5e861

## Self-Check: PASSED

| Item | Status |
|------|--------|
| lib/strategies.ts exists | FOUND |
| lib/types.ts has ChecklistItem | FOUND |
| lib/db.ts has 022_checklist_state migration | FOUND |
| SUMMARY.md exists | FOUND |
| Commit 5e26b8c | FOUND |
| Commit 5e5e861 | FOUND |
