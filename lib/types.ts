// ── Auth ──────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified: number;          // 0 | 1
  two_factor_secret: string | null;
  two_factor_enabled: number;      // 0 | 1
  two_factor_backup_codes: string | null; // JSON array of hashed codes
  created_at: string;
}

/** Shape embedded in the session JWT and returned from getSessionUser() */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorDone: boolean;
}

// ── Trade ─────────────────────────────────────────────────────────────────
export type TradeDirection = "long" | "short";
export type TradeStatus = "planned" | "open" | "closed";

export interface Trade {
  id: number;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  shares: number | null;
  entry_date: string | null;
  exit_date: string | null;
  pnl: number | null;
  notes: string | null;
  tags: string | null;
  created_at: string;
}

export interface Settings {
  discord_webhook: string;
  fmp_api_key: string;
  account_size: string;
  risk_per_trade: string;
}

export interface StockSymbol {
  symbol: string;
  name: string;
  market_cap: number;
}

export interface RiskCalcResult {
  riskAmount: number;
  rewardAmount: number;
  rrRatio: number;
  stopDistance: number;
  targetDistance: number;
  breakEven: number;
}

export interface PositionSizeResult {
  shares: number;
  positionValue: number;
  maxLoss: number;
  riskPercent: number;
}
