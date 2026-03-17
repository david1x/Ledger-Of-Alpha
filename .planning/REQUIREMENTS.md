# Requirements: Ledger Of Alpha

**Defined:** 2026-03-15
**Core Value:** Traders can track, analyze, and improve their trading through structured journaling and actionable analytics.

## v2.0 Requirements

Requirements for v2.0 Intelligence & Automation. Each maps to roadmap phases.

### AI Chart Analysis

- [ ] **AI-01**: User can upload a chart screenshot from the trade view
- [ ] **AI-02**: AI identifies chart patterns (H&S, flags, wedges, triangles) with confidence scores
- [ ] **AI-03**: Analysis results are stored and linked to the trade record
- [ ] **AI-04**: User can find similar past trades by AI-detected pattern type
- [ ] **AI-05**: User can view aggregate performance stats per pattern type (win rate, avg P&L)

### IBKR Broker Sync

- [ ] **IBKR-01**: User can configure IBKR Client Portal gateway connection in settings
- [ ] **IBKR-02**: User can trigger manual trade sync via "Sync Now" button
- [ ] **IBKR-03**: Imported trades are deduplicated by IBKR execution ID
- [ ] **IBKR-04**: User can view live open positions from IBKR with unrealized P&L
- [ ] **IBKR-05**: User can see last sync timestamp and success/error status

### Monte Carlo Entry Integration

- [x] **MC-01**: User sees ruin probability warning when proposed trade risk is too high
- [x] **MC-02**: User sees inline simulation preview (median outcome, probability of profit) in trade modal
- [x] **MC-03**: System suggests optimal position size based on historical performance
- [x] **MC-04**: User can filter simulation by strategy/setup type for targeted risk analysis

### Trading Tools Hub

- [x] **TOOLS-01**: User can access a Trading Tools page from the navigation
- [x] **TOOLS-02**: User can calculate risk/reward ratio with visual entry/stop/target display
- [x] **TOOLS-03**: User can project account growth with compound growth calculator
- [x] **TOOLS-04**: User can determine recovery requirements from drawdown percentage
- [x] **TOOLS-05**: User can calculate optimal position size via Kelly Criterion
- [x] **TOOLS-06**: User can compute Fibonacci retracement and extension levels
- [x] **TOOLS-07**: User can view correlation matrix for traded symbols using historical data

## Future Requirements

Deferred beyond v2.0. Tracked but not in current roadmap.

### Mobile Experience

- **MOB-01**: User can access full app functionality via PWA on mobile
- **MOB-02**: User can install app on iOS/Android home screen

### Advanced AI

- **AI-06**: System retroactively labels historical trade screenshots with patterns
- **AI-07**: User can visually overlay two trade setups side-by-side for comparison

### Advanced Broker Sync

- **IBKR-06**: System automatically polls for new trades on a configurable interval
- **IBKR-07**: User can resolve conflicts between manually-entered and auto-imported trades
- **IBKR-08**: User can sync with brokers beyond IBKR (TD Ameritrade, Robinhood live)

### Advanced Monte Carlo

- **MC-05**: System factors current losing/winning streak into simulation conditioning
- **MC-06**: User can compare simulation results with and without proposed trade

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Options calculators (Black-Scholes, Greeks) | Equity/forex focus for v2.0 |
| Real-time chat/social features | Solo trader focus — not aligned with core value |
| Two-way broker sync (send orders to IBKR) | Order management is a different product; regulatory complexity |
| On-device AI model (TensorFlow.js/ONNX) | Too heavy for trader hardware; cloud API is sufficient |
| Custom model training for chart patterns | Requires 50K+ labeled screenshots; out of scope |
| Video/stream chart analysis | Order of magnitude harder than static screenshots |
| Storing calculator state in database | Calculators are ephemeral tools, not stored documents |
| Multi-broker live sync in v2.0 | Start with IBKR; expand later based on demand |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-01 | Phase 10 | Pending |
| AI-02 | Phase 10 | Pending |
| AI-03 | Phase 10 | Pending |
| AI-04 | Phase 10 | Pending |
| AI-05 | Phase 10 | Pending |
| IBKR-01 | Phase 11 | Pending |
| IBKR-02 | Phase 11 | Pending |
| IBKR-03 | Phase 11 | Pending |
| IBKR-04 | Phase 11 | Pending |
| IBKR-05 | Phase 11 | Pending |
| MC-01 | Phase 9 | Complete |
| MC-02 | Phase 9 | Complete |
| MC-03 | Phase 9 | Complete |
| MC-04 | Phase 9 | Complete |
| TOOLS-01 | Phase 8 | Complete |
| TOOLS-02 | Phase 8 | Complete |
| TOOLS-03 | Phase 8 | Complete |
| TOOLS-04 | Phase 8 | Complete |
| TOOLS-05 | Phase 8 | Complete |
| TOOLS-06 | Phase 8 | Complete |
| TOOLS-07 | Phase 8 | Complete |

**Coverage:**
- v2.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 — traceability filled after roadmap creation*
