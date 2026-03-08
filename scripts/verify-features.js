const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(process.cwd(), "data", "ledger-of-alpha.db");

function log(msg, success = true) {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${msg}`);
}

async function verify() {
  console.log("🔍 Starting Verification Script...\n");

  // 1. Database Schema Verification
  if (!fs.existsSync(DB_PATH)) {
    log("Database file not found. Ensure the app has been run once.", false);
  } else {
    const db = new Database(DB_PATH);
    
    // Check Alerts Table
    const alertsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts'").get();
    if (alertsTable) {
      log("Database: 'alerts' table exists.");
    } else {
      log("Database: 'alerts' table is missing.", false);
    }

    // Check Settings Table for Strategies
    const settingsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
    if (settingsTable) {
      log("Database: 'settings' table exists.");
      // Note: We can't easily check for specific user settings without a valid user_id, 
      // but we verified the code handles defaults.
    }

    // Check Trades table for checklist column
    const tradeCols = db.pragma("table_info(trades)");
    const hasChecklist = tradeCols.some(c => c.name === "wyckoff_checklist");
    if (hasChecklist) {
      log("Database: 'trades' table has 'wyckoff_checklist' column.");
    } else {
      log("Database: 'trades' table is missing 'wyckoff_checklist' column.", false);
    }
    db.close();
  }

  // 2. Component Code Verification (Static Analysis)
  console.log("\n📄 Verifying Component Code...");

  // Verify AlertModal Redesign
  const alertModalPath = path.join(process.cwd(), "components", "AlertModal.tsx");
  const alertModalContent = fs.readFileSync(alertModalPath, "utf8");
  if (alertModalContent.includes("handleMouseDown") && alertModalContent.includes("onMouseDown={handleMouseDown}")) {
    log("AlertModal: Background-click handling (mouseDown/Up) is implemented.");
  } else {
    log("AlertModal: Missing background-click handling.", false);
  }
  if (alertModalContent.includes("Escape") && alertModalContent.includes("keydown")) {
    log("AlertModal: Escape key listener is implemented.");
  } else {
    log("AlertModal: Missing Escape key listener.", false);
  }

  // Verify SymbolSearch Contrast
  const symbolSearchPath = path.join(process.cwd(), "components", "SymbolSearch.tsx");
  const symbolSearchContent = fs.readFileSync(symbolSearchPath, "utf8");
  if (symbolSearchContent.includes("dark:text-emerald-400 text-emerald-600") && 
      symbolSearchContent.includes("dark:text-slate-200 text-slate-700")) {
    log("SymbolSearch: High-contrast colors are implemented.");
  } else {
    log("SymbolSearch: Missing high-contrast colors.", false);
  }

  // Verify TradeModal Dynamic Strategies
  const tradeModalPath = path.join(process.cwd(), "components", "TradeModal.tsx");
  const tradeModalContent = fs.readFileSync(tradeModalPath, "utf8");
  if (tradeModalContent.includes("StrategyChecklist") && tradeModalContent.includes("strategies={strategies}")) {
    log("TradeModal: Dynamic strategies are passed to StrategyChecklist.");
  } else {
    log("TradeModal: Dynamic strategies are NOT being passed.", false);
  }
  if (tradeModalContent.includes("<select") && tradeModalContent.includes("currentStratId")) {
    log("TradeModal: Strategy selection dropdown exists in checklist.");
  } else {
    log("TradeModal: Strategy selection dropdown is missing.", false);
  }
  if (tradeModalContent.includes("JSON.parse(s.strategies)")) {
    log("TradeModal: Strategies are being fetched and parsed from settings.");
  } else {
    log("TradeModal: Strategy fetching logic is missing.", false);
  }

  // Verify Settings Page Strategies UI
  const settingsPath = path.join(process.cwd(), "app", "settings", "page.tsx");
  const settingsContent = fs.readFileSync(settingsPath, "utf8");
  if (settingsContent.includes("activeCategory === \"strategies\"") && settingsContent.includes("Trade Strategies & Checklists")) {
    log("Settings: Strategies management UI is implemented.");
  } else {
    log("Settings: Strategies management UI is missing.", false);
  }

  console.log("\n✨ Verification Complete!");
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
