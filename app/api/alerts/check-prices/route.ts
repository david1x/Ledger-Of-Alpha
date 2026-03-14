import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Alert } from "@/lib/types";
import { sendAlertNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Optional: check for a secret token to prevent abuse
  const authHeader = req.headers.get("Authorization");
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    // If we're in development, allow without secret if not set
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = getDb();
    const activeAlerts = db.prepare("SELECT * FROM alerts WHERE active = 1").all() as Alert[];
    if (activeAlerts.length === 0) return NextResponse.json({ checked: 0, triggered: 0 });

    const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
    const prices = await fetchPrices(symbols);

    let triggeredCount = 0;
    const now = new Date().toISOString();

    for (const alert of activeAlerts) {
      const currentPrice = prices[alert.symbol];
      if (typeof currentPrice !== "number") continue;

      let isTriggered = false;
      switch (alert.condition) {
        case "above":
          isTriggered = currentPrice >= alert.target_price;
          break;
        case "below":
          isTriggered = currentPrice <= alert.target_price;
          break;
        case "crosses":
          // For simplicity, treat crosses as "reached"
          // A better way would be to store last_price, but for now we check if it's within 0.1% or past it
          isTriggered = Math.abs(currentPrice - alert.target_price) / alert.target_price <= 0.001;
          break;
        case "percent_up":
          isTriggered = currentPrice >= alert.anchor_price! * (1 + alert.percent_value! / 100);
          break;
        case "percent_down":
          isTriggered = currentPrice <= alert.anchor_price! * (1 - alert.percent_value! / 100);
          break;
        case "percent_move":
          const diff = Math.abs(currentPrice - alert.anchor_price!) / alert.anchor_price!;
          isTriggered = diff >= alert.percent_value! / 100;
          break;
      }

      if (isTriggered) {
        triggeredCount++;
        // Update DB
        if (alert.repeating) {
          db.prepare("UPDATE alerts SET triggered_at = ? WHERE id = ?").run(now, alert.id);
        } else {
          db.prepare("UPDATE alerts SET triggered_at = ?, active = 0 WHERE id = ?").run(now, alert.id);
        }

        // Send notifications
        await sendAlertNotifications(alert);
      }
    }

    return NextResponse.json({ checked: activeAlerts.length, triggered: triggeredCount });
  } catch (err) {
    console.error("Alert check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  // Batch in chunks if many
  const CHUNK_SIZE = 10;
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(chunk.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (res.ok) {
          const json = await res.json() as any;
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (typeof price === "number") {
            result[sym] = price;
          }
        }
      } catch {}
    }));
  }
  
  return result;
}
