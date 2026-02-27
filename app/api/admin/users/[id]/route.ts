import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { is_admin } = await req.json();

  if (id === admin.id && !is_admin) {
    return NextResponse.json({ error: "You cannot remove your own admin privileges." }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(is_admin ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account from here." }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
