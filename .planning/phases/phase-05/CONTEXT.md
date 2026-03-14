# Phase 05 Context: Advanced Analytics & Reports

## Requirements Summary
Analyze and export trade data.

### Analytics Goals
- Show performance by day/hour/month.
- Compare realized vs total equity.
- Breakdown strategy performance.

### Export Goals
- CSV and JSON support.
- Include all trade fields (entry, exit, reflection, etc.).

## Relevant Files
- `lib/trade-utils.ts` (compute stats)
- `lib/csv.ts` (export logic)
- `components/dashboard/DashboardShell.tsx` (widget orchestration)
- `app/api/trades/route.ts` (data source)

## Constraints & Style
- Use `recharts` for charting.
- Colors: Emerald (win), Red (loss), Amber (neutral/warning).
- Responsive: Charts must fit mobile grid.
- Keep `db.ts` queries efficient.
