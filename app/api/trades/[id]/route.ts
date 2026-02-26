import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_TRADES } from "@/lib/demo-data";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isGuest(req)) {
    const trade = DEMO_TRADES.find(t => t.id === Number(id));
    if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(trade);
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const trade = db.prepare("SELECT * FROM trades WHERE id = ? AND user_id = ?").get(id, user.id);
    if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(trade);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot edit trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();

    const existing = db
      .prepare("SELECT * FROM trades WHERE id = ? AND user_id = ?")
      .get(id, user.id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = { ...existing, ...body };

    let pnl = merged.pnl;
    if (merged.status === "closed" && merged.entry_price && merged.exit_price && merged.shares) {
      const multiplier = merged.direction === "long" ? 1 : -1;
      pnl = (merged.exit_price as number - merged.entry_price as number) * (merged.shares as number) * multiplier;
    }

    db.prepare(`
      UPDATE trades SET
        symbol = ?, direction = ?, status = ?,
        entry_price = ?, stop_loss = ?, take_profit = ?,
        exit_price = ?, shares = ?, entry_date = ?, exit_date = ?,
        pnl = ?, notes = ?, tags = ?
      WHERE id = ? AND user_id = ?
    `).run(
      String(merged.symbol).toUpperCase(), merged.direction, merged.status,
      merged.entry_price ?? null, merged.stop_loss ?? null, merged.take_profit ?? null,
      merged.exit_price ?? null, merged.shares ?? null, merged.entry_date ?? null,
      merged.exit_date ?? null, pnl ?? null, merged.notes ?? null, merged.tags ?? null,
      id, user.id,
    );

    return NextResponse.json(db.prepare("SELECT * FROM trades WHERE id = ?").get(id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();
    const result = db.prepare("DELETE FROM trades WHERE id = ? AND user_id = ?").run(id, user.id);
    if (result.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
