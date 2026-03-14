import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

let cache: { value: number; label: string; timestamp: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      value: cache.value,
      label: cache.label,
      timestamp: cache.timestamp,
    });
  }

  try {
    const res = await fetch(
      "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.cnn.com/markets/fear-and-greed",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) throw new Error(`CNN API returned ${res.status}`);

    const data = await res.json();
    const score = data?.fear_and_greed?.score;
    const rating = data?.fear_and_greed?.rating;
    const ts = data?.fear_and_greed?.timestamp;

    if (score == null) throw new Error("No score in response");

    const value = Math.round(score);
    const label =
      rating?.replace(/_/g, " ")?.replace(/\b\w/g, (c: string) => c.toUpperCase()) ??
      getLabel(value);

    cache = { value, label, timestamp: ts ?? now, fetchedAt: now };

    return NextResponse.json({ value, label, timestamp: cache.timestamp });
  } catch (err) {
    // Return stale cache if available
    if (cache) {
      return NextResponse.json({
        value: cache.value,
        label: cache.label,
        timestamp: cache.timestamp,
        stale: true,
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch Fear & Greed data" },
      { status: 502 }
    );
  }
}

function getLabel(value: number): string {
  if (value <= 25) return "Extreme Fear";
  if (value <= 45) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  return "Extreme Greed";
}
