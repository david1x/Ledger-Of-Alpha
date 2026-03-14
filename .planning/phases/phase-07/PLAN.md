# Phase 07 Plan: Polish & Documentation

## Goal
Deliver a production-ready experience with full documentation and a flawless mobile/desktop UI.

---

## Proposed Changes

### 1. Technical Documentation (Wave 1)
- **API Reference:** Create `docs/API.md` documenting:
  - `GET /api/trades` (filters, params)
  - `POST /api/trades/import/multi` (broker formats)
  - `GET /api/fear-greed` and `GET /api/vix` integrations.
- **Architecture Guide:** Create `docs/ARCHITECTURE.md` explaining the SQLite migrations, better-sqlite3 usage, and the account-aware context system.

### 2. User Experience Guide (Wave 1)
- **User Guide:** Create `docs/USER-GUIDE.md` covering:
  - Setting up strategies and checklists.
  - Interpreting Monte Carlo ruin probability.
  - Assigning trades to different accounts.
- **Onboarding:** Update `README.md` with updated screenshots and a "Quick Start" section for new traders.

### 3. UI Polish & Accessibility (Wave 2)
- **Visual Consistency:** Audit all components for consistent rounded corners (`rounded-2xl` vs `rounded-3xl`) and shadow levels.
- **Accessibility:** Add `aria-label` to icon-only buttons (Refresh, Delete, Edit).
- **Transitions:** Add smooth entry animations to the new Analytics page sections using Tailwind `animate-in`.

### 4. Mobile Responsive Audit (Wave 2)
- **Analytics Page:** Update `app/analytics/page.tsx` grid to stack correctly on mobile (change `xl:grid-cols-2` behavior).
- **Dashboard Grid:** Ensure the DnD grid doesn't cause horizontal scrolling on mobile.
- **Modals:** Verify `AlertModal` and `TradeModal` are easy to interact with on touch screens.

---

## Verification Plan

### Automated Tests
- [ ] **Lighthouse Audit:** Run a local Lighthouse audit to ensure accessibility and performance scores are > 90.
- [ ] **Type Check:** Final `npx tsc --noEmit` to ensure zero regressions.

### Manual Verification
- [ ] **Cross-Device Testing:** Verify all pages on Chrome DevTools (iPhone 12, iPad, Desktop).
- [ ] **Link Integrity:** Confirm all links in `README.md` and `USER-GUIDE.md` work.
- [ ] **Contrast Check:** Verify all dark mode text colors meet WCAG contrast guidelines.
