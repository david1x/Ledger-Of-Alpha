# Ledger Of Alpha API Documentation

This document describes the primary API endpoints for Ledger Of Alpha.

## Trades API

### GET /api/trades
Fetches a list of trades for the authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (`planned`, `open`, `closed`).
- `direction` (optional): Filter by direction (`long`, `short`).
- `symbol` (optional): Filter by ticker symbol (partial match, case-insensitive).
- `account_id` (optional): Filter by a specific account ID. If omitted, returns all trades across all accounts (or as per system defaults).

**Response (200 OK):**
Returns an array of trade objects, sorted by `created_at` in descending order.

```json
[
  {
    "id": 1,
    "symbol": "AAPL",
    "direction": "long",
    "status": "closed",
    "entry_price": 150.00,
    "exit_price": 160.00,
    "shares": 10,
    "pnl": 100.00,
    "created_at": "2023-10-01T12:00:00Z",
    "account_id": "...",
    ...
  }
]
```

### POST /api/trades/import/multi
Imports trades from broker-specific CSV exports.

**Body:**
```json
{
  "csv": "CSV_CONTENT_STRING",
  "account_id": "TARGET_ACCOUNT_ID" (optional)
}
```

**Supported Brokers:**
- ThinkOrSwim (TOS)
- Interactive Brokers (IBKR)
- Robinhood

**Response (200 OK):**
```json
{
  "success": true,
  "broker": "tos",
  "count": 15,
  "message": "Successfully imported 15 trades from TOS"
}
```

---

## Market Sentiment API

### GET /api/fear-greed
Fetches the current CNN Fear & Greed Index value. Results are cached for 10 minutes.

**Response (200 OK):**
```json
{
  "value": 42,
  "label": "Fear",
  "timestamp": 1696156800000
}
```

### GET /api/vix
Fetches the current CBOE Volatility Index (VIX) from Yahoo Finance. Results are cached for 5 minutes.

**Response (200 OK):**
```json
{
  "value": 18.5,
  "change": 0.5,
  "changePercent": 2.78
}
```

---

## Authorization
All endpoints (except guest-accessible demo routes) require a valid session. Use `/api/auth/login` to authenticate.
