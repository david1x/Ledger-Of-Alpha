import type { NextRequest } from "next/server";

/**
 * Derives the public base URL from the incoming request, following this priority chain:
 *
 * 1. Admin DB override — `settings` table, user_id='_system', key='app_url'
 * 2. x-forwarded-host + x-forwarded-proto headers (set by reverse proxies)
 * 3. host header (with proto inferred from hostname)
 * 4. NEXT_PUBLIC_APP_URL environment variable
 * 5. Hardcoded fallback: http://localhost:3000
 *
 * Returns a URL string with no trailing slash.
 */
export function getBaseUrl(req: NextRequest): string {
  // Priority 1: Admin DB override
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'")
      .get() as { value: string } | undefined;
    if (row?.value) return row.value.replace(/\/$/, "");
  } catch {}

  // Priority 2: x-forwarded-host + x-forwarded-proto (reverse proxy / Cloudflare Tunnel)
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) {
    const host = fwdHost.split(",")[0].trim();
    const fwdProto = req.headers.get("x-forwarded-proto");
    const proto = fwdProto ? fwdProto.split(",")[0].trim() : "https";
    return `${proto}://${host}`;
  }

  // Priority 3: host header (infer proto from hostname)
  const hostHeader = req.headers.get("host");
  if (hostHeader) {
    const hostName = hostHeader.split(":")[0];
    const isLocal =
      hostName === "localhost" ||
      hostName.startsWith("127.") ||
      hostName === "::1" ||
      hostName === "0.0.0.0";
    // 0.0.0.0 is a listen address, not routable — skip to env/fallback
    if (hostName === "0.0.0.0") {
      // fall through to env var / fallback
    } else {
      const proto = isLocal ? "http" : "https";
      return `${proto}://${hostHeader}`;
    }
  }

  // Priority 4: NEXT_PUBLIC_APP_URL env var (read inside function body, not at module level)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // Priority 5: hardcoded fallback
  return "http://localhost:3000";
}
