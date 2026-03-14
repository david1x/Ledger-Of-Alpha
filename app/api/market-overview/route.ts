import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

let cache: { data: IndexData[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const INDICES = [
  { symbol: "%5EGSPC", name: "S&P 500" },
  { symbol: "%5EIXIC", name: "NASDAQ" },
  { symbol: "%5EDJI", name: "DOW" },
];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const results: IndexData[] = [];

    for (const idx of INDICES) {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${idx.symbol}?range=1d&interval=1d`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!r.ok) continue;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) continue;

        const price = Math.round(meta.regularMarketPrice * 100) / 100;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = Math.round((price - prevClose) * 100) / 100;
        const changePercent = prevClose > 0
          ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
          : 0;

        results.push({
          symbol: idx.symbol.replace(/%5E/g, ""),
          name: idx.name,
          price,
          change,
          changePercent,
        });
      } catch {
        // skip failed index
      }
    }

    if (results.length === 0) throw new Error("No data fetched");

    cache = { data: results, fetchedAt: now };
    return NextResponse.json(results);
  } catch {
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 502 }
    );
  }
}
