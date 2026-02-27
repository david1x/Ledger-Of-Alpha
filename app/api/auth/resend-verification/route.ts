import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import type { User } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase()) as User | undefined;

    // Always return success to avoid leaking whether an account exists
    if (!user || user.email_verified) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate any existing unused verify_email tokens for this user
    db.prepare(
      "UPDATE email_tokens SET used = 1 WHERE user_id = ? AND type = 'verify_email' AND used = 0"
    ).run(user.id);

    // Issue a fresh token
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      "INSERT INTO email_tokens (id, user_id, email, token_hash, type, expires_at) VALUES (?, ?, ?, ?, 'verify_email', ?)"
    ).run(crypto.randomUUID(), user.id, user.email, tokenHash, expiresAt);

    await sendVerificationEmail(user.email, user.name, rawToken);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("resend-verification error:", e);
    return NextResponse.json({ error: "Failed to resend email." }, { status: 500 });
  }
}
