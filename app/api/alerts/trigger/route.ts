import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { Alert } from "@/lib/types";
import { sendAlertNotifications } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/request-url";

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

      // Centralized notification logic (Email + Discord)
      const baseUrl = getBaseUrl(req);
      await sendAlertNotifications(updatedAlert, baseUrl);
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("alerts trigger error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
