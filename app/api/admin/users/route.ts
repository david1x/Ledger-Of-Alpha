import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const users = db.prepare(`
    SELECT id, email, name, email_verified, two_factor_enabled, is_admin, created_at
    FROM users ORDER BY created_at ASC
  `).all();

  return NextResponse.json({ users });
}
