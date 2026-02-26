import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json() as Record<string, string>;

    const upsert = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );

    const updateMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });

    updateMany(Object.entries(body));

    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
