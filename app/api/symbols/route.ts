import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { STATIC_SYMBOLS } from "@/lib/symbols-static";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toUpperCase();
    const refresh = searchParams.get("refresh") === "1";

    const settings = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
    const apiKey = s.fmp_api_key || "";

    // Seed the static list if the DB is empty or refresh is requested
    const count = (db.prepare("SELECT COUNT(*) as c FROM symbols").get() as { c: number }).c;
    if (count === 0 || refresh) {
      const insert = db.prepare(
        "INSERT OR REPLACE INTO symbols (symbol, name, market_cap, updated_at) VALUES (?, ?, ?, datetime('now'))"
      );
      const insertMany = db.transaction(() => {
        for (const sym of STATIC_SYMBOLS) {
          insert.run(sym.symbol, sym.name, sym.market_cap);
        }
      });
      insertMany();
    }

    // If no query, return top symbols by market cap from local db
    if (!q) {
      const symbols = db
        .prepare("SELECT symbol, name, market_cap FROM symbols ORDER BY market_cap DESC LIMIT 50")
        .all();
      return NextResponse.json(symbols);
    }

    // Try FMP live search first (if API key is set)
    if (apiKey) {
      try {
        const url = `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&apikey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });

        if (res.ok) {
          const data = await res.json() as Array<{ symbol: string; name: string; exchange: string }>;
          // Filter to US exchanges only
          const usExchanges = new Set(["NYSE", "NASDAQ", "AMEX", "NYSE MKT", "NYSE ARCA", "NASDAQ Global Select"]);
          const filtered = data
            .filter((d) => usExchanges.has(d.exchange) && d.symbol && !d.symbol.includes("."))
            .slice(0, 30)
            .map((d) => ({
              symbol: d.symbol,
              name: d.name,
              // Check local db for market cap, default to 0
              market_cap: (db.prepare("SELECT market_cap FROM symbols WHERE symbol = ?").get(d.symbol) as { market_cap: number } | undefined)?.market_cap ?? 0,
            }));

          // Cache any new symbols we find
          const upsert = db.prepare(
            "INSERT OR IGNORE INTO symbols (symbol, name, market_cap, updated_at) VALUES (?, ?, ?, datetime('now'))"
          );
          for (const item of filtered) {
            upsert.run(item.symbol, item.name, item.market_cap);
          }

          if (filtered.length > 0) {
            return NextResponse.json(filtered);
          }
        }
      } catch {
        // FMP failed — fall through to local search
      }
    }

    // Fall back to local SQLite search
    const localResults = db
      .prepare(
        "SELECT symbol, name, market_cap FROM symbols WHERE symbol LIKE ? OR name LIKE ? ORDER BY market_cap DESC LIMIT 30"
      )
      .all(`${q}%`, `%${q}%`);

    return NextResponse.json(localResults);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
