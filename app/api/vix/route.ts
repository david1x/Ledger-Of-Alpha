import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

let cache: { value: number; change: number; changePercent: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      value: cache.value,
      change: cache.change,
      changePercent: cache.changePercent,
    });
  }

  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=1d",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) throw new Error(`Yahoo API returned ${res.status}`);

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error("No VIX data");

    const value = Math.round(meta.regularMarketPrice * 100) / 100;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? value;
    const change = Math.round((value - prevClose) * 100) / 100;
    const changePercent = prevClose > 0
      ? Math.round(((value - prevClose) / prevClose) * 10000) / 100
      : 0;

    cache = { value, change, changePercent, fetchedAt: now };

    return NextResponse.json({ value, change, changePercent });
  } catch {
    if (cache) {
      return NextResponse.json({
        value: cache.value,
        change: cache.change,
        changePercent: cache.changePercent,
        stale: true,
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch VIX data" },
      { status: 502 }
    );
  }
}
