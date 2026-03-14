# Ledger Of Alpha Architecture

This document describes the technical architecture and core systems of Ledger Of Alpha.

## Database & Persistence

### SQLite with better-sqlite3
Ledger Of Alpha uses **SQLite** as its primary data store, managed through the `better-sqlite3` library in Node.js.

- **WAL Mode:** The database is initialized with `PRAGMA journal_mode = WAL` (Write-Ahead Logging) for high-concurrency performance.
- **Foreign Keys:** `PRAGMA foreign_keys = ON` is enabled to ensure data integrity.
- **Schema & Migrations:** The schema is managed through a lightweight migration system in `lib/db.ts`.

### Migration System
The database initialization automatically runs migrations by checking the `_migrations` table. This allows for seamless schema updates without manual SQL scripts.

- **Storage:** The `_migrations` table tracks which scripts have been executed.
- **Execution:** Each migration is defined as a named block in the `runMigrations` function in `lib/db.ts`.

Example Migration Logic:
```typescript
if (!hasMigration(db, "015_accounts")) {
  db.exec(`CREATE TABLE accounts (...)`);
  markMigration(db, "015_accounts");
}
```

---

## State Management

### Account-Aware Context
The application is designed to support multiple trading accounts (e.g., Live, Paper, Futures). This state is managed via the **Account Context**.

- **Provider:** `AccountProvider` in `lib/account-context.tsx` wraps the root layout.
- **Hook:** `useAccounts()` allows components to access the active account ID and list of accounts.
- **Filtering:** Most API requests automatically filter data based on the `activeAccountId` (or return all if `null`).

### Multi-Account Support
- Each trade is linked to an `account_id`.
- Settings such as `starting_balance`, `risk_per_trade`, and `commission_value` are defined per-account.
- Default account management is handled via the `is_default` flag in the `accounts` table.

---

## Core Technologies
- **Next.js 14:** Framework for both frontend and API routes.
- **Tailwind CSS:** Modern utility-first styling.
- **Lucide React:** Icon set for professional visuals.
- **Recharts:** High-performance data visualization for analytics and simulations.
- **TradingView Embed:** Real-time charting with technical analysis indicators.
- **Dnd-kit:** Used for drag-and-drop strategy management.
