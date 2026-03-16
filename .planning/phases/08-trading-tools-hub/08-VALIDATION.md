---
phase: 8
slug: trading-tools-hub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (project standard: build-only validation) |
| **Config file** | none — no test framework configured |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must pass + manual smoke test of each calculator
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | TOOLS-01 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | TOOLS-02 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-03 | 01 | 1 | TOOLS-03 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-04 | 01 | 1 | TOOLS-04 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-05 | 01 | 1 | TOOLS-05 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-06 | 01 | 1 | TOOLS-06 | manual | `npm run build` | N/A | ⬜ pending |
| 08-01-07 | 01 | 1 | TOOLS-07 | manual | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install — project standard is `npm run build` for TypeScript type-checking.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /tools accessible from sidebar nav | TOOLS-01 | UI navigation | Click Tools in sidebar, verify /tools loads with all 6 tabs |
| R:R calculation with visual ladder | TOOLS-02 | Visual output | Enter entry/stop/target, verify colored zones + correct ratio |
| Compound growth curve display | TOOLS-03 | Chart visual | Enter balance/rate/months, verify Recharts curve renders |
| Drawdown recovery calculation | TOOLS-04 | Math output | Enter 50% drawdown, verify 100% recovery shown |
| Kelly criterion output | TOOLS-05 | Math output | Enter 60% WR, $200 avg win, $100 avg loss, verify ~20% Kelly |
| Fibonacci levels display | TOOLS-06 | Visual output | Enter high/low, verify all retracement + extension levels |
| Correlation matrix with OHLCV | TOOLS-07 | API + visual | Select 3 symbols, click Calculate, verify color-coded matrix |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
