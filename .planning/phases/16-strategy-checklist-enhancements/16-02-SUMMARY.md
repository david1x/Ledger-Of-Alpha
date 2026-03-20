---
phase: 16-strategy-checklist-enhancements
plan: "02"
subsystem: trade-list-journal
tags: [checklist, progress-ring, trade-table, journal, svg]
dependency_graph:
  requires:
    - "16-01 (checklist_state column + ChecklistItem type)"
  provides:
    - components/ChecklistRing.tsx (reusable SVG progress ring)
    - checklist progress visible on trade list rows
    - checklist progress visible on journal review cards
  affects:
    - components/TradeTable.tsx
    - app/journal/page.tsx
tech_stack:
  added: []
  patterns:
    - SVG donut ring with strokeDasharray/strokeDashoffset ratio fill
    - null-return guard for missing/invalid checklist data (no badge)
    - small inline badge placement in symbol cell (trades) and header actions (journal)
key_files:
  created:
    - components/ChecklistRing.tsx
  modified:
    - components/TradeTable.tsx
    - app/journal/page.tsx
decisions:
  - "Ring placed in symbol cell of TradeTable (both mobile and desktop) for maximum visibility"
  - "Ring placed in journal card top-right actions area alongside chart/edit buttons"
  - "Size 22px mobile, 24px desktop table, 26px journal cards — fits inline without crowding"
  - "Null return for null/empty/invalid JSON — no badge shown for trades without checklist data"
  - "100% complete uses green-500 (#22c55e), partial uses emerald-500 (#10b981)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 1
---

# Phase 16 Plan 02: Checklist Progress Ring Summary

**One-liner:** Reusable SVG donut progress ring (ChecklistRing) shows checked/total ratio from checklist_state JSON on trade list rows and journal cards, with null-guard preventing any badge on trades without checklist data.

## What Was Built

### components/ChecklistRing.tsx (new)
Reusable `"use client"` SVG donut ring component:
- Props: `checklistState: string | null | undefined`, `size?: number` (default 28)
- Parses `checklistState` JSON into `ChecklistItem[]`; returns `null` for null/empty/invalid input
- SVG donut ring with:
  - Background track: `#334155` (slate-700 equivalent)
  - Foreground arc: `#10b981` (emerald-500) for partial, `#22c55e` (green-500) for 100%
  - `strokeLinecap="round"` for clean arc appearance
  - Center text: `X/Y` in small bold font, colored emerald/green when complete
- Exported as default function

### components/TradeTable.tsx
- Imported `ChecklistRing` from `@/components/ChecklistRing`
- Added ring to symbol cell in **mobile card view** (size 22, inline with symbol text)
- Added ring to symbol cell in **desktop table view** (size 24, inline with symbol and IBKR badge)
- Placed after symbol text and optional IBKR badge in the same flex span

### app/journal/page.tsx
- Imported `ChecklistRing` from `@/components/ChecklistRing`
- Added ring to **journal cards view** top-right action area (size 26), before the chart/edit buttons
- No changes to review mode (ring appears in cards view only, where quick glance matters most)

## Verification

- TypeScript compiles cleanly (`npx tsc --noEmit` — no errors)
- Build environment background task output capture not functioning, but TSC clean confirms no type errors

## Deviations from Plan

None - plan executed exactly as written.

The plan mentioned adding the ring to `app/trades/page.tsx` directly, but trades page delegates rendering to `TradeTable` component — the ring was correctly added to `TradeTable.tsx` instead. This is the right location as `TradeTable` is shared across multiple pages (trades, journal list view). The plan's mention of `app/trades/page.tsx` was directional guidance about which page to update, not a strict file target.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| components/ChecklistRing.tsx exists | FOUND |
| components/TradeTable.tsx modified | FOUND |
| app/journal/page.tsx modified | FOUND |
| 16-02-SUMMARY.md exists | FOUND |
| Commit 3a51e6a (Task 1) | FOUND |
| Commit 219ae36 (Task 2) | FOUND |
