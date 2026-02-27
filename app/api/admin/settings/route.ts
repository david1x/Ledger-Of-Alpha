import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const SYSTEM_KEYS = [
  "account_size",
  "risk_per_trade",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "app_url",
];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM settings WHERE user_id = '_system'"
  ).all() as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  for (const { key, value } of rows) settings[key] = value;

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const db = getDb();

  const upsert = db.prepare(
    "INSERT INTO settings (user_id, key, value) VALUES ('_system', ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value"
  );

  for (const key of SYSTEM_KEYS) {
    if (key in body) {
      upsert.run(key, String(body[key] ?? ""));
    }
  }

  return NextResponse.json({ ok: true });
}
