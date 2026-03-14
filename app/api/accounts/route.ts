import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "@/lib/demo-data";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json(DEMO_ACCOUNTS);
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const accounts = db.prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY is_default DESC, created_at ASC").all(user.id);
    return NextResponse.json(accounts);
  } catch (e) {
    console.error("accounts API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot create accounts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const body = await req.json();
    const { name, starting_balance = 10000, risk_per_trade = 1, commission_value = 0 } = body;

    if (!name || typeof name !== "string" || name.length === 0 || name.length > 100) {
      return NextResponse.json({ error: "Name must be 1-100 characters." }, { status: 400 });
    }

    if (typeof starting_balance !== "number" || starting_balance < 0) {
      return NextResponse.json({ error: "Starting balance must be a positive number." }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // Check if user has any accounts — if not, make this the default
    const existing = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE user_id = ?").get(user.id) as { count: number };
    const isDefault = existing.count === 0 ? 1 : 0;

    db.prepare(
      "INSERT INTO accounts (id, user_id, name, starting_balance, risk_per_trade, commission_value, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, name.trim(), starting_balance, risk_per_trade, commission_value, isDefault);

    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    return NextResponse.json(account, { status: 201 });
  } catch (e) {
    console.error("accounts API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
