import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const settings = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

    if (!s.discord_webhook) {
      return NextResponse.json({ error: "Discord webhook not configured. Go to Settings." }, { status: 400 });
    }

    const body = await req.json() as { imageData: string; message?: string };
    const { imageData, message } = body;

    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: "image/png" }), `snapshot-${Date.now()}.png`);
    formData.append(
      "payload_json",
      JSON.stringify({
        content: message || "📊 Ledger Of Alpha — Chart Snapshot",
        username: "Ledger Of Alpha",
      }),
    );

    const res = await fetch(s.discord_webhook, { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Discord error: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
