import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_TRADES } from "@/lib/demo-data";
import { validateTradeFields, pickTradeFields } from "@/lib/validate-trade";

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
    console.error("trades/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const rawBody = await req.json();

    // Only allow known trade fields — prevents mass assignment
    const safeBody = pickTradeFields(rawBody);

    const validationError = validateTradeFields(safeBody);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = db
      .prepare("SELECT * FROM trades WHERE id = ? AND user_id = ?")
      .get(id, user.id) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = { ...existing, ...safeBody };

    let pnl = merged.pnl;
    if (merged.status === "closed" && merged.entry_price && merged.exit_price && merged.shares) {
      const multiplier = merged.direction === "long" ? 1 : -1;
      const gross = (merged.exit_price as number - (merged.entry_price as number)) * (merged.shares as number) * multiplier;
      const comm = (merged.commission as number) ?? 0;
      pnl = gross - (comm * 2);
    }

    db.prepare(`
      UPDATE trades SET
        symbol = ?, direction = ?, status = ?,
        entry_price = ?, stop_loss = ?, take_profit = ?,
        exit_price = ?, shares = ?, entry_date = ?, exit_date = ?,
        pnl = ?, notes = ?, tags = ?, account_size = ?, commission = ?, risk_per_trade = ?
      WHERE id = ? AND user_id = ?
    `).run(
      String(merged.symbol).toUpperCase(), merged.direction, merged.status,
      merged.entry_price ?? null, merged.stop_loss ?? null, merged.take_profit ?? null,
      merged.exit_price ?? null, merged.shares ?? null, merged.entry_date ?? null,
      merged.exit_date ?? null, pnl ?? null, merged.notes ?? null, merged.tags ?? null,
      merged.account_size ?? null, merged.commission ?? null, merged.risk_per_trade ?? null,
      id, user.id,
    );

    return NextResponse.json(db.prepare("SELECT * FROM trades WHERE id = ?").get(id));
  } catch (e) {
    console.error("trades/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    console.error("trades/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
