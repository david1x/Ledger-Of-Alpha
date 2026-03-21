---
phase: 23-sidebar-analytics-mobile-polish
plan: "01"
subsystem: trades-ui
tags: [sidebar, analytics, setups, mistakes, performance]
dependency_graph:
  requires: []
  provides: [trades-analytics-sidebar]
  affects: [components/trades/TradesSidebar.tsx, components/trades/TradesShell.tsx]
tech_stack:
  added: []
  patterns: [recharts AreaChart, collapsible sidebar, mobile tab toggle, settings persistence]
key_files:
  created:
    - components/trades/TradesSidebar.tsx
  modified:
    - components/trades/TradesShell.tsx
decisions:
  - Three panels in sidebar: Account Performance (area chart + stats), Setups Breakdown (ranked by P&L), Mistakes Breakdown (ranked by impact)
  - Sidebar collapse persisted via trades_sidebar_open setting
  - Mobile uses Table/Analytics tab toggle instead of sidebar layout
  - Privacy mode masks all numeric values in sidebar
metrics:
  duration: 18 minutes
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 2
---

# Phase 23 Plan 01: Trades Analytics Sidebar Summary

Right-side analytics sidebar for the trades page with three panels — Account Performance, Setups Breakdown, and Mistakes Breakdown — integrated into TradesShell with collapse/expand and mobile tab toggle.

## What Was Built

**Task 1: TradesSidebar component (SIDE-01, SIDE-02, SIDE-03)**

Created `components/trades/TradesSidebar.tsx` with three analytics panels:
- **Account Performance**: Displays avg return $, avg return %, win rate %, and a cumulative P&L area chart using recharts
- **Setups Breakdown**: Ranks setups by total P&L with trade count and win rate per setup; clicking a row filters trades to that setup
- **Mistakes Breakdown**: Ranks mistakes by P&L impact with occurrence count and color dots; clicking a row filters to that mistake

All values respect privacy mode masking.

**Task 2: TradesShell integration (SIDE-04)**

Modified `components/trades/TradesShell.tsx` to integrate the sidebar:
- Desktop (>=1024px): table and sidebar shown side-by-side with collapse/expand toggle
- Mobile (<1024px): Table/Analytics tab switcher replaces the sidebar layout
- Sidebar open/closed state persisted via `/api/settings` (`trades_sidebar_open`)
- Toggle button uses PanelRightOpen/PanelRightClose icons from lucide-react

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 98cd07f | feat(23-01): create TradesSidebar component with three analytics panels |
| 2 | 4f88c83 | feat(23-01): integrate analytics sidebar into TradesShell |

## Deviations from Plan

None — plan executed as written. Task 2 commit was completed by orchestrator after agent was blocked by stuck background builds.

## Self-Check

- [x] `components/trades/TradesSidebar.tsx` created — 3 analytics panels
- [x] `components/trades/TradesShell.tsx` modified — sidebar integration with toggle
- [x] Commits 98cd07f and 4f88c83 exist
- [x] TypeScript compiles with no errors (`npx tsc --noEmit`)

## Self-Check: PASSED
