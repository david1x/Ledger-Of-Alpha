import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot send Discord snapshots." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();

    // Get user's webhook, falling back to _system default
    const row = db.prepare(`
      SELECT COALESCE(u.value, s.value) AS value
      FROM settings s
      LEFT JOIN settings u ON u.key = s.key AND u.user_id = ?
      WHERE s.user_id = '_system' AND s.key = 'discord_webhook'
    `).get(user.id, ) as { value: string } | undefined;

    const webhook = row?.value ?? "";
    if (!webhook) {
      return NextResponse.json({ error: "Discord webhook not configured. Go to Settings." }, { status: 400 });
    }

    const body = await req.json() as { imageData?: string; snapshotUrl?: string; message?: string };

    let res: Response;

    if (body.snapshotUrl) {
      // Send TradingView snapshot link — Discord auto-embeds the chart image
      const content = body.message
        ? `${body.message}\n${body.snapshotUrl}`
        : body.snapshotUrl;
      res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, username: "Ledger Of Alpha" }),
      });
    } else if (body.imageData) {
      // Send screen-captured image as file upload
      const base64 = body.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const formData = new FormData();
      formData.append("file", new Blob([buffer], { type: "image/png" }), `snapshot-${Date.now()}.png`);
      formData.append("payload_json", JSON.stringify({
        content: body.message || "📊 Ledger Of Alpha — Chart Snapshot",
        username: "Ledger Of Alpha",
      }));
      res = await fetch(webhook, { method: "POST", body: formData });
    } else {
      return NextResponse.json({ error: "No image or URL provided." }, { status: 400 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Discord error: ${await res.text()}` }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
