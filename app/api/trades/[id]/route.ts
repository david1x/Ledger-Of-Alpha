import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(id);
    if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(trade);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();

    const existing = db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = { ...existing, ...body };

    // Recalculate P&L if closed
    let pnl = merged.pnl;
    if (merged.status === "closed" && merged.entry_price && merged.exit_price && merged.shares) {
      const multiplier = merged.direction === "long" ? 1 : -1;
      pnl = (merged.exit_price - merged.entry_price) * merged.shares * multiplier;
    }

    db.prepare(`
      UPDATE trades SET
        symbol = ?, direction = ?, status = ?,
        entry_price = ?, stop_loss = ?, take_profit = ?,
        exit_price = ?, shares = ?, entry_date = ?, exit_date = ?,
        pnl = ?, notes = ?, tags = ?
      WHERE id = ?
    `).run(
      String(merged.symbol).toUpperCase(), merged.direction, merged.status,
      merged.entry_price ?? null, merged.stop_loss ?? null, merged.take_profit ?? null,
      merged.exit_price ?? null, merged.shares ?? null, merged.entry_date ?? null,
      merged.exit_date ?? null, pnl ?? null, merged.notes ?? null, merged.tags ?? null,
      id,
    );

    const updated = db.prepare("SELECT * FROM trades WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = db.prepare("DELETE FROM trades WHERE id = ?").run(id);
    if (result.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
