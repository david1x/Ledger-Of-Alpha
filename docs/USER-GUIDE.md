# Ledger Of Alpha User Guide

Welcome to the **Ledger Of Alpha** user guide. This document explains how to use the advanced features of the platform to improve your trading performance.

## Account Management

Ledger Of Alpha supports multiple accounts (e.g., Live, Paper, Futures).

- **Create Accounts:** Go to **Settings > Accounts** to add new accounts.
- **Configure Defaults:** Set a starting balance, risk per trade, and commission value for each account.
- **Switch Accounts:** Use the account selector in the sidebar to filter your dashboard and trade history by a specific account.
- **Default Account:** One account is always marked as "Default" and will be the target for new trades if no other account is specified.

---

## Trade Strategies & Checklists

To maintain trading discipline, you can define custom strategies and checklists.

- **Manage Strategies:** Navigate to **Settings > Strategies**.
- **Create Checklist:** Add a new strategy and define the specific criteria (e.g., "RSI Oversold," "Trendline Break").
- **Apply to Trades:** In the **Trade Modal**, select your strategy from the dropdown. The checklist will automatically appear, allowing you to check off criteria before or after the trade.
- **Reorder:** You can drag and drop strategies to reorder them in the list.

---

## Risk Simulator (Monte Carlo)

The **Risk Simulator** on the Analytics page uses a Monte Carlo simulation based on your historical trading performance.

### How it Works:
1. It takes your historical P&L percentage from closed trades.
2. It runs 5,000 simulations of your next series of trades (e.g., 100 trades).
3. It randomly samples from your historical returns for each trade in the simulation.

### Key Metrics:
- **Simulation Horizon:** Choose how many future trades to simulate (50, 100, 250, 500).
- **Ruin Threshold:** Define the drawdown percentage (e.g., 50%) that constitutes "ruin."
- **Ruin Probability:** The percentage of simulated paths that hit your ruin threshold.
- **Median Final Balance:** The expected account balance after the simulation horizon.
- **Avg Max DD:** The average deepest drawdown across all 5,000 paths.

### Requirements:
- You must have at least **5 closed trades** in your account to run a valid simulation.

---

## Import & Export

- **Broker Imports:** Go to **Journal > Import** to import trades from **ThinkOrSwim (TOS)**, **Interactive Brokers (IBKR)**, or **Robinhood**.
- **Manual Import/Export:** Use **Settings > Data** to export your history as CSV/JSON or to import a previously exported Ledger Of Alpha file.
