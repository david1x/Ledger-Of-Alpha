---
phase: 14-admin-configuration-expansion
verified: 2026-03-20T14:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Save FMP API key in admin panel, reload page, confirm field shows '••••••••' not the raw key"
    expected: "Key is masked after reload; no cleartext appears in response JSON from /api/admin/settings"
    why_human: "Cannot drive a browser session or inspect cookies programmatically to confirm GET masking round-trip"
  - test: "Save a masked field without changing it, verify the original DB value is preserved"
    expected: "POST with sentinel '••••••••' does not overwrite the stored key (re-load shows key still present)"
    why_human: "Requires a live DB session — cannot test sentinel skip logic against a real DB record"
  - test: "Click 'Test Connection' for SMTP with valid credentials"
    expected: "Green 'Connection successful' appears; spinner shows while in-flight; auto-clears after ~5 seconds"
    why_human: "Requires an interactive browser session and a reachable SMTP server"
  - test: "Click 'Test' for FMP key with invalid key, then with valid key"
    expected: "Red error on invalid key; green 'Connection successful' on valid key"
    why_human: "Requires live FMP API call from a running dev server"
  - test: "Click 'Test' for Gemini key with valid key"
    expected: "Green 'Connection successful' after brief spinner"
    why_human: "Requires live Gemini API call from a running dev server with a real key"
  - test: "AI analysis via Settings > Integrations: user with no personal key set uses system key"
    expected: "Screenshot analysis works if admin has set a system Gemini key, even when user's personal key is empty"
    why_human: "End-to-end behavior requires live AI call and two DB rows; cannot verify the cascade with grep"
---

# Phase 14: Admin Configuration Expansion — Verification Report

**Phase Goal:** The admin panel is the single source of truth for runtime configuration — operators can set API keys, SMTP, and App URL without touching environment variables
**Verified:** 2026-03-20T14:00:00Z
**Status:** human_needed (all automated checks passed; human tests required for interactive UI and live API calls)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                                                    |
|----|------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1  | Admin can enter FMP and Gemini API keys and they persist after save                      | ✓ VERIFIED | `fmp_api_key` and `openai_api_key` in `SYSTEM_KEYS` (settings/route.ts:15-16); POST handler upserts both via `_system`     |
| 2  | Saved API keys appear masked as '••••••••' after page reload                             | ✓ VERIFIED | `SENSITIVE_KEYS` + `SENTINEL` defined; GET masks non-empty values before response (settings/route.ts:34-37)                 |
| 3  | A user's personal API key overrides the system key                                       | ✓ VERIFIED | Both analyze/route.ts and followup/route.ts: `userRow?.value \|\| systemRow?.value \|\| ""`                                |
| 4  | Admin panel shows auto-detected App URL alongside the manual override field              | ✓ VERIFIED | `detected-url/route.ts` endpoint exists; AdminSettingsTab fetches it on mount and renders below App URL input (line 134-141)|
| 5  | SMTP password appears masked after save (not cleartext)                                  | ✓ VERIFIED | `smtp_pass` is in `SENSITIVE_KEYS`; same sentinel masking applies on GET                                                    |
| 6  | Admin can click Test buttons for SMTP, FMP API, and Gemini and receive pass/fail result  | ✓ VERIFIED | Three endpoint files exist with POST handlers; AdminSettingsTab wires all three via `runTest()`                              |
| 7  | Test buttons show loading spinner while in-flight                                        | ✓ VERIFIED | `Loader2` spinner shown when `*.loading === true`; `runTest()` sets/clears loading state (AdminSettingsTab.tsx:60-74)       |
| 8  | Test results display green for pass and red for fail                                     | ✓ VERIFIED | Result rendered with `text-emerald-400` / `text-red-400` conditional class (AdminSettingsTab.tsx:239, 288, 325)             |
| 9  | FMP fallback bug fixed — empty personal key falls through to system key                  | ✓ VERIFIED | `if (!row?.value)` at symbols/route.ts:21 — handles both missing row and empty string value                                 |

**Score:** 9/9 derived truths verified

---

## Required Artifacts (Plan 14-01)

| Artifact                                       | Expected                                           | Status     | Details                                                               |
|------------------------------------------------|----------------------------------------------------|------------|-----------------------------------------------------------------------|
| `app/api/admin/settings/route.ts`              | SYSTEM_KEYS + SENSITIVE_KEYS + SENTINEL masking    | ✓ VERIFIED | `fmp_api_key`, `openai_api_key` in SYSTEM_KEYS; masking on GET; skip on POST when value === SENTINEL |
| `app/api/admin/detected-url/route.ts`          | GET endpoint returning auto-detected URL           | ✓ VERIFIED | GET handler with requireAdmin guard; returns `{ url: detectedUrl }` following priority steps 2-5   |
| `components/settings/types.ts`                 | SystemSettings with fmp_api_key, openai_api_key   | ✓ VERIFIED | Both fields in interface (lines 78-79) and in SYS_DEFAULTS (lines 92-93)                           |
| `components/settings/tabs/AdminSettingsTab.tsx`| API Keys section + auto-URL display + Test buttons| ✓ VERIFIED | API Keys section at line 247; detectedUrl display at line 134; all 3 Test buttons wired             |
| `app/api/ai/analyze/route.ts`                  | User-over-system Gemini key fallback               | ✓ VERIFIED | `userRow?.value \|\| systemRow?.value \|\| ""` pattern at lines 40-43                              |
| `app/api/ai/followup/route.ts`                 | User-over-system Gemini key fallback               | ✓ VERIFIED | Identical fallback pattern at lines 44-47                                                           |
| `app/api/symbols/route.ts`                     | Fixed FMP fallback with `!row?.value`              | ✓ VERIFIED | `if (!row?.value)` at line 21; system key lookup at lines 22-24                                     |

## Required Artifacts (Plan 14-02)

| Artifact                              | Expected                                              | Status     | Details                                                                                |
|---------------------------------------|-------------------------------------------------------|------------|----------------------------------------------------------------------------------------|
| `app/api/admin/test-smtp/route.ts`    | POST endpoint verifying SMTP via nodemailer.verify()  | ✓ VERIFIED | Reads smtp_host/user/pass from `_system` DB; calls `transport.verify()`; returns `{ ok }` |
| `app/api/admin/test-fmp/route.ts`     | POST endpoint validating FMP key via symbol search    | ✓ VERIFIED | Reads `fmp_api_key` from `_system`; fetches FMP search-symbol; checks `Error Message` field |
| `app/api/admin/test-gemini/route.ts`  | POST endpoint validating Gemini key via generateContent| ✓ VERIFIED | Reads `openai_api_key` from `_system`; calls `GoogleGenerativeAI` + `generateContent("Say OK")` |
| `components/settings/tabs/AdminSettingsTab.tsx` (test buttons) | Test buttons for SMTP, FMP, Gemini | ✓ VERIFIED | `runTest()` helper at lines 60-74; three buttons calling `/api/admin/test-{smtp,fmp,gemini}` |

---

## Key Link Verification

### Plan 14-01 Key Links

| From                          | To                           | Via                                          | Status     | Details                                                        |
|-------------------------------|------------------------------|----------------------------------------------|------------|----------------------------------------------------------------|
| AdminSettingsTab.tsx          | /api/admin/settings          | fetch on mount and save                      | ✓ WIRED    | fetch("/api/admin/settings") on mount (line 28); POST on save (line 46) |
| AdminSettingsTab.tsx          | /api/admin/detected-url      | fetch on mount for auto-URL display          | ✓ WIRED    | fetch("/api/admin/detected-url") in same useEffect (line 36)   |
| app/api/ai/analyze/route.ts   | settings WHERE user_id='_system' | SQL fallback for openai_api_key          | ✓ WIRED    | `db.prepare(...user_id = '_system' AND key = 'openai_api_key')` at line 42 |
| app/api/admin/settings/route.ts | SENTINEL check             | skip upsert when value is sentinel           | ✓ WIRED    | `if (SENSITIVE_KEYS.includes(key) && body[key] === SENTINEL) continue;` at line 56 |

### Plan 14-02 Key Links

| From                          | To                           | Via                              | Status     | Details                                                              |
|-------------------------------|------------------------------|----------------------------------|------------|----------------------------------------------------------------------|
| AdminSettingsTab.tsx          | /api/admin/test-smtp         | fetch POST on button click       | ✓ WIRED    | `runTest("/api/admin/test-smtp", setSmtpTest)` at line 229           |
| AdminSettingsTab.tsx          | /api/admin/test-fmp          | fetch POST on button click       | ✓ WIRED    | `runTest("/api/admin/test-fmp", setFmpTest)` at line 279             |
| AdminSettingsTab.tsx          | /api/admin/test-gemini       | fetch POST on button click       | ✓ WIRED    | `runTest("/api/admin/test-gemini", setGeminiTest)` at line 316       |
| app/api/admin/test-smtp/route.ts | settings WHERE user_id='_system' | reads SMTP config from DB   | ✓ WIRED    | `get("smtp_host")`, `get("smtp_user")`, `get("smtp_pass")` at lines 18-20 |
| app/api/admin/test-gemini/route.ts | @google/generative-ai  | GoogleGenerativeAI with DB key   | ✓ WIRED    | `new GoogleGenerativeAI(apiKey)` at line 23; `generateContent` at line 25 |

---

## Requirements Coverage

All five requirement IDs declared across plans 14-01 and 14-02 are present in REQUIREMENTS.md under "Admin Configuration". All five are marked `[x]` (complete) in REQUIREMENTS.md.

| Requirement | Source Plan | Description                                                    | Status      | Evidence                                                                 |
|-------------|-------------|----------------------------------------------------------------|-------------|--------------------------------------------------------------------------|
| ADMIN-01    | 14-01       | Admin manages FMP/Gemini keys as system-wide fallback defaults | ✓ SATISFIED | `fmp_api_key`, `openai_api_key` in SYSTEM_KEYS; stored under `_system` user |
| ADMIN-02    | 14-01       | Per-user keys override system-level keys                       | ✓ SATISFIED | User-over-system fallback in analyze/route.ts and followup/route.ts      |
| ADMIN-03    | 14-01       | Admin panel shows auto-detected App URL                        | ✓ SATISFIED | `/api/admin/detected-url` endpoint + UI display in AdminSettingsTab      |
| ADMIN-04    | 14-02       | Connection test buttons for SMTP, FMP API, Gemini API          | ✓ SATISFIED | Three test route files + three Test buttons in AdminSettingsTab           |
| ADMIN-05    | 14-01       | Sensitive values masked after save                             | ✓ SATISFIED | SENSITIVE_KEYS + SENTINEL constant; GET masks; POST skips sentinel        |

No orphaned requirements: the traceability table in REQUIREMENTS.md maps only ADMIN-01 through ADMIN-05 to Phase 14, and all five are claimed by the plans.

---

## Anti-Patterns Found

Files scanned: `app/api/admin/settings/route.ts`, `app/api/admin/detected-url/route.ts`, `app/api/admin/test-smtp/route.ts`, `app/api/admin/test-fmp/route.ts`, `app/api/admin/test-gemini/route.ts`, `components/settings/tabs/AdminSettingsTab.tsx`, `app/api/ai/analyze/route.ts`, `app/api/ai/followup/route.ts`, `app/api/symbols/route.ts`, `components/settings/types.ts`.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No TODOs, FIXMEs, placeholder returns, or stub implementations detected in any of the phase 14 files.

---

## Human Verification Required

### 1. Sentinel Round-Trip (API Keys)

**Test:** Log in as admin, navigate to `/settings?tab=admin-settings`. Enter a dummy FMP API key (e.g., `test-key-12345`) and save. Reload the page. Open browser DevTools Network tab, find the GET `/api/admin/settings` response.
**Expected:** The `fmp_api_key` field in the JSON response reads `••••••••` (not the original `test-key-12345`). The input field in the UI also shows `••••••••`.
**Why human:** Cannot issue authenticated HTTP requests or inspect encrypted cookie sessions programmatically here.

### 2. Sentinel Skip on Resave

**Test:** With a saved FMP key showing as `••••••••`, click Save System Settings without editing the key field.
**Expected:** The original key is still stored in the DB (re-loading and using the Test button confirms it is valid).
**Why human:** Requires a live DB with a real row and browser interaction to confirm sentinel skip logic is working end-to-end.

### 3. SMTP Test Button — Live Connection

**Test:** Configure valid SMTP credentials (e.g., Gmail SMTP with app password) and click "Test Connection".
**Expected:** Green "Connection successful" appears within a few seconds; spinner is visible during the test; result auto-clears after ~5 seconds.
**Why human:** Requires a reachable SMTP server and an active dev server session.

### 4. FMP Test Button — Key Validation

**Test:** With a valid FMP API key saved, click the "Test" button next to the FMP API Key field.
**Expected:** Green "Connection successful". With an invalid key, a red error message matching the FMP error string.
**Why human:** Requires live FMP API request from running server.

### 5. Gemini Test Button — Key Validation

**Test:** With a valid Gemini API key saved, click the "Test" button next to the Gemini API Key field.
**Expected:** Green "Connection successful" after a short wait (generateContent round-trip).
**Why human:** Requires live Gemini API call; cannot simulate without real credentials and running server.

### 6. User-over-System Fallback for AI Analysis

**Test:** As a regular user (no personal Gemini key in Settings > Integrations), upload a screenshot for AI analysis.
**Expected:** If admin has set a system Gemini key, analysis succeeds. If not, the error message reads "No Gemini API key set. Configure one in Settings > Integrations or ask your admin to set a system key."
**Why human:** Requires two live DB rows (user with no key, system with key) and an actual screenshot upload flow.

---

## Summary

All automated checks pass. The phase 14 implementation is substantively complete:

- The admin panel at `/settings?tab=admin-settings` contains all required sections: New User Defaults, App URL with auto-detected display, SMTP configuration, and a new API Keys section.
- `SYSTEM_KEYS`, `SENSITIVE_KEYS`, and `SENTINEL` are correctly defined and wired in `app/api/admin/settings/route.ts`. GET masks sensitive values; POST skips upsert when value equals sentinel.
- `app/api/admin/detected-url/route.ts` correctly implements priority steps 2-5 of the getBaseUrl chain (intentionally skipping the DB override step).
- Both AI routes (`analyze` and `followup`) implement the user-over-system fallback pattern identically.
- The FMP symbols route correctly uses `!row?.value` to handle empty personal keys.
- All three test endpoints (`test-smtp`, `test-fmp`, `test-gemini`) read credentials from the `_system` DB user and return `{ ok: true }` or `{ ok: false, error: string }`.
- `AdminSettingsTab.tsx` wires all three Test buttons through a shared `runTest()` helper with loading state, inline result display, and 5-second auto-clear.

Six human verification items remain to confirm live interactive behavior — sentinel round-trip in the browser, live SMTP/FMP/Gemini API calls, and the end-to-end AI fallback chain. No structural gaps or missing wiring were found.

---

_Verified: 2026-03-20T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
