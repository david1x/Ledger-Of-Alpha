import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "ledger-of-alpha.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

// ── Initial schema (unchanged tables from v1) ─────────────────────────────
function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      ran_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol      TEXT NOT NULL,
      direction   TEXT NOT NULL CHECK(direction IN ('long', 'short')),
      status      TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'open', 'closed')),
      entry_price REAL,
      stop_loss   REAL,
      take_profit REAL,
      exit_price  REAL,
      shares      REAL,
      entry_date  TEXT,
      exit_date   TEXT,
      pnl         REAL,
      notes       TEXT,
      tags        TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS symbols (
      symbol     TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      market_cap REAL NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('discord_webhook', ''),
      ('fmp_api_key', ''),
      ('account_size', '10000'),
      ('risk_per_trade', '1'),
      ('commission_per_trade', '0');
  `);
}

// ── Migration helpers ──────────────────────────────────────────────────────
function hasMigration(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(name);
  return !!row;
}

function markMigration(db: Database.Database, name: string) {
  db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run(name);
}

function runMigrations(db: Database.Database) {
  // ── 001: auth tables ──────────────────────────────────────────────────
  if (!hasMigration(db, "001_auth_tables")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id                     TEXT PRIMARY KEY,
        email                  TEXT UNIQUE NOT NULL,
        name                   TEXT NOT NULL,
        password_hash          TEXT NOT NULL,
        email_verified         INTEGER NOT NULL DEFAULT 0,
        two_factor_secret      TEXT,
        two_factor_enabled     INTEGER NOT NULL DEFAULT 0,
        two_factor_backup_codes TEXT,
        created_at             TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email      TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        type       TEXT NOT NULL CHECK(type IN ('verify_email','reset_password','otp_2fa')),
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_tokens_type ON email_tokens(type, used);
    `);
    markMigration(db, "001_auth_tables");
  }

  // ── 002: add user_id to trades ────────────────────────────────────────
  if (!hasMigration(db, "002_trades_user_id")) {
    // SQLite ALTER TABLE cannot add a FK constraint — enforced at app layer
    const cols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
    if (!cols.includes("user_id")) {
      db.exec(`ALTER TABLE trades ADD COLUMN user_id TEXT;`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);`);
    markMigration(db, "002_trades_user_id");
  }

  // ── 003: settings per-user ────────────────────────────────────────────
  // IMPORTANT: must run before 005 which inserts into settings(user_id, key, value)
  if (!hasMigration(db, "003_settings_per_user")) {
    // Check if settings still has the old single-PK structure
    const pkCols = (db.pragma("table_info(settings)") as { name: string; pk: number }[])
      .filter(c => c.pk > 0)
      .map(c => c.name);

    if (!pkCols.includes("user_id")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings_new (
          user_id TEXT NOT NULL,
          key     TEXT NOT NULL,
          value   TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (user_id, key)
        );

        INSERT OR IGNORE INTO settings_new (user_id, key, value)
          SELECT '_system', key, value FROM settings;

        DROP TABLE settings;
        ALTER TABLE settings_new RENAME TO settings;
      `);
    }
    markMigration(db, "003_settings_per_user");
  }

  // ── 004: admin flag on users ──────────────────────────────────────────
  if (!hasMigration(db, "004_admin_flag")) {
    const cols = (db.pragma("table_info(users)") as { name: string }[]).map(c => c.name);
    if (!cols.includes("is_admin")) {
      db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;`);
    }
    markMigration(db, "004_admin_flag");
  }

  // ── 005: smtp + app_url keys in _system settings ──────────────────────
  if (!hasMigration(db, "005_system_smtp_settings")) {
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES ('_system', ?, ?)"
    );
    for (const [key, value] of [
      ["smtp_host", ""],
      ["smtp_port", "587"],
      ["smtp_secure", "false"],
      ["smtp_user", ""],
      ["smtp_pass", ""],
      ["smtp_from", ""],
      ["app_url", ""],
    ]) {
      insertSetting.run(key, value);
    }
    markMigration(db, "005_system_smtp_settings");
  }

  // ── 006: per-trade account_size & commission ─────────────────────────
  if (!hasMigration(db, "006_trade_commission")) {
    const cols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
    if (!cols.includes("account_size")) {
      db.exec(`ALTER TABLE trades ADD COLUMN account_size REAL;`);
    }
    if (!cols.includes("commission")) {
      db.exec(`ALTER TABLE trades ADD COLUMN commission REAL;`);
    }
    if (!cols.includes("risk_per_trade")) {
      db.exec(`ALTER TABLE trades ADD COLUMN risk_per_trade REAL;`);
    }
    markMigration(db, "006_trade_commission");
  }

  // ── 006b: backfill risk_per_trade if 006 ran before it was added ────────
  {
    const cols = (db.pragma("table_info(trades)") as { name: string }[]).map(c => c.name);
    if (!cols.includes("risk_per_trade")) {
      db.exec(`ALTER TABLE trades ADD COLUMN risk_per_trade REAL;`);
    }
  }
}
