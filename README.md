<div align="center">

# Ledger Of Alpha

**A self-hosted trading journal, planner, and chart dashboard built for serious traders.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)](https://github.com/WiseLibs/better-sqlite3)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

*Log trades · Plan setups · Analyze performance · Send chart snapshots to Discord*

</div>

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/01-dashboard.png?v=2)
*24 drag-reorderable widget cards: cumulative P&L, drawdown, win %, Fear & Greed Index, VIX, market overview, weekly calendar, heatmap, and more. Time filtering (30/60/90/All days), privacy mode, and layout persistence.*

### Trade Log
![Trade Log](docs/screenshots/02-trades.png?v=2)
*Full trade history with P&L coloring, status/direction filters, symbol search, column picker. Live unrealized P&L for open positions. Export/import as CSV or JSON.*

### Trade Modal
![Trade Modal](docs/screenshots/07-trade-modal.png?v=2)
*Tabbed trade editor (Setup & Strategy / Market Execution / Psychology & Reflection) with interactive setup chart, strategy checklists, R:R analysis, and position sizing.*

### Trade Journal
![Journal](docs/screenshots/03-journal.png?v=2)
*Cards, list, or review mode. Star ratings, key takeaway insights, full trade notes, strategy tags, and embedded mini candlestick charts with entry/stop/target levels.*

### Chart — TradingView + Watchlist
![Chart](docs/screenshots/04-chart.png?v=2)
*Full-screen TradingView chart with multi-tab support, resizable watchlist sidebar with sector grouping, and collapsible Add Trade panel with risk calculator.*

### Price Alerts
![Alert Modal](docs/screenshots/13-alert-modal.png?v=2)
*Set price alerts by level (above/below/crosses) or percentage move. Notification options: repeating, email, and Discord webhook.*

### Settings
![Settings](docs/screenshots/05-settings.png?v=2)
*Account settings, multi-account management, tags & common mistakes, trade templates, display options, chart config, strategy checklists, integrations, security, and data management.*

### Strategies & Checklists
![Strategies](docs/screenshots/12-settings-strategies.png?v=2)
*Define multiple custom trading strategies (e.g., Wyckoff Buying/Selling Tests) with configurable checklist items. Strategies are selectable per trade in the trade modal.*

### Login
![Login](docs/screenshots/06-login.png?v=2)
*Clean auth page with guest mode, 2FA support, and email verification.*

---

### Mobile — Fully Responsive

<table>
  <tr>
    <td align="center"><b>Dashboard</b><br/><img src="docs/screenshots/08-mobile-dashboard.png?v=2" width="220"/></td>
    <td align="center"><b>Trade Log</b><br/><img src="docs/screenshots/09-mobile-trades.png?v=2" width="220"/></td>
    <td align="center"><b>Chart</b><br/><img src="docs/screenshots/10-mobile-chart.png?v=2" width="220"/></td>
    <td align="center"><b>Settings</b><br/><img src="docs/screenshots/11-mobile-settings.png?v=2" width="220"/></td>
  </tr>
</table>

---

## Documentation

Detailed documentation is available in the `docs/` directory:

- **[User Guide](docs/USER-GUIDE.md)**: How to use advanced features like Monte Carlo simulations and multi-account management.
- **[API Documentation](docs/API.md)**: Details on the available API endpoints.
- **[Architecture](docs/ARCHITECTURE.md)**: Technical overview of the system design and database migrations.

---

## Features

### Dashboard
- At-a-glance stats: balance, total P&L (with % return), today's P&L, trade count, win rate
- 24 customizable widget cards with drag-reorder and 3 size modes (large/medium/compact)
- Cumulative P&L equity curve, cumulative drawdown, profit factor, total return %
- **Market widgets**: Fear & Greed Index gauge, VIX Index gauge, Market Overview (S&P 500, NASDAQ, DOW)
- Weekly calendar strip and monthly heatmap with daily P&L breakdown
- Winning vs losing trades, average win vs average loss comparisons
- Trading activity calendar, performance by symbol (horizontal bar chart)
- Time filter: 30/60/90/All days across all widgets
- Privacy mode to mask sensitive numbers

### Multi-Account Management
- Create separate accounts for Live, Paper, Futures, or different strategies
- Each account has its own starting balance, risk parameters, and commission model
- View aggregate stats across all accounts or filter by a specific account

### Trade Log
- Full trade history with live filters: symbol search, status (planned/open/closed), direction (long/short)
- P&L coloring, live unrealized P&L for open positions (via Yahoo Finance)
- Hover any symbol to preview a mini candlestick chart with trade levels
- **Export** trades as CSV or JSON for backup and analysis
- **Import** trades from CSV/JSON or directly from **ThinkOrSwim (TOS)**, **Interactive Brokers (IBKR)**, or **Robinhood**

### Trade Journal
- Three view modes: **Cards**, **List**, and **Review**
- Star ratings (1-5) and key takeaway insights per trade
- Full trade notes, strategy tags, and R:R display
- Embedded mini candlestick charts with entry/stop/target price lines
- Bulk select for batch operations
- Filter by symbol, status, and direction

### Trade Modal
- Tabbed interface: **Setup & Strategy** / **Market Execution** / **Psychology & Reflection**
- Interactive setup chart (click to set entry/stop/target, drag to reposition)
- Live risk analysis with stop distance, target distance, risk/reward calculation
- Strategy checklists with completion score
- Account & status management (trade lifecycle: planned/open/closed)
- Position sizer based on account balance and risk percentage

### Chart Page
- Full-screen **TradingView Advanced Chart** embed with dark/light theme sync
- Multi-tab support — open multiple charts, rename tabs, persist across sessions
- Interval switcher: 1m, 5m, 15m, 1h, 4h, 1D, 1W
- **Watchlist sidebar** — resizable, with sector grouping, drag-to-reorder, filter, and collapsible sections
- **Add Trade panel** — collapsible sidebar with interactive chart, risk calculator, strategy checklist
- **Price Alerts** — by price level (above/below/crosses) or percentage move, with email and Discord notifications
- **Discord snapshot** — screen capture with countdown, or paste a TradingView snapshot link

### Settings
- **Account**: Starting balance, risk per trade %, commission model (flat/percentage), daily loss limit
- **Accounts**: Manage multiple trading accounts
- **Tags & Mistakes**: Define reusable tags and common mistake categories
- **Templates**: Save trade templates for quick entry
- **Display**: UI customization options
- **Chart**: Chart-specific settings
- **Strategies**: Add, rename, and edit multiple trading strategies with checklist items
- **Integrations**: FMP API key for symbol search, Discord webhook for chart snapshots
- **Security**: 2FA setup, password management
- **Data**: Export/import trades, database management

### Auth & Security
- JWT sessions with email/password login
- **2FA** — TOTP (authenticator app) with backup codes
- Email verification on signup
- **Guest mode** — explore the app with realistic demo data, no account required
- **Admin panel** — manage users, toggle admin rights, configure SMTP
- **Privacy Mode** — toggle to mask sensitive P&L and balance numbers across the app
- **Rate limiting** — per-IP throttling on auth and API endpoints
- **Security headers** — CSP, HSTS, X-Frame-Options via middleware

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 + dark/light theme via `next-themes` |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Charts | Recharts (dashboard charts) · TradingView Advanced Chart · lightweight-charts (setup mini-chart) |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit |
| External APIs | Yahoo Finance (live quotes + OHLCV) · Financial Modeling Prep (symbol search) · Discord Webhooks |

---

## Getting Started

```bash
git clone https://github.com/david1x/Ledger-Of-Alpha.git
cd Ledger-Of-Alpha
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is created automatically — no setup required.

> **Try it instantly** — click **Continue as Guest** on the login page to explore with pre-loaded demo trades. No account needed.

### Docker

```bash
cp docker-compose.example.yml docker-compose.yml
# Edit docker-compose.yml — set JWT_SECRET and SMTP credentials
docker compose up -d --build
```

The app runs on port **5555** by default. The SQLite database is persisted in a Docker volume.

### First-Time Setup

1. Register your account
2. Go to **Settings** and claim admin access (first user only)
3. Configure your starting balance, risk per trade, and commission
4. Start logging trades

For detailed setup instructions (environment variables, SMTP configuration, admin setup, troubleshooting), see **[GETTING-STARTED.md](GETTING-STARTED.md)**.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Session signing key (min 32 chars). Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | No | Public URL for email links (default: `http://localhost:3000`) |
| `SMTP_HOST` | No | SMTP server for sending emails |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_SECURE` | No | Use SSL (`true` for port 465, `false` for STARTTLS) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for emails |
| `DB_PATH` | No | Override SQLite database location |

Without SMTP configured, emails print to the console (useful for development).

---

## Project Structure

```
app/              Next.js pages + API routes
  api/            REST API (trades, accounts, settings, auth, etc.)
components/       React components (client-side)
  dashboard/      Dashboard widgets (charts, stats, heatmap, etc.)
lib/              Server utilities (db, auth, validation, etc.)
data/             SQLite database (auto-created, gitignored)
public/           Static assets
docs/             Documentation + screenshots
```

---

## License

MIT — use it, fork it, trade with it.

---

Built by [David Amar](https://github.com/david1x)
