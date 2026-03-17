# Phase 11: IBKR Broker Sync - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect to IBKR Client Portal gateway, trigger manual trade sync with deduplication, and display live open positions with unrealized P&L. Covers IBKR-01 through IBKR-05: gateway configuration, manual sync, deduplication by execution ID, live positions panel, and sync status/error display.

</domain>

<decisions>
## Implementation Decisions

### Gateway connection setup
- URL-only configuration — user enters gateway URL (e.g. `https://localhost:5000`) in Settings > Broker tab
- No credentials stored — user authenticates directly in IBKR Client Portal web UI
- "Test Connection" button pings gateway and fetches available IBKR sub-accounts
- Connection status shown as green/red dot next to URL
- Toast notification when gateway becomes unreachable or session expires (visible app-wide)
- On-demand connectivity checks only — no background polling or heartbeats
- User-togglable SSL verification checkbox in broker settings (IBKR gateway uses self-signed certs by default)

### Trade sync behavior
- Configurable date range picker: "Last 7 days", "Last 30 days", "Custom" range options
- "Sync Now" button syncs all linked accounts at once
- Detailed results modal after sync: lists each trade as new (✅), duplicate/skipped (⏭), or error (⚠), grouped by account
- Deduplication via `ibkr_exec_id` field on trades table (ON CONFLICT DO NOTHING)
- Import trades with blank journal fields (setup, emotions, notes, strategy) — user fills in later
- Synced trades tagged with source indicator for filtering
- Subtle [IBKR] badge next to trade symbol in trades table to distinguish from manual entries

### Live positions display
- New dashboard widget card (#25) in DashboardShell — fits existing drag-reorder, hide/show, 3-size pattern
- Manual refresh button (↻) on widget header — no auto-polling (consistent with on-demand decision)
- "Last updated X ago" timestamp displayed in widget header
- Essential data per position row: symbol, quantity, unrealized P&L (colored green/red), P&L percentage, direction arrow (▲/▼)
- Total unrealized P&L at bottom of widget
- When gateway offline: show last known data with yellow "⚠ Gateway offline" banner and stale data timestamp
- When no gateway configured: empty state with "Connect to IBKR in Settings" prompt

### Account mapping
- 1:1 manual linking: user maps each IBKR account ID to an existing Ledger account via dropdown
- Account discovery: "Test Connection" fetches available IBKR sub-accounts (IDs + types) from gateway API
- Mapping UI shows discovered IBKR accounts with dropdowns to select Ledger account targets
- Support multiple IBKR sub-accounts (e.g., margin + IRA) each linked to different Ledger accounts
- Unlinking removes sync relationship only — previously synced trades stay in the Ledger account
- "[+ Link Another Account]" button for multi-account setups

### Claude's Discretion
- Exact Client Portal API endpoints and request/response handling
- Sync progress indicator during trade fetch
- IBKR field-to-trade-schema mapping details
- Widget sizing defaults (large/medium/compact)
- Date range picker UI implementation
- Error retry logic for failed syncs
- How stale position data is cached (memory vs localStorage)

</decisions>

<specifics>
## Specific Ideas

- Results modal after sync should look like the preview: each trade on a row with status icon (✅ new, ⏭ duplicate, ⚠ error) and basic trade info (symbol, side, qty, price)
- Positions widget should show a clean table-like layout with the refresh button and "last updated" timestamp in the header area
- [IBKR] badge on trades should be small and subtle — a tag/pill, not a prominent banner
- Broker settings section should show the account mapping table with discovered IBKR accounts and dropdown selectors for Ledger account targets

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/broker-parsers.ts`: Already parses IBKR CSV format — reference for field mapping (symbol, side, qty, price, date fields)
- `components/dashboard/DashboardShell.tsx`: 24-widget dashboard with @dnd-kit drag-reorder, hide/show, 3 size modes — positions widget follows this pattern
- `app/settings/page.tsx`: 12-category settings sidebar with CATEGORIES array — add "broker" category
- `components/AlertModal.tsx`: Modal pattern for displaying structured results — reference for sync results modal
- `lib/account-context.tsx`: AccountProvider with accounts list and activeAccountId — use for account mapping dropdown

### Established Patterns
- Settings persistence via `/api/settings` as JSON strings — use for `ibkr_*` settings (gateway URL, account mappings, SSL toggle)
- Toast notifications exist in the app — reuse for gateway disconnection alerts
- Dark-first Tailwind styling with `dark:` prefix
- API routes follow RESTful patterns under `app/api/`

### Integration Points
- `lib/db.ts`: Migration 020 for `ibkr_exec_id` on trades, migration 021 for IBKR settings keys
- `lib/types.ts`: Add `ibkr_exec_id` and `source` fields to Trade type
- `app/settings/page.tsx`: Add "Broker" category to CATEGORIES array with gateway config + account mapping UI
- `components/dashboard/DashboardShell.tsx`: Add IBKRPositionsWidget as widget #25
- `app/api/broker/ibkr/` (new): Proxy routes for gateway communication (sync, positions, accounts, status)
- `lib/ibkr-client.ts` (new): Client Portal REST API wrapper
- `components/TradeTable.tsx`: Add [IBKR] source badge rendering

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ibkr-broker-sync*
*Context gathered: 2026-03-18*
