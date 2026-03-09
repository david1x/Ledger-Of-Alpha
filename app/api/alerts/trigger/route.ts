import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { Alert } from "@/lib/types";

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot trigger alerts." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { triggered } = await req.json();
    if (!Array.isArray(triggered) || triggered.length === 0) {
      return NextResponse.json({ error: "triggered array required" }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const updated: Alert[] = [];

    // Get user's alert-specific webhook, falling back to general discord webhook
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
    const webhook = getWebhook("alert_discord_webhook") || getWebhook("discord_webhook");

    for (const alertId of triggered) {
      const alert = db.prepare(
        "SELECT * FROM alerts WHERE id = ? AND user_id = ? AND active = 1"
      ).get(alertId, user.id) as Alert | undefined;

      if (!alert) continue;

      // Update triggered_at, deactivate if one-shot
      if (alert.repeating) {
        db.prepare("UPDATE alerts SET triggered_at = ? WHERE id = ?").run(now, alert.id);
      } else {
        db.prepare("UPDATE alerts SET triggered_at = ?, active = 0 WHERE id = ?").run(now, alert.id);
      }

      const updatedAlert = db.prepare("SELECT * FROM alerts WHERE id = ?").get(alert.id) as Alert;
      updated.push(updatedAlert);

      // Post to Discord if webhook configured
      if (webhook) {
        let headline: string;
        if (alert.condition === "percent_up") {
          headline = `**Price Alert** — **${alert.symbol}** moved up ${alert.percent_value}% (from $${alert.anchor_price} to $${alert.target_price})`;
        } else if (alert.condition === "percent_down") {
          headline = `**Price Alert** — **${alert.symbol}** moved down ${alert.percent_value}% (from $${alert.anchor_price} to $${alert.target_price})`;
        } else if (alert.condition === "percent_move") {
          headline = `**Price Alert** — **${alert.symbol}** moved \u00B1${alert.percent_value}% from $${alert.anchor_price}`;
        } else {
          const condLabel = alert.condition === "above" ? "above" : alert.condition === "below" ? "below" : "crossed";
          headline = `**Price Alert** — **${alert.symbol}** is ${condLabel} $${alert.target_price}`;
        }
        const content = [
          headline,
          alert.note ? `> ${alert.note}` : "",
          alert.repeating ? "_Repeating alert_" : "_One-shot alert (now inactive)_",
        ].filter(Boolean).join("\n");

        try {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
        } catch {
          // Discord post failure is non-fatal
        }
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("alerts trigger error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
