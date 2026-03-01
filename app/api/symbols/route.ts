import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { STATIC_SYMBOLS } from "@/lib/symbols-static";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  const guest = isGuest(req);
  if (!user && !guest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toUpperCase();
    const refresh = searchParams.get("refresh") === "1";

    // Get FMP key — use user's key if logged in, else no key for guests
    let apiKey = "";
    if (user) {
      const row = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'fmp_api_key'").get(user.id) as { value: string } | undefined;
      if (!row) {
        const sys = db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'fmp_api_key'").get() as { value: string } | undefined;
        apiKey = sys?.value ?? "";
      } else {
        apiKey = row.value;
      }
    }

    const count = (db.prepare("SELECT COUNT(*) as c FROM symbols").get() as { c: number }).c;
    if (count === 0 || refresh) {
      const insert = db.prepare(
        "INSERT OR REPLACE INTO symbols (symbol, name, market_cap, updated_at) VALUES (?, ?, ?, datetime('now'))"
      );
      db.transaction(() => {
        for (const sym of STATIC_SYMBOLS) insert.run(sym.symbol, sym.name, sym.market_cap);
      })();
    }

    if (!q) {
      return NextResponse.json(
        db.prepare("SELECT symbol, name, market_cap FROM symbols ORDER BY market_cap DESC LIMIT 50").all()
      );
    }

    if (apiKey) {
      try {
        const url = `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&apikey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json() as Array<{ symbol: string; name: string; exchange: string }>;
          const usExchanges = new Set(["NYSE", "NASDAQ", "AMEX", "NYSE MKT", "NYSE ARCA", "NASDAQ Global Select"]);
          const filtered = data
            .filter(d => usExchanges.has(d.exchange) && d.symbol && !d.symbol.includes("."))
            .slice(0, 30)
            .map(d => ({
              symbol: d.symbol, name: d.name,
              market_cap: (db.prepare("SELECT market_cap FROM symbols WHERE symbol = ?").get(d.symbol) as { market_cap: number } | undefined)?.market_cap ?? 0,
            }));
          const upsert = db.prepare("INSERT OR IGNORE INTO symbols (symbol, name, market_cap, updated_at) VALUES (?, ?, ?, datetime('now'))");
          for (const item of filtered) upsert.run(item.symbol, item.name, item.market_cap);
          if (filtered.length > 0) return NextResponse.json(filtered);
        }
      } catch { /* fall through to local search */ }
    }

    return NextResponse.json(
      db.prepare("SELECT symbol, name, market_cap FROM symbols WHERE symbol LIKE ? OR name LIKE ? ORDER BY market_cap DESC LIMIT 30")
        .all(`${q}%`, `%${q}%`)
    );
  } catch (e) {
    console.error("symbols API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
