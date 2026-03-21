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
    const mistakes = db
      .prepare("SELECT * FROM mistake_types WHERE user_id = ? ORDER BY created_at ASC")
      .all(user.id);
    return NextResponse.json(mistakes);
  } catch (e) {
    console.error("mistakes API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot create mistake types." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const body = await req.json();
    const { name, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const resolvedColor = color ?? "#ef4444";

    db.prepare(
      "INSERT INTO mistake_types (id, user_id, name, color) VALUES (?, ?, ?, ?)"
    ).run(id, user.id, name.trim(), resolvedColor);

    const created = db.prepare("SELECT * FROM mistake_types WHERE id = ?").get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json(
        { error: "A mistake type with this name already exists." },
        { status: 409 }
      );
    }
    console.error("mistakes API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
