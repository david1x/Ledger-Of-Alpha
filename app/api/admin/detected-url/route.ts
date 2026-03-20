import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Returns the server-computed auto-detected URL based on request headers.
 * Mirrors priority steps 2-5 of getBaseUrl() but intentionally skips
 * the DB override (step 1) so the admin can see what auto-detection produces
 * independently of any stored override.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let detectedUrl: string;

  // Priority 2: x-forwarded-host + x-forwarded-proto (reverse proxy / Cloudflare Tunnel)
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) {
    const host = fwdHost.split(",")[0].trim();
    const fwdProto = req.headers.get("x-forwarded-proto");
    const proto = fwdProto ? fwdProto.split(",")[0].trim() : "https";
    detectedUrl = `${proto}://${host}`;
  } else {
    // Priority 3: host header (infer proto from hostname)
    const hostHeader = req.headers.get("host");
    if (hostHeader) {
      const isLocal =
        hostHeader.startsWith("localhost") ||
        hostHeader.startsWith("127.") ||
        hostHeader.startsWith("::1");
      const proto = isLocal ? "http" : "https";
      detectedUrl = `${proto}://${hostHeader}`;
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      // Priority 4: NEXT_PUBLIC_APP_URL env var
      detectedUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    } else {
      // Priority 5: hardcoded fallback
      detectedUrl = "http://localhost:3000";
    }
  }

  return NextResponse.json({ url: detectedUrl });
}
