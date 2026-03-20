/** Allowed fields for trade create/update — prevents mass assignment. */
export const TRADE_FIELDS = [
  "symbol", "direction", "status",
  "entry_price", "stop_loss", "take_profit",
  "exit_price", "shares", "entry_date", "exit_date",
  "notes", "tags", "emotions", "wyckoff_checklist", "account_size", "commission", "risk_per_trade",
  "rating", "mistakes", "market_context", "lessons",
  "chart_tf", "chart_saved_at", "account_id", "strategy_id", "checklist_items", "checklist_state",
  "ai_patterns", "ai_screenshots", "ai_qa_history", "ai_primary_pattern",
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

  // Rating: 1-5 integer or null
  if (body.rating !== undefined && body.rating !== null) {
    const r = body.rating;
    if (typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > 5) {
      return "Rating must be an integer between 1 and 5.";
    }
  }

  // Market context: enum or null
  const MARKET_CONTEXTS = ["trending_up", "trending_down", "ranging", "volatile", "choppy", "news_driven"];
  if (body.market_context !== undefined && body.market_context !== null) {
    if (typeof body.market_context !== "string" || !MARKET_CONTEXTS.includes(body.market_context)) {
      return "Invalid market context value.";
    }
  }

  // Lessons: max 5000 chars
  if (body.lessons !== undefined && body.lessons !== null) {
    if (typeof body.lessons !== "string" || body.lessons.length > 5000) {
      return "Lessons must be at most 5000 characters.";
    }
  }

  // Mistakes: max 2000 chars (JSON array stored as string)
  if (body.mistakes !== undefined && body.mistakes !== null) {
    if (typeof body.mistakes !== "string" || body.mistakes.length > 2000) {
      return "Mistakes must be at most 2000 characters.";
    }
  }

  return null;
}
