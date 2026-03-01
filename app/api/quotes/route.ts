import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

const quoteCache = new Map<string, { price: number; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const symbolsParam = (searchParams.get("symbols") || "").trim().toUpperCase();
  if (!symbolsParam) return NextResponse.json({});

  const symbols = symbolsParam.split(",").filter(Boolean);
  if (!symbols.length) return NextResponse.json({});

  const now = Date.now();
  const stale = symbols.filter(s => {
    const cached = quoteCache.get(s);
    return !cached || now - cached.fetchedAt > CACHE_TTL_MS;
  });

  if (stale.length > 0) {
    await Promise.allSettled(stale.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (res.ok) {
          const json = await res.json() as {
            chart: { result: Array<{ meta: { regularMarketPrice: number } }> };
          };
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (typeof price === "number") {
            quoteCache.set(sym, { price, fetchedAt: now });
          }
        }
      } catch { /* ignore per-symbol errors */ }
    }));
  }

  const result: Record<string, number> = {};
  for (const sym of symbols) {
    const cached = quoteCache.get(sym);
    if (cached) result[sym] = cached.price;
  }
  return NextResponse.json(result);
}
