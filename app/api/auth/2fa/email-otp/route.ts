import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyJwt, generateOtp, hashToken } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import type { User } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const pending = req.cookies.get("pending_2fa")?.value;
    if (!pending) return NextResponse.json({ error: "No pending session." }, { status: 401 });

    const payload = await verifyJwt(pending);
    if (!payload?.sub) return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as User | undefined;
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    // Invalidate any previous OTPs for this user
    db.prepare(`
      UPDATE email_tokens SET used = 1
      WHERE user_id = ? AND type = 'otp_2fa' AND used = 0
    `).run(user.id);

    const otp = generateOtp();
    const otpHash = await hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_tokens (id, user_id, email, token_hash, type, expires_at)
      VALUES (?, ?, ?, ?, 'otp_2fa', ?)
    `).run(crypto.randomUUID(), user.id, user.email, otpHash, expiresAt);

    await sendOtpEmail(user.email, user.name, otp);

    return NextResponse.json({ ok: true, message: `Code sent to ${user.email}` });
  } catch (e) {
    console.error("email-otp error:", e);
    return NextResponse.json({ error: "Failed to send OTP." }, { status: 500 });
  }
}
