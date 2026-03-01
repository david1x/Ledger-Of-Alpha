import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_TRADES } from "@/lib/demo-data";
import { validateTradeFields } from "@/lib/validate-trade";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    const { searchParams } = new URL(req.url);
    let trades = [...DEMO_TRADES];
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const symbol = searchParams.get("symbol");
    if (status)    trades = trades.filter(t => t.status === status);
    if (direction) trades = trades.filter(t => t.direction === direction);
    if (symbol)    trades = trades.filter(t => t.symbol.includes(symbol.toUpperCase()));
    return NextResponse.json(trades);
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const symbol = searchParams.get("symbol");

    let query = "SELECT * FROM trades WHERE user_id = ?";
    const params: unknown[] = [user.id];

    if (status)    { query += " AND status = ?";   params.push(status); }
    if (direction) { query += " AND direction = ?"; params.push(direction); }
    if (symbol)    { query += " AND symbol LIKE ?"; params.push(`%${symbol.toUpperCase()}%`); }

    query += " ORDER BY created_at DESC";

    return NextResponse.json(db.prepare(query).all(...params));
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    const result = db.prepare(
      `DELETE FROM trades WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, user.id);

    return NextResponse.json({ deleted: result.changes });
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot save trades. Please create an account." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const body = await req.json();

    const validationError = validateTradeFields(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const {
      symbol, direction, status = "planned",
      entry_price, stop_loss, take_profit,
      exit_price, shares, entry_date, exit_date,
      notes, tags, account_size, commission, risk_per_trade,
    } = body;

    let pnl: number | null = null;
    if (status === "closed" && entry_price && exit_price && shares) {
      const multiplier = direction === "long" ? 1 : -1;
      const gross = (exit_price - entry_price) * shares * multiplier;
      const comm = commission ?? 0;
      pnl = gross - (comm * 2);
    }

    const result = db.prepare(`
      INSERT INTO trades (symbol, direction, status, entry_price, stop_loss, take_profit,
        exit_price, shares, entry_date, exit_date, pnl, notes, tags, user_id, account_size, commission, risk_per_trade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      symbol?.toUpperCase(), direction, status,
      entry_price ?? null, stop_loss ?? null, take_profit ?? null,
      exit_price ?? null, shares ?? null, entry_date ?? null, exit_date ?? null,
      pnl, notes ?? null, tags ?? null, user.id,
      account_size ?? null, commission ?? null, risk_per_trade ?? null,
    );

    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(trade, { status: 201 });
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
