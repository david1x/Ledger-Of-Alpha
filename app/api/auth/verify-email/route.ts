import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { getBaseUrl } from "@/lib/request-url";

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req);
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${base}/login?error=invalid-token`);
  }

  try {
    const db = getDb();
    const tokenHash = await hashToken(token);
    const row = db.prepare(`
      SELECT id, user_id, expires_at, used
      FROM email_tokens
      WHERE token_hash = ? AND type = 'verify_email'
    `).get(tokenHash) as { id: string; user_id: string; expires_at: string; used: number } | undefined;

    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return NextResponse.redirect(`${base}/login?error=invalid-token`);
    }

    db.prepare("UPDATE email_tokens SET used = 1 WHERE id = ?").run(row.id);
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);

    return NextResponse.redirect(`${base}/login?verified=1`);
  } catch (e) {
    console.error("verify-email error:", e);
    return NextResponse.redirect(`${base}/login?error=server`);
  }
}
