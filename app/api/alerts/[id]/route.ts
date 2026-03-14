import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot update alerts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM alerts WHERE id = ? AND user_id = ?").get(
      Number(id), user.id
    ) as Record<string, unknown> | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.active !== undefined) {
      updates.push("active = ?");
      values.push(body.active ? 1 : 0);
    }
    if (body.target_price !== undefined) {
      updates.push("target_price = ?");
      values.push(body.target_price);
    }
    if (body.note !== undefined) {
      updates.push("note = ?");
      values.push(body.note || null);
    }
    if (body.triggered_at !== undefined) {
      updates.push("triggered_at = ?");
      values.push(body.triggered_at);
    }
    if (body.notify_email !== undefined) {
      updates.push("notify_email = ?");
      values.push(body.notify_email ? 1 : 0);
    }
    if (body.notify_discord !== undefined) {
      updates.push("notify_discord = ?");
      values.push(body.notify_discord ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    db.prepare(`UPDATE alerts SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).run(
      ...values, Number(id), user.id
    );

    const updated = db.prepare("SELECT * FROM alerts WHERE id = ?").get(Number(id));
    return NextResponse.json(updated);
  } catch (e) {
    console.error("alerts PATCH error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete alerts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?").run(
      Number(id), user.id
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("alerts DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
