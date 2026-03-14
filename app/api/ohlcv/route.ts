import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const cache = new Map<string, { data: Bar[]; fetchedAt: number }>();
const CACHE_TTL = 5 * 60_000; // 5 minutes

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  const interval = searchParams.get("interval") ?? "1d";
  const range = searchParams.get("range") ?? "3mo";
  const period2Param = searchParams.get("period2"); // unix seconds — cap data at this time

  if (!symbol) return NextResponse.json([]);

  const RANGE_MS: Record<string, number> = {
    "1d": 86400_000, "2d": 2 * 86400_000, "5d": 5 * 86400_000,
    "14d": 14 * 86400_000, "1mo": 30 * 86400_000, "3mo": 90 * 86400_000, "1y": 365 * 86400_000,
  };

  const usePeriod = !!period2Param;
  const period2 = usePeriod ? Number(period2Param) : 0;
  const rangeDuration = RANGE_MS[range] ?? 90 * 86400_000;
  const period1 = usePeriod ? Math.floor((period2 * 1000 - rangeDuration) / 1000) : 0;

  const key = usePeriod
    ? `${symbol}:${interval}:${period1}:${period2}`
    : `${symbol}:${interval}:${range}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = usePeriod
      ? `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`
      : `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return NextResponse.json([]);

    const json = await res.json() as {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: {
            quote: Array<{
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json([]);

    const { timestamp, indicators } = result;
    const [quote] = indicators.quote;

    const seen = new Set<number>();
    const bars: Bar[] = [];
    for (let i = 0; i < timestamp.length; i++) {
      const t = timestamp[i];
      const o = quote.open[i], h = quote.high[i], l = quote.low[i], c = quote.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      bars.push({ time: t, open: o, high: h, low: l, close: c });
    }
    bars.sort((a, b) => a.time - b.time);

    cache.set(key, { data: bars, fetchedAt: Date.now() });
    return NextResponse.json(bars);
  } catch {
    return NextResponse.json([]);
  }
}
