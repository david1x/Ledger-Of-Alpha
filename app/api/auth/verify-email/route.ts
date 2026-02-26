import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", req.url));
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
      return NextResponse.redirect(new URL("/login?error=invalid-token", req.url));
    }

    db.prepare("UPDATE email_tokens SET used = 1 WHERE id = ?").run(row.id);
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);

    return NextResponse.redirect(new URL("/login?verified=1", req.url));
  } catch (e) {
    console.error("verify-email error:", e);
    return NextResponse.redirect(new URL("/login?error=server", req.url));
  }
}
