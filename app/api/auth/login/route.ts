import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, signJwt, DUMMY_HASH } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes per IP
  const limited = rateLimit(req, "login", 5, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase()) as User | undefined;

    // Always run bcrypt to prevent timing-based email enumeration
    const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !passwordValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json(
        { error: "Please verify your email before signing in." },
        { status: 403 }
      );
    }

    const basePayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      emailVerified: true,
      twoFactorEnabled: !!user.two_factor_enabled,
      twoFactorDone: false,
      isAdmin: !!user.is_admin,
    };

    if (user.two_factor_enabled) {
      // Issue a short-lived pending token; frontend redirects to /verify-2fa
      const pending = await signJwt(basePayload, "5m");
      const res = NextResponse.json({ requires2fa: true });
      res.cookies.set("pending_2fa", pending, cookieOpts(5 * 60));
      res.cookies.set("guest", "", cookieOpts(0));
      return res;
    }

    // No 2FA — issue full session
    const session = await signJwt({ ...basePayload, twoFactorDone: true }, "7d");
    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", session, cookieOpts(7 * 24 * 60 * 60));
    res.cookies.set("guest", "", cookieOpts(0));
    return res;
  } catch (e) {
    console.error("login error:", e);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
