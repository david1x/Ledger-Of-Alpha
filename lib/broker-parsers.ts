import { Trade } from "./types";

/** Unified interface for broker trade data */
export interface RawBrokerTrade {
  symbol: string;
  direction: "long" | "short";
  entry_date: string;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  shares: number;
  commission: number;
  notes?: string;
}

/** Detects broker based on CSV headers or first few lines */
export function detectBroker(csvContent: string): "tos" | "ibkr" | "robinhood" | "standard" | null {
  const lines = csvContent.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const header = lines[0].toLowerCase();

  // ThinkOrSwim: often starts with "Account Statement" or contains "Execution Time"
  if (header.includes("execution time") || header.includes("spread") || csvContent.includes("Account Statement")) {
    return "tos";
  }

  // IBKR: often includes "Statement" or "Trades" or "Client Account ID"
  if (header.includes("client account id") || header.includes("asset category") || header.includes("currency primary")) {
    return "ibkr";
  }

  // Robinhood: simple headers
  if (header.includes("order id") && header.includes("process date") && header.includes("instrument")) {
    return "robinhood";
  }

  // Default / Standard Ledger of Alpha format
  if (header.includes("symbol") && header.includes("entry_price") && header.includes("status")) {
    return "standard";
  }

  return null;
}

/** Parser for ThinkOrSwim (TOS) */
export function parseTOS(csv: string): RawBrokerTrade[] {
  // Simplistic implementation for POC - in real world requires robust CSV parser
  const trades: RawBrokerTrade[] = [];
  const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Skip header if present
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;

    // Example mapping (dummy values for logic structure)
    // TOS CSVs are complex (nested tables), usually one should extract the "Trades" section first
    trades.push({
      symbol: cols[2] || "UNKNOWN",
      direction: cols[3]?.toLowerCase().includes("sell") ? "short" : "long",
      entry_date: cols[0] || new Date().toISOString(),
      entry_price: parseFloat(cols[4]) || 0,
      exit_date: null,
      exit_price: null,
      shares: Math.abs(parseFloat(cols[5])) || 0,
      commission: 0,
    });
  }
  return trades;
}

/** Parser for Interactive Brokers (IBKR) */
export function parseIBKR(csv: string): RawBrokerTrade[] {
  const trades: RawBrokerTrade[] = [];
  const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 10) continue;

    trades.push({
      symbol: cols[5] || "UNKNOWN",
      direction: parseFloat(cols[7]) > 0 ? "long" : "short",
      entry_date: cols[6] || new Date().toISOString(),
      entry_price: parseFloat(cols[8]) || 0,
      exit_date: null,
      exit_price: null,
      shares: Math.abs(parseFloat(cols[7])) || 0,
      commission: Math.abs(parseFloat(cols[11])) || 0,
    });
  }
  return trades;
}

/** Parser for Robinhood */
export function parseRobinhood(csv: string): RawBrokerTrade[] {
  const trades: RawBrokerTrade[] = [];
  const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 8) continue;

    trades.push({
      symbol: cols[2] || "UNKNOWN",
      direction: cols[3]?.toLowerCase() === "buy" ? "long" : "short",
      entry_date: cols[1] || new Date().toISOString(),
      entry_price: parseFloat(cols[5]) || 0,
      exit_date: null,
      exit_price: null,
      shares: parseFloat(cols[4]) || 0,
      commission: 0,
    });
  }
  return trades;
}
