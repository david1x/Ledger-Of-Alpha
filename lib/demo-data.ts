import type { Trade } from "./types";

/** Realistic fake trades returned to guests instead of real DB data. */
export const DEMO_TRADES: Trade[] = [
  // ── Closed trades (diverse strategies, mix of wins/losses) ────────────────

  // Big winner — momentum breakout
  { id: 1,  symbol: "NVDA",  direction: "long",  status: "closed", entry_price: 118.50, stop_loss: 112.00, take_profit: 140.00, exit_price: 138.20, shares: 80, entry_date: "2025-09-08", exit_date: "2025-09-15", pnl: 1576.00, notes: "Broke out of 6-week base on massive AI chip demand news. Volume confirmed. Held full size through the move, exited just under target at prior resistance.", tags: "momentum,breakout,ai", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-09-08T09:35:00" },

  // Clean loss — respected stop
  { id: 2,  symbol: "AAPL",  direction: "long",  status: "closed", entry_price: 242.80, stop_loss: 236.00, take_profit: 260.00, exit_price: 235.60, shares: 70, entry_date: "2025-09-22", exit_date: "2025-09-24", pnl: -504.00, notes: "Failed to hold 50 SMA after iPhone event. Stopped out next morning at gap down. Clean loss, no regrets on the setup.", tags: "earnings,failed-breakout", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-09-22T10:02:00" },

  // Short trade winner
  { id: 3,  symbol: "TSLA",  direction: "short", status: "closed", entry_price: 284.50, stop_loss: 296.00, take_profit: 255.00, exit_price: 258.30, shares: 40, entry_date: "2025-10-06", exit_date: "2025-10-14", pnl: 1048.00, notes: "Bearish engulfing on daily at all-time high zone. Short into weakness with tight stop above the wick. Covered at 200 SMA support. Textbook mean reversion.", tags: "reversal,pattern,mean-reversion", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-10-06T11:10:00" },

  // Small winner — partial exit
  { id: 4,  symbol: "META",  direction: "long",  status: "closed", entry_price: 612.40, stop_loss: 598.00, take_profit: 650.00, exit_price: 632.80, shares: 30, entry_date: "2025-10-20", exit_date: "2025-10-28", pnl: 612.00, notes: "Pullback to 21 EMA on the daily. Took half off at +1R, trailed the rest. Good process even though I left some on the table.", tags: "pullback,ema,partial-exit", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-10-20T14:20:00" },

  // Fade trade — short-term
  { id: 5,  symbol: "SPY",   direction: "short", status: "closed", entry_price: 608.40, stop_loss: 613.00, take_profit: 596.00, exit_price: 598.80, shares: 100, entry_date: "2025-11-03", exit_date: "2025-11-04", pnl: 960.00, notes: "Faded the gap up on FOMC day. Bearish divergence on RSI + volume drying up at highs. Covered into close for quick +1.5R.", tags: "fade,divergence,fomc", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-11-03T09:32:00" },

  // Swing trade — held through consolidation
  { id: 6,  symbol: "MSFT",  direction: "long",  status: "closed", entry_price: 448.00, stop_loss: 435.00, take_profit: 480.00, exit_price: 476.50, shares: 35, entry_date: "2025-11-10", exit_date: "2025-11-21", pnl: 997.50, notes: "Cup and handle breakout confirmed on weekly chart. Held through a 3-day shakeout that tested the breakout level. Patience paid off.", tags: "pattern,weekly,swing", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-11-10T10:15:00" },

  // Sector rotation loss
  { id: 7,  symbol: "AMD",   direction: "long",  status: "closed", entry_price: 158.20, stop_loss: 150.00, take_profit: 178.00, exit_price: 151.40, shares: 55, entry_date: "2025-12-01", exit_date: "2025-12-03", pnl: -374.00, notes: "Semis got hit by sector rotation into defensives. Cut quickly when it broke the rising trendline. Avoided the full move to $142.", tags: "sector-rotation,stopped", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-12-01T11:05:00" },

  // Earnings play
  { id: 8,  symbol: "GOOGL", direction: "long",  status: "closed", entry_price: 198.60, stop_loss: 190.00, take_profit: 220.00, exit_price: 218.40, shares: 50, entry_date: "2025-12-08", exit_date: "2025-12-16", pnl: 990.00, notes: "Post-earnings drift play. Beat on cloud revenue and raised guidance. Entered the next day on the pullback to VWAP. AI search monetization thesis playing out.", tags: "earnings,cloud,ai", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-12-08T09:50:00" },

  // Crypto-adjacent momentum
  { id: 9,  symbol: "COIN",  direction: "long",  status: "closed", entry_price: 312.00, stop_loss: 292.00, take_profit: 360.00, exit_price: 354.60, shares: 22, entry_date: "2025-12-22", exit_date: "2026-01-05", pnl: 937.20, notes: "BTC broke $120k and COIN followed with a clean flag breakout. Held over the holiday — volume confirmed the move on Jan 2. Let the winner ride.", tags: "crypto,momentum,flag", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2025-12-22T13:30:00" },

  // Cloud thesis
  { id: 10, symbol: "AMZN",  direction: "long",  status: "closed", entry_price: 228.00, stop_loss: 220.00, take_profit: 248.00, exit_price: 244.60, shares: 55, entry_date: "2026-01-12", exit_date: "2026-01-22", pnl: 913.00, notes: "AWS re-acceleration showing in channel checks. Bought the pullback to the rising 20 EMA. Exited into the earnings run-up to reduce event risk.", tags: "cloud,fundamental,swing", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-01-12T10:00:00" },

  // Quick scalp — small win
  { id: 11, symbol: "NVDA",  direction: "long",  status: "closed", entry_price: 132.40, stop_loss: 128.50, take_profit: 142.00, exit_price: 136.80, shares: 120, entry_date: "2026-01-26", exit_date: "2026-01-27", pnl: 528.00, notes: "Intraday hammer at support. Took a quick scalp for +0.5R. Didn't want to hold into the Fed meeting. Sometimes protecting capital is the trade.", tags: "scalp,support,risk-off", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-01-26T09:38:00" },

  // Breakeven — trailed stop
  { id: 12, symbol: "SOFI",  direction: "long",  status: "closed", entry_price: 18.40, stop_loss: 17.20, take_profit: 21.50, exit_price: 18.50, shares: 400, entry_date: "2026-02-02", exit_date: "2026-02-06", pnl: 40.00, notes: "Fintech breakout attempt. Moved stop to breakeven after +0.5R. Got stopped out on a shakeout. No damage done — good risk management.", tags: "fintech,breakeven,trail", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-02T10:45:00" },

  // Bigger loss — gap down
  { id: 13, symbol: "SMCI",  direction: "long",  status: "closed", entry_price: 42.80, stop_loss: 38.50, take_profit: 52.00, exit_price: 36.20, shares: 110, entry_date: "2026-02-09", exit_date: "2026-02-10", pnl: -726.00, notes: "Gapped below stop on accounting concerns rumor. Took the full loss immediately at market open. Lesson: always size for the gap risk on small caps.", tags: "gap-risk,lesson,small-cap", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-09T10:20:00" },

  // Recent winner
  { id: 14, symbol: "PLTR",  direction: "long",  status: "closed", entry_price: 102.50, stop_loss: 95.00, take_profit: 120.00, exit_price: 118.40, shares: 60, entry_date: "2026-02-12", exit_date: "2026-02-21", pnl: 954.00, notes: "Government AI contract pipeline keeps expanding. Bought the breakout above the $100 psychological level. Strong relative strength vs QQQ all week.", tags: "ai,government,breakout", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-12T10:25:00" },

  // ── Open trades (currently held) ──────────────────────────────────────────

  // Swing long — in profit
  { id: 15, symbol: "AVGO",  direction: "long",  status: "open", entry_price: 224.00, stop_loss: 214.00, take_profit: 252.00, exit_price: null, shares: 45, entry_date: "2026-02-24", exit_date: null, pnl: null, notes: "AI networking play. Broadcom earnings beat drove a gap up — entered on the first pullback. Stop below the gap fill level. Watching for $250 resistance test.", tags: "ai,networking,gap-and-go", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-24T09:42:00" },

  // Swing short — hedge
  { id: 16, symbol: "IWM",   direction: "short", status: "open", entry_price: 228.00, stop_loss: 235.00, take_profit: 210.00, exit_price: null, shares: 60, entry_date: "2026-02-25", exit_date: null, pnl: null, notes: "Small caps showing relative weakness. Shorting as a hedge against my long book. If we get a broad selloff, this should outperform to the downside.", tags: "hedge,small-cap,relative-weakness", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-25T14:15:00" },

  // New position — just entered
  { id: 17, symbol: "CRWD",  direction: "long",  status: "open", entry_price: 412.00, stop_loss: 395.00, take_profit: 450.00, exit_price: null, shares: 28, entry_date: "2026-02-28", exit_date: null, pnl: null, notes: "Cybersecurity spending accelerating. Entered after it reclaimed the 50 SMA with strong volume. This sector has been lagging and is due for a catch-up move.", tags: "cybersecurity,sma-reclaim,catch-up", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-28T10:08:00" },

  // ── Planned trades (watchlist / setups) ───────────────────────────────────

  // Waiting for pullback
  { id: 18, symbol: "NFLX",  direction: "long",  status: "planned", entry_price: 1020.00, stop_loss: 995.00, take_profit: 1080.00, exit_price: null, shares: 18, entry_date: null, exit_date: null, pnl: null, notes: "Ad-tier revenue growth accelerating. Want to buy a pullback to the 21 EMA around $1020. Need a hammer or bullish engulfing for confirmation before entering.", tags: "pullback,ema,ad-revenue", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-02-28T20:00:00" },

  // Breakout watch
  { id: 19, symbol: "LLY",   direction: "long",  status: "planned", entry_price: 880.00, stop_loss: 860.00, take_profit: 930.00, exit_price: null, shares: 22, entry_date: null, exit_date: null, pnl: null, notes: "GLP-1 pipeline catalyst coming in March. Setting alert for a breakout above $880 resistance. Volume needs to be 1.5x average for confirmation.", tags: "pharma,catalyst,breakout-watch", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-03-01T08:00:00" },

  // Short setup
  { id: 20, symbol: "RIVN",  direction: "short", status: "planned", entry_price: 16.80, stop_loss: 18.50, take_profit: 13.00, exit_price: null, shares: 280, entry_date: null, exit_date: null, pnl: null, notes: "EV delivery numbers declining. Watching for a breakdown below the $17 support shelf. If it loses this level, next stop is the $13 gap fill from last earnings.", tags: "ev,breakdown,gap-fill", account_size: 50000, commission: 1.00, risk_per_trade: 1, created_at: "2026-03-01T08:30:00" },
];

/** Demo settings returned to guest sessions. */
export const DEMO_SETTINGS: Record<string, string> = {
  discord_webhook: "",
  fmp_api_key: "",
  account_size: "50000",
  risk_per_trade: "1",
  commission_per_trade: "1",
  chart_tabs: JSON.stringify([
    { id: "1", label: "NVDA", interval: "D", symbol: "NVDA" },
    { id: "2", label: "SPY 15m", interval: "15", symbol: "SPY" },
    { id: "3", label: "AVGO", interval: "D", symbol: "AVGO" },
  ]),
  watchlists: JSON.stringify([
    {
      id: "1",
      name: "Main Watch",
      items: [
        { type: "sector", id: "1", name: "AI / Semis", collapsed: false },
        { symbol: "NVDA", name: "NVIDIA Corp" },
        { symbol: "AVGO", name: "Broadcom Inc" },
        { symbol: "AMD", name: "Advanced Micro Devices" },
        { symbol: "PLTR", name: "Palantir Technologies" },
        { type: "sector", id: "2", name: "Mega Cap Tech", collapsed: false },
        { symbol: "AAPL", name: "Apple Inc" },
        { symbol: "MSFT", name: "Microsoft Corp" },
        { symbol: "GOOGL", name: "Alphabet Inc" },
        { symbol: "META", name: "Meta Platforms" },
        { symbol: "AMZN", name: "Amazon.com Inc" },
        { type: "sector", id: "3", name: "Setups", collapsed: false },
        { symbol: "NFLX", name: "Netflix Inc" },
        { symbol: "LLY", name: "Eli Lilly & Co" },
        { symbol: "CRWD", name: "CrowdStrike Holdings" },
      ],
    },
    {
      id: "2",
      name: "Short Ideas",
      items: [
        { symbol: "IWM", name: "iShares Russell 2000 ETF" },
        { symbol: "RIVN", name: "Rivian Automotive" },
        { symbol: "SMCI", name: "Super Micro Computer" },
      ],
    },
  ]),
  watchlist_width: "240",
  panel_width: "420",
};
