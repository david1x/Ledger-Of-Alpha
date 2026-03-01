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
