export type CommissionModel = "flat" | "per_share" | "percent";

/**
 * Calculate commission in dollars.
 * - flat: value × 2 (round trip)
 * - per_share: value × shares × 2 (round trip)
 * - percent: value/100 × (entryPrice × shares + exitPrice × shares)
 */
export function calcCommission(
  model: CommissionModel,
  value: number,
  entryPrice: number,
  exitPrice: number,
  shares: number,
): number {
  switch (model) {
    case "flat":
      return value * 2;
    case "per_share":
      return value * shares * 2;
    case "percent":
      return (value / 100) * (entryPrice * shares + exitPrice * shares);
    default:
      return 0;
  }
}
