import { TRADE_FIELDS } from "./validate-trade";

/** Fields included in export (TRADE_FIELDS + read-only extras) */
const EXPORT_FIELDS = [...TRADE_FIELDS, "pnl", "created_at"] as const;

/** Convert an array of trade objects to a CSV string. */
export function tradesToCsv(trades: Record<string, unknown>[]): string {
  const header = EXPORT_FIELDS.join(",");
  const rows = trades.map(trade =>
    EXPORT_FIELDS.map(field => {
      const val = trade[field];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Quote if contains comma, newline, or double-quote
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

/** Parse a CSV string into an array of trade-like objects. */
export function csvToTrades(csv: string): Record<string, unknown>[] {
  const lines = parseCsvLines(csv);
  if (lines.length < 2) return [];

  const headers = lines[0];
  return lines.slice(1).map(fields => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      const val = fields[i]?.trim() ?? "";
      if (val === "") {
        obj[header] = null;
      } else {
        // Try to parse numeric fields
        const num = Number(val);
        obj[header] = Number.isFinite(num) && !isDateField(header) ? num : val;
      }
    });
    return obj;
  });
}

function isDateField(field: string): boolean {
  return field === "entry_date" || field === "exit_date" || field === "created_at";
}

// ── IBKR Transaction History CSV parser ───────────────────────────────────

interface IbkrTransaction {
  date: string;
  symbol: string;
  description: string;
  type: "Buy" | "Sell";
  quantity: number;
  price: number;
  commission: number;
  grossAmount: number;
  netAmount: number;
}

/**
 * Detect whether a CSV is an IBKR Transaction History export.
 * Looks for the "Transaction History,Header" marker line.
 */
export function isIbkrCsv(csv: string): boolean {
  return csv.includes("Transaction History,Header,");
}

/**
 * Parse IBKR Transaction History CSV into trade objects compatible with the import API.
 *
 * Strategy: group transactions by symbol+date, pair Buy/Sell into round-trip trades.
 * - A Buy followed by Sell(s) = long trade
 * - A Sell followed by Buy(s) = short trade (not typical in this format)
 * - Unpaired executions imported as open trades
 */
export function ibkrCsvToTrades(csv: string): Record<string, unknown>[] {
  const lines = parseCsvLines(csv);

  // Find the transaction data rows
  const transactions: IbkrTransaction[] = [];
  for (const fields of lines) {
    if (fields[0]?.trim() !== "Transaction History" || fields[1]?.trim() !== "Data") continue;

    const type = fields[5]?.trim();
    if (type !== "Buy" && type !== "Sell") continue;

    const symbol = fields[6]?.trim();
    if (!symbol || symbol === "-") continue;

    const quantity = Math.abs(parseFloat(fields[7]?.trim() ?? "0"));
    const price = parseFloat(fields[8]?.trim() ?? "0");
    const commStr = fields[11]?.trim() ?? "0";
    const commission = commStr === "-" ? 0 : Math.abs(parseFloat(commStr));
    const grossStr = fields[10]?.trim() ?? "0";
    const grossAmount = parseFloat(grossStr) || 0;
    const netStr = fields[12]?.trim() ?? "0";
    const netAmount = parseFloat(netStr) || 0;
    const date = fields[2]?.trim() ?? "";

    if (quantity === 0 || price === 0) continue;

    transactions.push({
      date,
      symbol,
      description: fields[4]?.trim() ?? "",
      type: type as "Buy" | "Sell",
      quantity,
      price,
      commission,
      grossAmount,
      netAmount,
    });
  }

  // Group by symbol + date
  const groups = new Map<string, IbkrTransaction[]>();
  for (const tx of transactions) {
    const key = `${tx.symbol}|${tx.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const trades: Record<string, unknown>[] = [];

  for (const [, txs] of groups) {
    const buys = txs.filter(t => t.type === "Buy");
    const sells = txs.filter(t => t.type === "Sell");

    if (buys.length > 0 && sells.length > 0) {
      // Round-trip trade: compute weighted avg entry/exit
      const totalBuyShares = buys.reduce((s, b) => s + b.quantity, 0);
      const avgBuyPrice = buys.reduce((s, b) => s + b.price * b.quantity, 0) / totalBuyShares;
      const totalSellShares = sells.reduce((s, b) => s + b.quantity, 0);
      const avgSellPrice = sells.reduce((s, b) => s + b.price * b.quantity, 0) / totalSellShares;
      const totalCommission = txs.reduce((s, t) => s + t.commission, 0);
      const shares = Math.min(totalBuyShares, totalSellShares);

      trades.push({
        symbol: txs[0].symbol,
        direction: "long",
        status: "closed",
        entry_price: Math.round(avgBuyPrice * 10000) / 10000,
        exit_price: Math.round(avgSellPrice * 10000) / 10000,
        shares,
        entry_date: txs[0].date,
        exit_date: txs[0].date,
        commission: Math.round(totalCommission * 100) / 100,
        source: "ibkr",
      });
    } else if (buys.length > 0) {
      // Buy only — open long position
      const totalShares = buys.reduce((s, b) => s + b.quantity, 0);
      const avgPrice = buys.reduce((s, b) => s + b.price * b.quantity, 0) / totalShares;
      const totalCommission = buys.reduce((s, t) => s + t.commission, 0);

      trades.push({
        symbol: buys[0].symbol,
        direction: "long",
        status: "open",
        entry_price: Math.round(avgPrice * 10000) / 10000,
        shares: totalShares,
        entry_date: buys[0].date,
        commission: Math.round(totalCommission * 100) / 100,
        source: "ibkr",
      });
    } else if (sells.length > 0) {
      // Sell only — open short position
      const totalShares = sells.reduce((s, b) => s + b.quantity, 0);
      const avgPrice = sells.reduce((s, b) => s + b.price * b.quantity, 0) / totalShares;
      const totalCommission = sells.reduce((s, t) => s + t.commission, 0);

      trades.push({
        symbol: sells[0].symbol,
        direction: "short",
        status: "open",
        entry_price: Math.round(avgPrice * 10000) / 10000,
        shares: totalShares,
        entry_date: sells[0].date,
        commission: Math.round(totalCommission * 100) / 100,
        source: "ibkr",
      });
    }
  }

  return trades;
}

/** Parse CSV respecting quoted fields with commas and escaped quotes. */
function parseCsvLines(csv: string): string[][] {
  const results: string[][] = [];
  let current = "";
  let fields: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else if (ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) {
        if (ch === "\r") i++; // skip \n in \r\n
        fields.push(current);
        if (fields.some(f => f.trim() !== "")) results.push(fields);
        fields = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  // Last line (no trailing newline)
  fields.push(current);
  if (fields.some(f => f.trim() !== "")) results.push(fields);

  return results;
}
