import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_SETTINGS } from "@/lib/demo-data";

function getUserSettings(db: ReturnType<typeof getDb>, userId: string) {
  // Prefer user-specific values; fall back to _system defaults
  const rows = db.prepare(`
    SELECT COALESCE(u.key, s.key) AS key,
           COALESCE(u.value, s.value) AS value
    FROM settings s
    LEFT JOIN settings u ON u.key = s.key AND u.user_id = ?
    WHERE s.user_id = '_system'
    UNION
    SELECT u.key, u.value
    FROM settings u
    WHERE u.user_id = ?
      AND u.key NOT IN (SELECT key FROM settings WHERE user_id = '_system')
  `).all(userId, userId) as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function GET(req: NextRequest) {
  if (isGuest(req)) return NextResponse.json(DEMO_SETTINGS);

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    return NextResponse.json(getUserSettings(db, user.id));
  } catch (e) {
    console.error("settings API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot change settings." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const body = await req.json() as Record<string, string>;

    const upsert = db.prepare(`
      INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
    `);
    const updateMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(user.id, key, String(value));
      }
    });
    updateMany(Object.entries(body));

    return NextResponse.json(getUserSettings(db, user.id));
  } catch (e) {
    console.error("settings API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
