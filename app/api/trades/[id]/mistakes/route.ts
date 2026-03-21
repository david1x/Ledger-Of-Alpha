import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot tag trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: tradeId } = await params;
    const { mistake_id } = await req.json();

    if (!mistake_id) {
      return NextResponse.json({ error: "mistake_id is required" }, { status: 400 });
    }

    const db = getDb();

    // Verify trade ownership
    const trade = db.prepare("SELECT id FROM trades WHERE id = ? AND user_id = ?").get(Number(tradeId), user.id);
    if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    // Verify mistake type ownership
    const mistakeType = db.prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?").get(mistake_id, user.id);
    if (!mistakeType) return NextResponse.json({ error: "Mistake type not found" }, { status: 404 });

    // Insert — OR IGNORE handles duplicate tags gracefully
    db.prepare("INSERT OR IGNORE INTO trade_mistake_tags (trade_id, mistake_id) VALUES (?, ?)").run(Number(tradeId), mistake_id);

    return NextResponse.json({ tagged: true }, { status: 201 });
  } catch (e) {
    console.error("trades/[id]/mistakes POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot tag trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: tradeId } = await params;
    const { mistake_id } = await req.json();

    if (!mistake_id) {
      return NextResponse.json({ error: "mistake_id is required" }, { status: 400 });
    }

    const db = getDb();

    // Verify trade ownership
    const trade = db.prepare("SELECT id FROM trades WHERE id = ? AND user_id = ?").get(Number(tradeId), user.id);
    if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    db.prepare("DELETE FROM trade_mistake_tags WHERE trade_id = ? AND mistake_id = ?").run(Number(tradeId), mistake_id);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("trades/[id]/mistakes DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
