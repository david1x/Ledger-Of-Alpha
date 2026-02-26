import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ledger-of-alpha.db");

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
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('long', 'short')),
      status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'open', 'closed')),
      entry_price REAL,
      stop_loss REAL,
      take_profit REAL,
      exit_price REAL,
      shares REAL,
      entry_date TEXT,
      exit_date TEXT,
      pnl REAL,
      notes TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS symbols (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      market_cap REAL NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('discord_webhook', ''),
      ('fmp_api_key', ''),
      ('account_size', '10000'),
      ('risk_per_trade', '1');
  `);
}
