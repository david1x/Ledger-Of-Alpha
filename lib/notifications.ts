import { getDb } from "./db";
import { Alert, User } from "./types";
import { sendAlertEmail } from "./email";

export async function sendAlertNotifications(alert: Alert, baseUrl?: string) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(alert.user_id) as User | undefined;
  if (!user) return;

  const headline = getAlertHeadline(alert);

  // 1. Email Notification
  if (alert.notify_email && user.email) {
    try {
      await sendAlertEmail(user.email, user.name, headline, alert.note, baseUrl);
    } catch (err) {
      console.error("Failed to send alert email:", err);
    }
  }

  // 2. Discord Notification
  if (alert.notify_discord) {
    const webhook = getWebhook(db, user.id, "alert_discord_webhook") || getWebhook(db, user.id, "discord_webhook");
    if (webhook) {
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
      } catch (err) {
        console.error("Failed to post to Discord:", err);
      }
    }
  }
}

function getAlertHeadline(alert: Alert): string {
  if (alert.condition === "percent_up") {
    return `**Price Alert** — **${alert.symbol}** moved up ${alert.percent_value}% (from $${alert.anchor_price} to $${alert.target_price})`;
  } else if (alert.condition === "percent_down") {
    return `**Price Alert** — **${alert.symbol}** moved down ${alert.percent_value}% (from $${alert.anchor_price} to $${alert.target_price})`;
  } else if (alert.condition === "percent_move") {
    return `**Price Alert** — **${alert.symbol}** moved \u00B1${alert.percent_value}% from $${alert.anchor_price}`;
  } else {
    const condLabel = alert.condition === "above" ? "above" : alert.condition === "below" ? "below" : "crossed";
    return `**Price Alert** — **${alert.symbol}** is ${condLabel} $${alert.target_price}`;
  }
}

function getWebhook(db: any, userId: string, key: string): string {
  const r = db.prepare(`
    SELECT value FROM settings
    WHERE user_id = ? AND key = ?
    UNION ALL
    SELECT value FROM settings
    WHERE user_id = '_system' AND key = ?
    LIMIT 1
  `).get(userId, key, key) as { value: string } | undefined;
  return r?.value ?? "";
}
