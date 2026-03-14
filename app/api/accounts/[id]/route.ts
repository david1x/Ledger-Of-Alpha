import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(id, user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot edit accounts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();

    const existing = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { name, starting_balance, risk_per_trade, commission_value } = body;

    if (name !== undefined && (typeof name !== "string" || name.length === 0 || name.length > 100)) {
      return NextResponse.json({ error: "Name must be 1-100 characters." }, { status: 400 });
    }

    const merged = { ...(existing as Record<string, unknown>), ...body };

    db.prepare(
      "UPDATE accounts SET name = ?, starting_balance = ?, risk_per_trade = ?, commission_value = ? WHERE id = ? AND user_id = ?"
    ).run(
      merged.name, merged.starting_balance, merged.risk_per_trade, merged.commission_value,
      id, user.id,
    );

    const updated = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (e) {
    console.error("accounts/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete accounts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const existing = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cannot delete last account
    const count = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE user_id = ?").get(user.id) as { count: number };
    if (count.count <= 1) {
      return NextResponse.json({ error: "Cannot delete your only account." }, { status: 400 });
    }

    // Delete trades belonging to this account
    db.prepare("DELETE FROM trades WHERE account_id = ? AND user_id = ?").run(id, user.id);
    db.prepare("DELETE FROM accounts WHERE id = ? AND user_id = ?").run(id, user.id);

    // If deleted account was default, make another one default
    const anyDefault = db.prepare("SELECT id FROM accounts WHERE user_id = ? AND is_default = 1").get(user.id);
    if (!anyDefault) {
      const next = db.prepare("SELECT id FROM accounts WHERE user_id = ? ORDER BY created_at ASC").get(user.id) as { id: string } | undefined;
      if (next) db.prepare("UPDATE accounts SET is_default = 1 WHERE id = ?").run(next.id);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("accounts/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
