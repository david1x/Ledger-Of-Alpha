import type { Trade } from "./types";

/** Compute achieved R:R — (exit - entry) / (entry - stop), adjusted for direction. */
export function calcRRAchieved(t: Trade): number | null {
  if (t.entry_price == null || t.exit_price == null || t.stop_loss == null) return null;
  const risk = Math.abs(t.entry_price - t.stop_loss);
  if (risk === 0) return null;
  const reward = t.direction === "long"
    ? t.exit_price - t.entry_price
    : t.entry_price - t.exit_price;
  return reward / risk;
}

/** Compute % return relative to account size. */
export function calcPercentReturn(t: Trade, globalAccountSize: number): number | null {
  if (t.pnl == null) return null;
  const acct = t.account_size ?? globalAccountSize;
  if (!acct || acct === 0) return null;
  return (t.pnl / acct) * 100;
}

/** Format hold duration between two date strings. Uses current time for open trades. */
export function formatHoldDuration(entryDate: string | null, exitDate: string | null): string | null {
  if (!entryDate) return null;
  const start = new Date(entryDate);
  const end = exitDate ? new Date(exitDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;

  const totalHours = diffMs / (1000 * 60 * 60);
  if (totalHours < 1) return "< 1h";

  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);

  if (days === 0) {
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}
