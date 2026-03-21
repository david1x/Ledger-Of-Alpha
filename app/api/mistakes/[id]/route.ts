import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot edit mistake types." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();

    const existing = db
      .prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?")
      .get(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { name, color } = body;

    if (name !== undefined) {
      const trimmed = name?.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      }
      db.prepare("UPDATE mistake_types SET name = ? WHERE id = ? AND user_id = ?").run(
        trimmed,
        id,
        user.id
      );
    }

    if (color !== undefined) {
      db.prepare("UPDATE mistake_types SET color = ? WHERE id = ? AND user_id = ?").run(
        color,
        id,
        user.id
      );
    }

    const updated = db.prepare("SELECT * FROM mistake_types WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json(
        { error: "A mistake type with this name already exists." },
        { status: 409 }
      );
    }
    console.error("mistakes/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete mistake types." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const existing = db
      .prepare("SELECT id FROM mistake_types WHERE id = ? AND user_id = ?")
      .get(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // FK cascade handles trade_mistake_tags cleanup automatically
    db.prepare("DELETE FROM mistake_types WHERE id = ?").run(id);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("mistakes/[id] API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
