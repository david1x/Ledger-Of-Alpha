# Phase 14: Admin Configuration Expansion - Research

**Researched:** 2026-03-20
**Domain:** Next.js App Router API routes, admin settings persistence, API key masking, connection test patterns, SQLite settings table
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-01 | Admin panel manages system-level API keys (FMP, Gemini) as fallback defaults | `_system` settings row pattern already used for SMTP; same approach applies to `fmp_api_key` and `openai_api_key` under `user_id='_system'` |
| ADMIN-02 | Per-user API keys override system-level keys when set | `app/api/symbols/route.ts` already implements this pattern for FMP; same needs applying to Gemini in `app/api/ai/analyze/route.ts` and `app/api/ai/followup/route.ts` |
| ADMIN-03 | Admin panel shows auto-detected App URL alongside the manual override field | `getBaseUrl()` in `lib/request-url.ts` computes the auto-detected URL from request headers; a new GET endpoint can return this auto-detected value server-side |
| ADMIN-04 | Connection test buttons verify SMTP, FMP API, and Gemini API configuration | `nodemailer.createTransport().verify()` exists; FMP and Gemini have simple validation endpoints; test endpoints go in `app/api/admin/` |
| ADMIN-05 | Sensitive values (API keys, SMTP password) are masked in the admin UI after save | On GET, API returns `"••••••••"` placeholder instead of real value when key is non-empty; real value only transmitted on POST if user changed it (sentinel pattern) |
</phase_requirements>

---

## Summary

Phase 14 extends the existing admin settings panel — which already manages SMTP and App URL — to also manage system-level API keys for FMP and Gemini. The infrastructure for `_system`-scoped settings in SQLite already exists; this phase adds two new keys (`fmp_api_key`, `openai_api_key`) to the system settings, extends the admin UI component, and adds connection-test API endpoints.

The override chain for FMP is already implemented in `app/api/symbols/route.ts` (user key first, system key as fallback). The Gemini routes (`app/api/ai/analyze/route.ts`, `app/api/ai/followup/route.ts`) currently only check the user key and must be updated to fall through to the system key. The naming inconsistency noted in STATE.md — the user settings key is `openai_api_key` but the service is Gemini — must be preserved for backward compat; the system key will also use `openai_api_key` under `user_id='_system'`.

The masking requirement (ADMIN-05) uses a sentinel pattern: the GET endpoint returns `"••••••••"` when a key is non-empty, and the POST endpoint ignores updates when it receives the sentinel value (meaning the admin didn't change it). The App URL "auto-detect" display (ADMIN-03) requires a new server-side endpoint that returns what `getBaseUrl()` would compute — the client component cannot call `getBaseUrl()` directly since it needs `NextRequest`.

**Primary recommendation:** Extend existing patterns. All plumbing (DB schema, `requireAdmin` guard, `_system` row pattern) is already in place; this phase wires FMP/Gemini keys into the system settings, adds three test endpoints, and updates the `AdminSettingsTab` component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | Read/write `_system` settings rows | Already in use for all settings persistence |
| nodemailer | existing | `transport.verify()` for SMTP test | Already powers `lib/email.ts`; `verify()` is the canonical SMTP health check |
| `@google/generative-ai` | existing | Gemini API key test | Already used in `lib/ai-vision.ts` |
| Next.js App Router | 15 | API route handlers for test endpoints | All existing API routes use this |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | `CheckCircle`, `XCircle`, `Loader2` icons for test result UI | Keep consistent with rest of settings UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentinel masking pattern | Always re-transmit real value | Sentinel avoids ever sending cleartext key back to browser after first save; more secure |
| Server-side auto-URL endpoint | Client-side URL sniffing with `window.location` | `window.location` misses x-forwarded-host; server must compute it with full priority chain |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed except three new API route files:

```
app/api/admin/
├── settings/route.ts       # EXTEND: add fmp_api_key, openai_api_key, masking logic
├── test-smtp/route.ts      # NEW: SMTP connection test
├── test-fmp/route.ts       # NEW: FMP API key test
├── test-gemini/route.ts    # NEW: Gemini API key test
└── detected-url/route.ts   # NEW: returns server-computed auto-detected App URL

components/settings/tabs/
└── AdminSettingsTab.tsx    # EXTEND: add API Keys section, Test buttons, auto-URL display

components/settings/
└── types.ts                # EXTEND: add fmp_api_key, openai_api_key to SystemSettings
```

### Pattern 1: System Settings Sentinel Masking

**What:** On GET, return `"••••••••"` for any non-empty sensitive field. On POST, skip update if incoming value matches the sentinel.

**When to use:** Any field that should not round-trip cleartext through the browser after first save.

**Example:**
```typescript
// In GET handler (app/api/admin/settings/route.ts)
const SENSITIVE_KEYS = ["smtp_pass", "fmp_api_key", "openai_api_key"];
const SENTINEL = "••••••••";

for (const { key, value } of rows) {
  settings[key] = SENSITIVE_KEYS.includes(key) && value ? SENTINEL : value;
}

// In POST handler
for (const key of SYSTEM_KEYS) {
  if (key in body) {
    // Skip update if user didn't change masked value
    if (SENSITIVE_KEYS.includes(key) && body[key] === SENTINEL) continue;
    upsert.run(key, String(body[key] ?? ""));
  }
}
```

### Pattern 2: API Key Override Chain (extend to Gemini)

**What:** User key takes priority over system key. If user key is empty string or row absent, fall back to `_system` row.

**When to use:** Any feature gated by an API key where the admin provides a shared default.

**Example:**
```typescript
// Current pattern in app/api/symbols/route.ts (for FMP) — replicate for Gemini
const userRow = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'openai_api_key'").get(user.id) as { value: string } | undefined;
const apiKey = (userRow?.value)
  || (db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'openai_api_key'").get() as { value: string } | undefined)?.value
  || "";
```

The key distinction from the symbols route: check `userRow?.value` (truthy empty string = no key) not just row existence.

### Pattern 3: SMTP Connection Test

**What:** Create a nodemailer transporter from current DB settings, call `transport.verify()`, return pass/fail.

**When to use:** Test endpoint to validate SMTP config before relying on it for real emails.

**Example:**
```typescript
// app/api/admin/test-smtp/route.ts
import nodemailer from "nodemailer";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const get = (key: string) =>
    (db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = ?").get(key) as { value: string } | undefined)?.value ?? "";

  const host = get("smtp_host");
  const user = get("smtp_user");
  const pass = get("smtp_pass");

  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "SMTP not configured" });
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port: parseInt(get("smtp_port") || "587", 10),
      secure: get("smtp_secure") === "true",
      auth: { user, pass },
    });
    await transport.verify();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
```

### Pattern 4: FMP API Key Test

**What:** Hit a lightweight FMP endpoint (e.g., `/stable/search-symbol?query=AAPL`) with the saved system key. A 200 response with data = pass. A 401/403 or error JSON = fail.

**Example:**
```typescript
// app/api/admin/test-fmp/route.ts
const url = `https://financialmodelingprep.com/stable/search-symbol?query=AAPL&apikey=${apiKey}`;
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
const data = await res.json();
// FMP returns { "Error Message": "..." } on invalid key
if (!res.ok || data["Error Message"]) {
  return NextResponse.json({ ok: false, error: data["Error Message"] ?? "API error" });
}
return NextResponse.json({ ok: true });
```

### Pattern 5: Gemini API Key Test

**What:** Call `GoogleGenerativeAI.listModels()` or generate a trivial content request. A successful response = pass.

**Example:**
```typescript
// app/api/admin/test-gemini/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// Minimal token usage test — just check key validity
await model.generateContent("Say OK");
return NextResponse.json({ ok: true });
```

Note: This will consume a tiny amount of API quota. Acceptable for a manual test button.

### Pattern 6: Auto-Detected URL Endpoint

**What:** A GET endpoint that applies the `getBaseUrl()` priority chain (but skips the DB override step, since we want to show what the *auto-detection* would produce, not the override). Returns the computed URL for display alongside the manual override field.

**Example:**
```typescript
// app/api/admin/detected-url/route.ts
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Reproduce getBaseUrl priority 2-5 (skip DB override — that's what we're comparing against)
  const fwdHost = req.headers.get("x-forwarded-host");
  let detectedUrl = "";
  if (fwdHost) {
    const host = fwdHost.split(",")[0].trim();
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    detectedUrl = `${proto}://${host}`;
  } else {
    const hostHeader = req.headers.get("host");
    if (hostHeader) {
      const isLocal = hostHeader.startsWith("localhost") || hostHeader.startsWith("127.");
      detectedUrl = `${isLocal ? "http" : "https"}://${hostHeader}`;
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!detectedUrl && envUrl) detectedUrl = envUrl;
  if (!detectedUrl) detectedUrl = "http://localhost:3000";

  return NextResponse.json({ url: detectedUrl });
}
```

### Pattern 7: Test Button UI Component

The existing `IntegrationsTab.tsx` test button pattern (Discord webhook test) is the template:
- Button with loading spinner while in-flight
- Inline success (green) / failure (red) message that auto-clears after ~5s
- Disabled during test

The same visual pattern should be used for SMTP/FMP/Gemini test buttons in `AdminSettingsTab`.

### Anti-Patterns to Avoid

- **Reading real key values on GET and sending them to the browser:** Never round-trip actual API keys to the client. Apply sentinel masking on every GET response.
- **Storing the sentinel `"••••••••"` in the DB:** The POST handler must skip update when it receives the sentinel. If it writes it, the real key is erased.
- **Testing with unsaved values:** Test buttons must test what is currently stored in the DB, not the in-memory form state. Prompt: "Save first, then test" — or alternatively, save then test in sequence. Using stored values is simpler and avoids sending sensitive keys in test request bodies.
- **Inline key reading in test endpoints:** Test endpoints should read from `_system` settings in the DB, not accept the key as a request parameter (which would bypass the masking architecture).
- **Duplicating the FMP override logic:** Do not re-implement the user-key-over-system-key pattern in each API route independently. Consider a helper function `getApiKey(db, userId, keyName)` to reduce duplication across `symbols/route.ts`, `analyze/route.ts`, and `followup/route.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMTP health check | Custom TCP connect + EHLO | `nodemailer transport.verify()` | Handles TLS, auth, and protocol negotiation correctly |
| API key masking | Custom encryption | Sentinel placeholder string | Keys at rest in SQLite are on a self-hosted server; masking in transit (browser) is the goal, not encryption at rest |
| Connection timeout | Manual Promise.race | `AbortSignal.timeout(5000)` | Already used in symbols route; consistent pattern |

**Key insight:** All infrastructure already exists. The work is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: Writing Sentinel to DB
**What goes wrong:** POST handler receives `"••••••••"`, writes it to `_system` settings, erases the real key.
**Why it happens:** Forgetting the sentinel-skip guard in the POST handler.
**How to avoid:** Add a `SENSITIVE_KEYS` constant and check `body[key] === SENTINEL` before every upsert of a sensitive field.
**Warning signs:** After saving without changing a key, the key stops working.

### Pitfall 2: SystemSettings Type Missing New Keys
**What goes wrong:** `components/settings/types.ts` `SystemSettings` interface doesn't include `fmp_api_key` / `openai_api_key`. TypeScript errors, or keys silently dropped from the form state.
**Why it happens:** Forgetting to extend both the interface and the `SYS_DEFAULTS` constant.
**How to avoid:** Update `SystemSettings`, `SYS_DEFAULTS`, and `SYSTEM_KEYS` array in `app/api/admin/settings/route.ts` together as a single change.

### Pitfall 3: SYSTEM_KEYS Array Not Updated
**What goes wrong:** Admin saves `fmp_api_key` from the UI but the POST handler's `SYSTEM_KEYS` allowlist doesn't include it, so it's silently ignored.
**Why it happens:** `app/api/admin/settings/route.ts` has an explicit allowlist `SYSTEM_KEYS = [...]`. Adding a new key to the UI without adding it here means saves silently fail.
**How to avoid:** Always update `SYSTEM_KEYS` in the route handler when adding new system settings keys.

### Pitfall 4: FMP Symbols Route Already Has Partial Override Logic
**What goes wrong:** The symbols route checks `if (!row)` (row absence) to fall through to system key, but does NOT check `row.value === ""` (row exists but is empty). A user who cleared their FMP key still blocks the system fallback.
**Why it happens:** The existing code in `app/api/symbols/route.ts` uses `if (!row)` not `if (!row?.value)`.
**How to avoid:** When extending the same pattern to Gemini routes, use `if (!userRow?.value)` to properly handle empty personal keys. Also fix the symbols route in the same pass.

### Pitfall 5: Gemini Test Consuming Quota
**What goes wrong:** The Gemini API test button sends a real generative AI request, consuming tokens. Users may click it repeatedly.
**Why it happens:** The Gemini API doesn't have a cheap "validate key" endpoint; a real inference call is required.
**How to avoid:** Use the shortest possible prompt ("Say OK" or "1+1="). Document in UI that the test consumes a tiny amount of quota. Rate limiting is not necessary — it's a manual admin action.

### Pitfall 6: Dirty Indicator on Masked Field
**What goes wrong:** `useTabDirty` marks the admin settings tab as dirty immediately on load because the fetched masked value (`"••••••••"`) differs from the empty-string default in `SYS_DEFAULTS`.
**Why it happens:** The baseline is set from `SYS_DEFAULTS` which has `fmp_api_key: ""`, but fetched value is `"••••••••"`.
**How to avoid:** The `useTabDirty` hook uses a 500ms delay before setting baseline, then compares against the fetched value — not `SYS_DEFAULTS`. As long as the baseline is set after the fetch resolves, this is fine. Verify the timing is correct; the 500ms delay is designed for this.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: FMP Override Chain in symbols/route.ts
```typescript
// Source: app/api/symbols/route.ts (lines 19-27)
let apiKey = "";
if (user) {
  const row = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'fmp_api_key'").get(user.id) as { value: string } | undefined;
  if (!row) {  // NOTE: bug — should be if (!row?.value)
    const sys = db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'fmp_api_key'").get() as { value: string } | undefined;
    apiKey = sys?.value ?? "";
  } else {
    apiKey = row.value;
  }
}
```

### Existing: SMTP Read from _system Settings
```typescript
// Source: lib/email.ts (lines 22-27)
const get = (key: string): string =>
  (db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = ?").get(key) as { value: string } | undefined)?.value ?? "";
const host = get("smtp_host");
const user = get("smtp_user");
const pass = get("smtp_pass");
if (host && user && pass) { /* use DB config */ }
```

### Existing: Upsert _system Settings Row
```typescript
// Source: app/api/admin/settings/route.ts (lines 39-46)
const upsert = db.prepare(
  "INSERT INTO settings (user_id, key, value) VALUES ('_system', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value"
);
for (const key of SYSTEM_KEYS) {
  if (key in body) {
    upsert.run(key, String(body[key] ?? ""));
  }
}
```

### Existing: Discord Test Button Pattern (reference for test UI)
```typescript
// Source: components/settings/tabs/IntegrationsTab.tsx (lines 58-87)
// Pattern: setTesting(true) → fetch test endpoint → setMsg({text, type:"ok"|"err"}) → setTesting(false)
// Result message rendered as: <span className={msg.type === "ok" ? "text-emerald-400" : "text-red-400"}>
```

### Existing: requireAdmin Guard
```typescript
// Source: app/api/admin/settings/route.ts (lines 17-19)
const admin = await requireAdmin(req);
if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `openai_api_key` settings key for OpenAI | `openai_api_key` key, but Gemini service | v2.0 switch to Gemini | Naming inconsistency; keep key name for backward compat, update labels only |
| No system-level API keys | System API keys as fallback (this phase) | Phase 14 | Admins can pre-configure keys so users don't need their own |
| Admin panel: SMTP + App URL only | Admin panel: SMTP + App URL + FMP + Gemini | Phase 14 | Single admin panel for all runtime configuration |

**Deprecated/outdated:**
- The "only-check-row-existence" FMP fallback in `symbols/route.ts`: replace with `!row?.value` check so empty personal keys properly fall through to system key.

---

## Open Questions

1. **What happens when both user key and system key are empty?**
   - What we know: Currently, Gemini routes return `{ error: "Gemini API key not configured", code: "NO_API_KEY" }` with 400.
   - What's unclear: Should the error message change to indicate the admin can configure a system key?
   - Recommendation: Update the error message to "No Gemini API key set. Configure one in Settings > Integrations or ask your admin to set a system key."

2. **Should the SMTP test use the form values (pre-save) or only stored DB values?**
   - What we know: Discord test button uses the in-form URL, not stored value. SMTP test could also work this way, but would require sending `smtp_pass` in the test request body.
   - What's unclear: Security tradeoff.
   - Recommendation: Test only saved DB values. Button copy: "Save first, then use Test to verify." This avoids transmitting passwords in test requests.

3. **Should test endpoints be in `/api/admin/test-smtp` or `/api/admin/settings/test-smtp`?**
   - What we know: No established nested pattern in this codebase.
   - What's unclear: No strong convention either way.
   - Recommendation: Flat `app/api/admin/test-smtp/route.ts`, `test-fmp/route.ts`, `test-gemini/route.ts`. Simpler file layout, no nesting needed.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `app/api/admin/settings/route.ts` — existing SYSTEM_KEYS allowlist and upsert pattern
- Codebase direct read: `app/api/symbols/route.ts` — existing FMP user-over-system override chain
- Codebase direct read: `lib/email.ts` — SMTP config read pattern from _system settings
- Codebase direct read: `components/settings/tabs/AdminSettingsTab.tsx` — current admin tab structure
- Codebase direct read: `components/settings/types.ts` — SystemSettings interface, SYS_DEFAULTS, CATEGORIES
- Codebase direct read: `lib/request-url.ts` — getBaseUrl priority chain
- Codebase direct read: `app/api/ai/analyze/route.ts`, `app/api/ai/followup/route.ts` — current Gemini key lookup (user-only, no system fallback)
- Runtime check: `nodemailer.createTransport().verify` is type `function` — confirmed available

### Secondary (MEDIUM confidence)
- STATE.md decision log: `openai_api_key` naming inconsistency noted, preserve for backward compat
- REQUIREMENTS.md: ADMIN-01 through ADMIN-05 definitions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified by reading package.json/imports
- Architecture: HIGH — all patterns derived directly from existing codebase code, not external research
- Pitfalls: HIGH — derived from reading actual existing code paths and spotting concrete issues (e.g., the `!row` vs `!row?.value` bug in symbols route)

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable domain — SQLite patterns, nodemailer, internal architecture)
