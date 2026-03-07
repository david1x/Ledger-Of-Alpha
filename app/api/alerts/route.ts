import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json([]);
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM alerts WHERE user_id = ? ORDER BY active DESC, created_at DESC"
    ).all(user.id);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("alerts GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot create alerts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { symbol, condition, target_price, repeating, note } = body;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }
    if (!["above", "below", "crosses"].includes(condition)) {
      return NextResponse.json({ error: "condition must be above, below, or crosses" }, { status: 400 });
    }
    if (typeof target_price !== "number" || target_price <= 0) {
      return NextResponse.json({ error: "target_price must be a positive number" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO alerts (user_id, symbol, condition, target_price, repeating, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      symbol.toUpperCase(),
      condition,
      target_price,
      repeating ? 1 : 0,
      note || null
    );

    const alert = db.prepare("SELECT * FROM alerts WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(alert, { status: 201 });
  } catch (e) {
    console.error("alerts POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
