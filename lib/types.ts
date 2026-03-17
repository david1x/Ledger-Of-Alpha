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
  is_admin: number;                // 0 | 1
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
  isAdmin: boolean;
}

// ── Account ──────────────────────────────────────────────────────────────
export interface Account {
  id: string;
  user_id: string;
  name: string;
  starting_balance: number;
  risk_per_trade: number;
  commission_value: number;
  is_default: number; // 0 | 1
  created_at: string;
}

// ── Trade ─────────────────────────────────────────────────────────────────
export type TradeDirection = "long" | "short";
export type TradeStatus = "planned" | "open" | "closed";

export type MarketContext = "trending_up" | "trending_down" | "ranging" | "volatile" | "choppy" | "news_driven";

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
  emotions: string | null;
  wyckoff_checklist: string | null;
  account_size?: number | null;
  commission?: number | null;
  risk_per_trade?: number | null;
  rating?: number | null;
  mistakes?: string | null;
  market_context?: string | null;
  lessons?: string | null;
  chart_tf?: string | null;
  chart_saved_at?: string | null;
  account_id?: string | null;
  strategy_id?: string | null;
  checklist_items?: string | null;
  ai_patterns?: string | null;        // JSON: AnalysisResult
  ai_screenshots?: string | null;     // JSON: string[] filenames
  ai_qa_history?: string | null;      // JSON: QAEntry[]
  ai_primary_pattern?: string | null; // denormalized pattern name
  ibkr_exec_id?: string | null;       // IBKR execution ID for deduplication
  source?: string | null;             // 'manual' | 'ibkr'
  created_at: string;
  user_id: string | null;
}

export interface TradeTemplate {
  id: string;
  name: string;
  fields: Partial<Trade>;
}

export interface TradeStrategy {
  id: string;
  name: string;
  checklist: string[];
}

export interface Settings {
  discord_webhook: string;
  fmp_api_key: string;
  account_size: string;
  risk_per_trade: string;
  commission_per_trade: string;
  strategies?: string; // JSON string of TradeStrategy[]
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

export type QuoteMap = Record<string, number>;

// ── Alerts ───────────────────────────────────────────────────────────────
export type AlertCondition = "above" | "below" | "crosses" | "percent_up" | "percent_down" | "percent_move";

export interface Alert {
  id: number;
  user_id: string;
  symbol: string;
  condition: AlertCondition;
  target_price: number;
  percent_value: number | null;  // for percent_up / percent_down alerts
  anchor_price: number | null;   // price when percent alert was created
  repeating: number;       // 0 | 1
  active: number;          // 0 | 1
  triggered_at: string | null;
  created_at: string;
  note: string | null;
  notify_email: number;    // 0 | 1
  notify_discord: number;  // 0 | 1
}
