<div align="center">

# 📈 Ledger Of Alpha

**A self-hosted trading journal, planner, and chart dashboard built for serious traders.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)](https://github.com/WiseLibs/better-sqlite3)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

*Log trades · Plan setups · Analyze performance · Send chart snapshots to Discord*

</div>

---

## ✨ Features

### 📊 Dashboard
- At-a-glance stats: total trades, win rate, gross P&L, average win/loss
- Interactive P&L chart (Recharts) — see your equity curve at a glance
- Paginated recent-trades table with inline edit/delete
- Add-trade modal directly from the dashboard

### 📋 Trade Log
- Full trade history with live filters: symbol search, status (planned / open / closed), direction (long / short)
- Sortable table with P&L coloring and tag display
- Edit and delete any trade without leaving the page

### 🧮 Trade Planner
- Form to plan a trade before entry: symbol, direction, entry · stop · target, shares, thesis notes, tags
- **Live RiskCalculator** — shows dollar risk and R-multiple as you type
- **Live PositionSizer** — calculates optimal share count from account size and risk %
- Saves as a *planned* trade; promote to *open* or *closed* when ready
- Account size and risk-per-trade are editable inline

### 📓 Trade Journal
- Card-based view of every trade with full notes, tags, symbol, and P&L
- Filter between "all trades" and "trades with notes"
- Clean reading layout for post-trade review

### 📈 Chart
- Full-screen **TradingView Advanced Chart** embed (dark/light theme sync)
- Interval switcher: 1m · 5m · 15m · 1h · 4h · 1D · 1W
- Drawing tools side toolbar always visible; user settings persist via localStorage
- **Discord snapshot** — click once, grant screen permission, get a 3-second countdown to move your mouse, then the chart is cropped and posted automatically

### ⚙️ Settings
- Account size and risk-per-trade percentage
- Financial Modeling Prep (FMP) API key + on-demand symbol list refresh ($2B+ market cap stocks)
- Discord webhook URL for chart snapshot delivery

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 + dark/light theme via `next-themes` |
| Database | SQLite via `better-sqlite3` |
| Charts | Recharts (P&L curve) + TradingView Advanced Chart (candlestick) |
| Icons | Lucide React |
| External APIs | Financial Modeling Prep (symbol search), Discord Webhooks |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/your-username/ledger-of-alpha.git
cd ledger-of-alpha/tradeviz
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is created automatically at `data/ledger-of-alpha.db` on the first API call — no setup required.

### Configuration

All configuration is done inside the app at **Settings → ⚙️**.

| Setting | Required | Description |
|---|---|---|
| Account Size | Yes | Your trading account balance in USD |
| Risk Per Trade | Yes | Percentage of account risked per trade (default 1%) |
| FMP API Key | Optional | Enables live symbol search. Get a free key at [financialmodelingprep.com](https://financialmodelingprep.com) |
| Discord Webhook | Optional | Paste a webhook URL to enable chart-to-Discord snapshots |

---

## 📁 Project Structure

```
tradeviz/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── trades/page.tsx       # Full trade log
│   ├── planner/page.tsx      # Trade planner + live risk tools
│   ├── journal/page.tsx      # Journal card view
│   ├── chart/page.tsx        # TradingView chart + Discord snapshot
│   ├── settings/page.tsx     # App settings
│   ├── layout.tsx            # Root layout (Navbar, ThemeProvider)
│   └── api/
│       ├── trades/           # GET + POST trades
│       ├── trades/[id]/      # GET + PUT + DELETE single trade
│       ├── settings/         # GET + PUT settings
│       ├── symbols/          # GET symbols (FMP cache)
│       └── discord/          # POST chart snapshot to webhook
├── components/
│   ├── Navbar.tsx
│   ├── Logo.tsx              # SVG candlestick logo
│   ├── TradingViewWidget.tsx
│   ├── ThemeToggle.tsx
│   ├── RiskCalculator.tsx
│   └── PositionSizer.tsx
├── lib/
│   └── db.ts                 # SQLite init + schema
├── public/
│   └── favicon.svg
└── data/
    └── ledger-of-alpha.db    # Auto-created, gitignored
```

---

## 🗄 Database Schema

```sql
-- Trade records
CREATE TABLE trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol      TEXT NOT NULL,
  direction   TEXT NOT NULL,   -- 'long' | 'short'
  status      TEXT NOT NULL,   -- 'planned' | 'open' | 'closed'
  entry_price REAL,
  stop_loss   REAL,
  take_profit REAL,
  exit_price  REAL,
  shares      REAL,
  entry_date  TEXT,
  exit_date   TEXT,
  pnl         REAL,
  notes       TEXT,
  tags        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Key-value app settings
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- FMP symbol cache
CREATE TABLE symbols (
  symbol     TEXT PRIMARY KEY,
  name       TEXT,
  market_cap REAL,
  updated_at TEXT
);
```

---

## 📸 Discord Snapshot Flow

1. Open the **Chart** page and load any symbol/timeframe
2. Click **Snapshot → Discord**
3. Browser prompts for screen-share permission — click **Share this tab**
4. A **3-second countdown** appears — move your mouse off the chart
5. The chart is automatically cropped and posted to your Discord channel with an optional note

---

## 🌙 Dark / Light Mode

The app defaults to dark mode. Toggle with the sun/moon button in the top-right corner of the navbar. The TradingView chart syncs its theme automatically.

---

## 📄 License

MIT — use it, fork it, trade with it.
