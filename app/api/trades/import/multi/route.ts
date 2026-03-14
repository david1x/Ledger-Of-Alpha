import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { detectBroker, parseTOS, parseIBKR, parseRobinhood, RawBrokerTrade } from "@/lib/broker-parsers";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { csv, account_id } = await req.json();
    if (!csv) return NextResponse.json({ error: "CSV content required" }, { status: 400 });

    const broker = detectBroker(csv);
    if (!broker) return NextResponse.json({ error: "Could not detect broker format" }, { status: 400 });

    let rawTrades: RawBrokerTrade[] = [];
    switch (broker) {
      case "tos": rawTrades = parseTOS(csv); break;
      case "ibkr": rawTrades = parseIBKR(csv); break;
      case "robinhood": rawTrades = parseRobinhood(csv); break;
      case "standard":
        return NextResponse.json({ error: "Please use the standard import tool for Ledger of Alpha files" }, { status: 400 });
      default:
        return NextResponse.json({ error: "Unsupported broker" }, { status: 400 });
    }

    if (rawTrades.length === 0) {
      return NextResponse.json({ error: "No trades found in file" }, { status: 400 });
    }

    const db = getDb();
    
    // Resolve account
    let targetAccountId = account_id;
    if (!targetAccountId) {
      const defaultAcct = db.prepare("SELECT id FROM accounts WHERE user_id = ? AND is_default = 1").get(user.id) as { id: string } | undefined;
      targetAccountId = defaultAcct?.id;
    }

    if (!targetAccountId) return NextResponse.json({ error: "No target account found" }, { status: 400 });

    const insert = db.prepare(`
      INSERT INTO trades (
        symbol, direction, status, entry_price, shares, entry_date, 
        exit_price, exit_date, commission, user_id, account_id, pnl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    const transaction = db.transaction((trades: RawBrokerTrade[]) => {
      for (const t of trades) {
        let pnl: number | null = null;
        const status = t.exit_price !== null ? "closed" : "open";
        
        if (status === "closed" && t.entry_price && t.exit_price && t.shares) {
          const multiplier = t.direction === "long" ? 1 : -1;
          const gross = (t.exit_price - t.entry_price) * t.shares * multiplier;
          pnl = gross - (t.commission * 2);
        }

        insert.run(
          t.symbol.toUpperCase(), t.direction, status, t.entry_price, t.shares, t.entry_date,
          t.exit_price, t.exit_date, t.commission, user.id, targetAccountId, pnl
        );
        importedCount++;
      }
    });

    transaction(rawTrades);

    return NextResponse.json({ 
      success: true, 
      broker, 
      count: importedCount,
      message: `Successfully imported ${importedCount} trades from ${broker.toUpperCase()}`
    });

  } catch (error: any) {
    console.error("Multi-import error:", error);
    return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
  }
}
