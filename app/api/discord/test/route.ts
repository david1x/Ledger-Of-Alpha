import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot test webhooks." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { webhook } = await req.json();

    if (!webhook || typeof webhook !== "string" || !webhook.startsWith("https://discord.com/api/webhooks/")) {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Ledger Of Alpha — Webhook test successful!",
        username: "Ledger Of Alpha",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Discord test webhook error:", text);
      return NextResponse.json({ error: "Webhook request failed. Check the URL." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("discord test error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
