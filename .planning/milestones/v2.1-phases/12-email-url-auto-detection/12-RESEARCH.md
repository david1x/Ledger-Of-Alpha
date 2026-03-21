# Phase 12: Email URL Auto-Detection - Research

**Researched:** 2026-03-19
**Domain:** Next.js 15 request URL detection, header forwarding, email link generation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMAIL-01 | Email verification links auto-detect the correct URL from request headers (works across npm dev, Docker, Cloudflare tunnel) | `NextRequest.headers` provides `host`, `x-forwarded-host`, `x-forwarded-proto` — these are the detection inputs |
| EMAIL-02 | URL detection follows priority chain: admin DB override > X-Forwarded-Proto/Host > Host header > env var > localhost fallback | Implemented as a single `getBaseUrl(req)` function with explicit priority order |
| EMAIL-03 | All email-sending API routes (register, password reset, alerts) pass request context for URL detection | 3 email-sending routes identified; `sendVerificationEmail`, `sendOtpEmail`, `sendAlertEmail` all need a `baseUrl` parameter |
</phase_requirements>

---

## Summary

The project's `lib/email.ts` module currently determines the app URL via a module-level `getAppUrl()` function that reads from the DB (`_system` settings key `app_url`) and falls back to `process.env.NEXT_PUBLIC_APP_URL`. Neither source is aware of the incoming HTTP request, so when the app is reached via a Docker container name, a Cloudflare Tunnel, or any reverse-proxy, the emails contain the wrong base URL.

The fix is a single new utility `lib/request-url.ts` that accepts a `NextRequest` and implements the documented priority chain. All three email-sending functions in `lib/email.ts` gain an optional `baseUrl` parameter (keeping backward compatibility). The three API routes that call those functions pass `req` to derive the base URL before calling email helpers.

No new dependencies are required. The change is self-contained to one new file, one modified lib file, and three route files.

**Primary recommendation:** Create `lib/request-url.ts` with a pure `getBaseUrl(req: NextRequest): string` function. Modify email helper signatures to accept `baseUrl` as a parameter. Update call sites to pass the derived URL.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/server` `NextRequest` | 15.1.x | Typed request object with `.headers` accessor | Already in use project-wide |
| `lib/db.ts` `getDb()` | in-repo | Reads `_system` settings for `app_url` override | Already pattern for DB config in `lib/email.ts` |

### Supporting

No new packages. Everything needed is already in the codebase.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── request-url.ts   # NEW — getBaseUrl(req) utility
├── email.ts         # MODIFIED — accept baseUrl param on public functions
└── notifications.ts # MODIFIED — pass baseUrl through to sendAlertEmail
app/api/auth/
├── register/route.ts            # MODIFIED — derive and pass baseUrl
├── resend-verification/route.ts # MODIFIED — derive and pass baseUrl
├── 2fa/email-otp/route.ts       # MODIFIED — OTP does not embed URLs, no change needed
```

### Pattern 1: Priority-Chain URL Detection

**What:** A single function inspects request context in a documented priority order and returns the canonical base URL as a string.

**When to use:** Any server-side code that needs to construct an absolute URL for inclusion in an email.

**Example:**
```typescript
// lib/request-url.ts
import type { NextRequest } from "next/server";

/**
 * Resolves the public base URL for email links using the documented priority chain:
 *   1. Admin DB override (`app_url` setting under user_id = '_system')
 *   2. X-Forwarded-Proto + X-Forwarded-Host (reverse proxy / Cloudflare Tunnel)
 *   3. Host header + inferred protocol
 *   4. NEXT_PUBLIC_APP_URL env var
 *   5. http://localhost:3000 hardcoded fallback
 */
export function getBaseUrl(req: NextRequest): string {
  // 1. Admin DB override
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'")
      .get() as { value: string } | undefined;
    if (row?.value) return row.value.replace(/\/$/, "");
  } catch {}

  // 2. Reverse-proxy / Cloudflare Tunnel forwarded headers
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0].trim() ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  // 3. Host header (plain HTTP in dev, or direct TLS)
  const host = req.headers.get("host");
  if (host) {
    // Infer HTTPS for non-localhost hosts without a forwarded-proto
    const isLocalhost = host.startsWith("localhost") || host.startsWith("127.");
    const proto = isLocalhost ? "http" : "https";
    return `${proto}://${host}`;
  }

  // 4. Env var
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // 5. Hardcoded localhost fallback
  return "http://localhost:3000";
}
```

### Pattern 2: Pass baseUrl Into Email Functions

**What:** Email helper functions accept `baseUrl` as an explicit parameter instead of computing it internally.

**When to use:** Whenever the caller has a `NextRequest` context (API routes).

**Example:**
```typescript
// lib/email.ts — modified signature
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const base = baseUrl ?? getAppUrl(); // fallback for callers without req context
  const url = `${base}/api/auth/verify-email?token=${token}`;
  // ...
}
```

**Call-site change in register/route.ts:**
```typescript
import { getBaseUrl } from "@/lib/request-url";
// ...
const baseUrl = getBaseUrl(req);
await sendVerificationEmail(email, name.trim(), rawToken, baseUrl);
```

### Pattern 3: Alert emails use notifications.ts chain

Alert emails are sent via `lib/notifications.ts` → `sendAlertEmail()`. The `sendAlertNotifications(alert)` function has no request context because it is called from both cron (`check-prices/route.ts`) and user-triggered (`trigger/route.ts`) routes.

The `trigger/route.ts` has a `NextRequest`; `check-prices/route.ts` also has one. Both can pass `req` through to `sendAlertNotifications`, which in turn passes a derived `baseUrl` to `sendAlertEmail`.

```typescript
// lib/notifications.ts — add optional baseUrl param
export async function sendAlertNotifications(alert: Alert, baseUrl?: string) {
  // ...
  await sendAlertEmail(user.email, user.name, headline, alert.note, baseUrl);
}
```

### Anti-Patterns to Avoid

- **Reading `process.env.NEXT_PUBLIC_APP_URL` at module load time:** `auth.ts` already does this for cookie security (`const IS_HTTPS = ...`). Do NOT replicate this pattern in the new URL utility — read it lazily inside the function so tests can override it.
- **Trusting `x-forwarded-host` on value that may be a comma-list:** Some proxies append multiple values (`host1, host2`). Split on comma and take the first value.
- **Trailing-slash inconsistency:** Always strip trailing slashes from the resolved base URL to avoid double-slash links (`https://example.com//api/...`).
- **Breaking `sendOtpEmail`:** OTP emails send a code, not a URL. No base URL is needed; leave that function signature unchanged.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP header parsing | Custom header parser | `req.headers.get(name)` on `NextRequest` | Already a typed, spec-compliant Map |
| Proto detection | env-var flag | `x-forwarded-proto` header | Cloudflare and all major proxies set this automatically |

**Key insight:** `x-forwarded-host` and `x-forwarded-proto` are the standard mechanism that every reverse proxy (nginx, Cloudflare Tunnel, Traefik, AWS ALB) uses to communicate the original client-facing host and protocol. There is no need for a custom middleware to extract this — `NextRequest.headers` exposes them directly in App Router route handlers.

---

## Common Pitfalls

### Pitfall 1: x-forwarded-proto can contain multiple comma-separated values

**What goes wrong:** `req.headers.get("x-forwarded-proto")` returns `"https, https"` or `"http, https"` when the request passes through multiple proxies.

**Why it happens:** Each hop appends its own value per the RFC.

**How to avoid:** Always split on comma and take `[0].trim()`:
```typescript
const proto = forwardedProto?.split(",")[0].trim() ?? "https";
```

**Warning signs:** Links in emails begin with `"https, https://..."`.

### Pitfall 2: Container service names in the Host header

**What goes wrong:** Inside a Docker network, `req.headers.get("host")` returns the internal service name (e.g., `app:3000`) because the container's own requests see the container hostname.

**Why it happens:** The Host header is set by the HTTP client to the address it dialed.

**How to avoid:** When `x-forwarded-host` is present, always prefer it over `host`. Cloudflare Tunnel and nginx both set `x-forwarded-host` to the public hostname; the internal `host` is irrelevant.

**Warning signs:** Email links contain `app:3000` or `ledger-app:3000` instead of the public domain.

### Pitfall 3: Env var read at module load vs. at call time

**What goes wrong:** If `NEXT_PUBLIC_APP_URL` is evaluated at import time (`const base = process.env.NEXT_PUBLIC_APP_URL ?? ...`), changing the env var between hot-reload cycles has no effect.

**Why it happens:** Node.js module evaluation is cached.

**How to avoid:** Read env vars inside the function body, not at the module top level.

### Pitfall 4: Missing baseUrl in the alert email path

**What goes wrong:** Alert emails contain a link to the alerts management page (`/alerts`). If `sendAlertNotifications` is not updated, the `sendAlertEmail` call inside it still uses the old `getAppUrl()` which has no request context.

**Why it happens:** `sendAlertNotifications` is a server-side utility with no request context today.

**How to avoid:** Pass optional `baseUrl?: string` through the call chain: `route → sendAlertNotifications(alert, baseUrl) → sendAlertEmail(..., baseUrl)`.

---

## Code Examples

### Complete `lib/request-url.ts`

```typescript
// Source: Next.js 15 App Router docs — NextRequest.headers
import type { NextRequest } from "next/server";

/**
 * Returns the public base URL for constructing email links.
 *
 * Priority order (EMAIL-02):
 *   1. Admin DB override  (settings key 'app_url', user_id '_system')
 *   2. X-Forwarded-Proto + X-Forwarded-Host  (Cloudflare Tunnel, nginx, Docker proxy)
 *   3. Host header  (direct HTTP access)
 *   4. NEXT_PUBLIC_APP_URL env var
 *   5. http://localhost:3000 fallback
 */
export function getBaseUrl(req: NextRequest): string {
  // 1. Admin DB override
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'")
      .get() as { value: string } | undefined;
    if (row?.value) return row.value.replace(/\/$/, "");
  } catch {}

  // 2. Forwarded headers from reverse proxy
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0].trim() ?? "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }

  // 3. Host header
  const host = req.headers.get("host");
  if (host) {
    const isLocalhost = host.startsWith("localhost") || host.startsWith("127.");
    const proto = isLocalhost ? "http" : "https";
    return `${proto}://${host}`;
  }

  // 4. Env var
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // 5. Hardcoded fallback
  return "http://localhost:3000";
}
```

### Modified `sendVerificationEmail` signature (lib/email.ts)

```typescript
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const base = baseUrl ?? getAppUrl();
  const url = `${base}/api/auth/verify-email?token=${token}`;
  // ... rest unchanged
}
```

### Modified `sendPasswordResetEmail` signature (lib/email.ts)

```typescript
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const base = baseUrl ?? getAppUrl();
  const url = `${base}/reset-password?token=${token}`;
  // ... rest unchanged
}
```

### Modified `sendAlertEmail` signature (lib/email.ts)

```typescript
export async function sendAlertEmail(
  to: string,
  name: string,
  alertHeadline: string,
  note: string | null,
  baseUrl?: string
): Promise<void> {
  const base = baseUrl ?? getAppUrl();
  // ... replace getAppUrl() call in the link with base
}
```

### Call site — register/route.ts (pattern for all routes)

```typescript
import { getBaseUrl } from "@/lib/request-url";
// ...
const baseUrl = getBaseUrl(req);
await sendVerificationEmail(email, name.trim(), rawToken, baseUrl);
```

---

## Affected Files Inventory

| File | Change Type | What Changes |
|------|-------------|--------------|
| `lib/request-url.ts` | CREATE | New `getBaseUrl(req)` function |
| `lib/email.ts` | MODIFY | Add optional `baseUrl?` param to `sendVerificationEmail`, `sendPasswordResetEmail`, `sendAlertEmail`; keep `getAppUrl()` as internal fallback |
| `lib/notifications.ts` | MODIFY | Add optional `baseUrl?` param to `sendAlertNotifications`; pass through to `sendAlertEmail` |
| `app/api/auth/register/route.ts` | MODIFY | Import `getBaseUrl`, derive `baseUrl`, pass to `sendVerificationEmail` |
| `app/api/auth/resend-verification/route.ts` | MODIFY | Import `getBaseUrl`, derive `baseUrl`, pass to `sendVerificationEmail` |
| `app/api/alerts/trigger/route.ts` | MODIFY | Import `getBaseUrl`, derive `baseUrl`, pass to `sendAlertNotifications` |
| `app/api/alerts/check-prices/route.ts` | MODIFY | Import `getBaseUrl`, derive `baseUrl`, pass to `sendAlertNotifications` |
| `app/api/auth/2fa/email-otp/route.ts` | NO CHANGE | OTP emails contain no URLs; no modification needed |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.env.NEXT_PUBLIC_APP_URL` static fallback | Request-aware header detection | This phase | Emails work in Docker, Cloudflare Tunnel without manual env config |
| DB `app_url` override only | Priority chain with headers | This phase | Automatic detection removes need to manually configure URL in most cases |

---

## Open Questions

1. **Does `sendPasswordResetEmail` have a route that calls it?**
   - What we know: `sendPasswordResetEmail` is defined in `lib/email.ts` but no API route currently imports it. There is no `app/api/auth/forgot-password/` route in the codebase.
   - What's unclear: Is this function vestigial (never called), or is it expected to be wired up in a later phase?
   - Recommendation: Update its signature to accept `baseUrl?` anyway (zero cost, maintains consistency). Do not create the missing route in Phase 12 — that is out of scope.

2. **Should `getBaseUrl` be exported from `lib/email.ts` or kept in its own module?**
   - What we know: The phase plan calls for `lib/request-url.ts` as the file name.
   - What's unclear: Whether the admin panel (Phase 14) will want to call `getBaseUrl` as well to display the auto-detected URL.
   - Recommendation: Keep it in its own module (`lib/request-url.ts`) as specified. Phase 14 can import it directly when it needs the display value.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `lib/email.ts`, `lib/auth.ts`, `lib/notifications.ts`, all three email-sending routes — current behavior confirmed by reading source
- Next.js 15 App Router — `NextRequest.headers` is a standard `Headers` object; `.get(name)` returns `string | null` — confirmed by project's existing usage of this API in `lib/auth.ts` and `lib/rate-limit.ts`

### Secondary (MEDIUM confidence)

- Cloudflare Tunnel and nginx both set `X-Forwarded-Proto` / `X-Forwarded-Host` per RFC 7239 conventions — industry standard, corroborated by Cloudflare documentation patterns
- Docker bridge network DNS uses service names as hostnames — standard Docker Compose behavior

### Tertiary (LOW confidence)

- None — this phase is entirely self-contained within known, already-used APIs.

---

## Metadata

**Confidence breakdown:**
- Affected files: HIGH — full source inspection completed
- Standard stack: HIGH — no new dependencies, uses existing `NextRequest` and `getDb()` patterns
- Architecture: HIGH — priority chain is explicit in requirements; implementation is a direct translation
- Pitfalls: HIGH — derived from header specification behavior and Docker networking

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable Next.js APIs, no fast-moving dependencies)
