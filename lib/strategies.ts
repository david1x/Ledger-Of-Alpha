import { TradeStrategy } from "@/lib/types";

/**
 * Default built-in trading strategies.
 * This is the single source of truth — imported by both TradeModal and StrategiesTab.
 * Each strategy has at most 5 checklist items.
 */
export const DEFAULT_STRATEGIES: TradeStrategy[] = [
  {
    id: "wyckoff",
    name: "Wyckoff",
    checklist: [
      "Supply/Demand objective accomplished",
      "Volume confirms price action",
      "Spring or Upthrust confirmed",
      "Trend structure intact (higher lows / lower highs)",
      "RR Potential 3:1 or better",
    ],
  },
  {
    id: "smc",
    name: "SMC",
    checklist: [
      "Break of structure (BOS) identified",
      "Order block or fair value gap present",
      "Liquidity sweep confirmed",
      "HTF bias aligns with entry",
      "RR Potential 3:1 or better",
    ],
  },
  {
    id: "breakout",
    name: "Breakout",
    checklist: [
      "Key resistance/support level identified",
      "Volume surge on breakout candle",
      "Retest of broken level holds",
      "No major resistance overhead",
      "RR Potential 2:1 or better",
    ],
  },
  {
    id: "reversal",
    name: "Reversal",
    checklist: [
      "Overextended move into key level",
      "Reversal candlestick pattern present",
      "Divergence on momentum indicator",
      "Volume climax at turning point",
      "RR Potential 3:1 or better",
    ],
  },
  {
    id: "sma150",
    name: "150 SMA",
    checklist: [
      "Price reclaiming 150 SMA from below",
      "150 SMA sloping upward",
      "Prior base or consolidation visible",
      "Tight price action (low volatility base)",
      "Volume contraction before entry",
    ],
  },
];
