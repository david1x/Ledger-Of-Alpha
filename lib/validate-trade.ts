/** Allowed fields for trade create/update — prevents mass assignment. */
export const TRADE_FIELDS = [
  "symbol", "direction", "status",
  "entry_price", "stop_loss", "take_profit",
  "exit_price", "shares", "entry_date", "exit_date",
  "notes", "tags", "account_size", "commission", "risk_per_trade",
] as const;

/** Pick only allowed trade fields from an object. */
export function pickTradeFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of TRADE_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}

function isFinitePositiveOrNull(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Validates trade fields. Returns an error string if invalid, or null if valid.
 */
export function validateTradeFields(body: Record<string, unknown>): string | null {
  const { symbol, direction, status, notes, tags } = body;

  if (symbol !== undefined && symbol !== null) {
    if (typeof symbol !== "string" || symbol.length === 0 || symbol.length > 20) {
      return "Symbol must be 1-20 characters.";
    }
  }

  if (direction !== undefined && direction !== "long" && direction !== "short") {
    return "Direction must be 'long' or 'short'.";
  }

  if (status !== undefined && !["planned", "open", "closed"].includes(status as string)) {
    return "Status must be 'planned', 'open', or 'closed'.";
  }

  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 5000)) {
    return "Notes must be at most 5000 characters.";
  }

  if (tags !== undefined && tags !== null && (typeof tags !== "string" || tags.length > 500)) {
    return "Tags must be at most 500 characters.";
  }

  for (const field of ["entry_price", "stop_loss", "take_profit", "exit_price", "shares", "account_size", "commission", "risk_per_trade"] as const) {
    if (!isFinitePositiveOrNull(body[field])) {
      return `${field} must be a positive number or null.`;
    }
  }

  return null;
}
