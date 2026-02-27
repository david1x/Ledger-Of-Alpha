import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, signJwt } from "@/lib/auth";

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Promote the current user to admin — only works when no admins exist yet. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const adminCount = (db.prepare("SELECT COUNT(*) as n FROM users WHERE is_admin = 1").get() as { n: number }).n;
  if (adminCount > 0) {
    return NextResponse.json({ error: "An admin already exists." }, { status: 403 });
  }

  db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(user.id);

  // Re-issue session JWT with isAdmin: true so the middleware lets them in immediately
  const session = await signJwt({
    sub: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorDone: user.twoFactorDone,
    isAdmin: true,
  }, "7d");

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", session, cookieOpts(7 * 24 * 60 * 60));
  return res;
}

/** Returns whether any admin exists (used to show/hide the Claim button). */
export async function GET() {
  const db = getDb();
  const adminCount = (db.prepare("SELECT COUNT(*) as n FROM users WHERE is_admin = 1").get() as { n: number }).n;
  return NextResponse.json({ hasAdmin: adminCount > 0 });
}
