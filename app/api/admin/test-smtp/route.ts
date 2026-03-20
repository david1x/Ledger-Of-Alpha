import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const get = (key: string): string =>
    (
      db
        .prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = ?")
        .get(key) as { value: string } | undefined
    )?.value ?? "";

  const host = get("smtp_host");
  const user = get("smtp_user");
  const pass = get("smtp_pass");

  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "SMTP not configured" });
  }

  const port = parseInt(get("smtp_port") || "587", 10);
  const secure = get("smtp_secure") === "true";

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transport.verify();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message });
  }
}
