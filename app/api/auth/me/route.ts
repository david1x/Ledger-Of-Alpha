import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ guest: true, name: "Guest", email: null });
  }
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const adminCount = (db.prepare("SELECT COUNT(*) as n FROM users WHERE is_admin = 1").get() as { n: number }).n;

  return NextResponse.json({ ...user, isAdmin: user.isAdmin ?? false, hasAdmin: adminCount > 0 });
}
