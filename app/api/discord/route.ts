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

    // Get user's webhook, falling back to alert webhook then _system default
    const getWebhook = (key: string) => {
      const r = db.prepare(`
        SELECT value FROM settings
        WHERE user_id = ? AND key = ?
        UNION ALL
        SELECT value FROM settings
        WHERE user_id = '_system' AND key = ?
        LIMIT 1
      `).get(user.id, key, key) as { value: string } | undefined;
      return r?.value ?? "";
    };
    const webhook = getWebhook("discord_webhook") || getWebhook("alert_discord_webhook");
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
      console.error("Discord webhook error:", await res.text());
      return NextResponse.json({ error: "Discord webhook request failed." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("discord API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
