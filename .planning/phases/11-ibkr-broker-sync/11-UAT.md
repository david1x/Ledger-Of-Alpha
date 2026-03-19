---
status: complete
phase: 11-ibkr-broker-sync
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md
started: 2026-03-18T12:00:00Z
updated: 2026-03-19T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Broker Tab in Settings
expected: Navigate to Settings page. A "Broker" item with a Cable icon appears in the settings sidebar. Clicking it shows the IBKR broker configuration panel.
result: pass

### 2. Gateway URL and SSL Configuration
expected: In the Broker settings tab, there is a text input for "Gateway URL" and a checkbox for SSL verification (labeled something like "Require valid SSL certificate"). The SSL checkbox should be unchecked by default.
result: pass

### 3. Test Connection Button
expected: Clicking "Test Connection" saves the current gateway URL/SSL settings, then attempts to connect. Shows a green status indicator on success or red with error message on failure. If no gateway is running, it should show an error state (not crash).
result: pass

### 4. Account Discovery After Connection
expected: After a successful Test Connection, an account mapping table appears showing discovered IBKR sub-accounts. Each row has a dropdown to link the IBKR account to one of your Ledger accounts. A "Save Mappings" button is present.
result: pass

### 5. Trade Sync UI
expected: After at least one account is mapped, a Sync section appears with date range options (7d, 30d, custom). A "Sync Now" button triggers the import. While syncing, a spinner is shown.
result: pass

### 6. Sync Results Modal
expected: After sync completes, a results modal/overlay shows per-account breakdown with new/duplicate/error counts and a total summary line. The modal can be dismissed.
result: pass

### 7. Sync Status Display
expected: After a sync, the Broker tab shows the last sync timestamp and a success/error status indicator.
result: pass

### 8. IBKR Badge on Trades Table
expected: Navigate to the Trades page. Any trade imported from IBKR shows a subtle blue "[IBKR]" badge/pill next to the symbol name. This appears in both desktop table view and mobile card view.
result: pass

### 9. IBKR Positions Widget in Dashboard Edit Mode
expected: On the Dashboard, enter edit mode. The IBKR Positions widget should be available in the hidden widgets list (since it's hidden by default). Toggling it on adds it to the dashboard.
result: pass

### 10. Positions Widget Unconfigured State
expected: With the IBKR Positions widget visible on the dashboard but no gateway configured, the widget shows an "unconfigured" or setup prompt state rather than crashing or showing a spinner forever.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
