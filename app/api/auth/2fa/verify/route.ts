import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyJwt, signJwt, hashToken } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import type { User } from "@/lib/types";

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function POST(req: NextRequest) {
  try {
    const pending = req.cookies.get("pending_2fa")?.value;
    if (!pending) return NextResponse.json({ error: "No pending session." }, { status: 401 });

    const payload = await verifyJwt(pending);
    if (!payload?.sub) return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as User | undefined;
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    let verified = false;

    // Try TOTP first
    if (user.two_factor_secret) {
      verified = verifyTotp(code, user.two_factor_secret);
    }

    // Fall back to email OTP
    if (!verified) {
      const codeHash = await hashToken(code);
      const row = db.prepare(`
        SELECT id, expires_at FROM email_tokens
        WHERE user_id = ? AND token_hash = ? AND type = 'otp_2fa' AND used = 0
      `).get(user.id, codeHash) as { id: string; expires_at: string } | undefined;

      if (row && new Date(row.expires_at) >= new Date()) {
        db.prepare("UPDATE email_tokens SET used = 1 WHERE id = ?").run(row.id);
        verified = true;
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
    }

    // Issue full session JWT
    const session = await signJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      emailVerified: !!user.email_verified,
      twoFactorEnabled: !!user.two_factor_enabled,
      twoFactorDone: true,
    }, "7d");

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", session, cookieOpts(7 * 24 * 60 * 60));
    res.cookies.set("pending_2fa", "", { ...cookieOpts(0) });
    return res;
  } catch (e) {
    console.error("2fa verify error:", e);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
