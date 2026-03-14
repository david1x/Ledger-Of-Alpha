# Phase 05: Advanced Analytics & Reports

## Goal
Implement deep performance analytics and reporting features to help users identify their edge and export trade data.

---

## Proposed Changes

### 1. Advanced Analytics Widgets
New components for deeper trade distribution analysis:
- **DistributionChart.tsx:** New widget showing P&L and frequency by:
  - Day of Week (Monday - Friday)
  - Time of Day (Hour-by-hour)
  - Month (Year-to-date)
- **EquityComparisonChart.tsx:** Overlay chart comparing realized equity (closed trades) with total account equity (including open risk).

### 2. Strategy Breakdown Report
A new dedicated view or widget that aggregates performance by `strategy_id`:
- Average R:R achieved per strategy
- Win rate per strategy
- Profit Factor per strategy (Gross Profit / Gross Loss)
- Sharpe Ratio estimate (simplified)

### 3. Data Export Features
- **Export Route:** `app/api/trades/export/route.ts` to generate CSV/JSON payloads.
- **Export UI:** New "Export" button in Settings or Trades page.
- **CSV formatting:** Ensure all 50+ trade fields are correctly mapped for spreadsheet use.

---

## Verification Plan

### Automated Tests
- [ ] **Unit Tests for Analytics Logic:** Create `tests/analytics.test.ts` to verify distribution calculations and strategy stats.
- [ ] **Export Validation:** Verify CSV generation logic handles nested fields and nulls.

### Manual Verification
- [ ] **Data Integrity:** Confirm analytics widgets match `TradeTable` data.
- [ ] **Visual Polish:** Ensure charts are responsive and follow the `ui-brand.md` guidelines (emerald/amber/red color palette).
- [ ] **Export Test:** Open exported CSV in Excel/Google Sheets to ensure columns are correct.
- [ ] **Responsive check:** Verify charts don't break on mobile views.
