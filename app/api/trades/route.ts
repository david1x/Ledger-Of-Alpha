import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const symbol = searchParams.get("symbol");

    let query = "SELECT * FROM trades WHERE 1=1";
    const params: unknown[] = [];

    if (status) { query += " AND status = ?"; params.push(status); }
    if (direction) { query += " AND direction = ?"; params.push(direction); }
    if (symbol) { query += " AND symbol LIKE ?"; params.push(`%${symbol}%`); }

    query += " ORDER BY created_at DESC";

    const trades = db.prepare(query).all(...params);
    return NextResponse.json(trades);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const {
      symbol, direction, status = "planned",
      entry_price, stop_loss, take_profit,
      exit_price, shares, entry_date, exit_date,
      notes, tags,
    } = body;

    // Auto-calculate P&L if closed
    let pnl: number | null = null;
    if (status === "closed" && entry_price && exit_price && shares) {
      const multiplier = direction === "long" ? 1 : -1;
      pnl = (exit_price - entry_price) * shares * multiplier;
    }

    const result = db.prepare(`
      INSERT INTO trades (symbol, direction, status, entry_price, stop_loss, take_profit,
        exit_price, shares, entry_date, exit_date, pnl, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      symbol?.toUpperCase(), direction, status,
      entry_price ?? null, stop_loss ?? null, take_profit ?? null,
      exit_price ?? null, shares ?? null, entry_date ?? null, exit_date ?? null,
      pnl, notes ?? null, tags ?? null,
    );

    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(trade, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
