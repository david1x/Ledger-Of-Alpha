import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { validateTradeFields, pickTradeFields } from "@/lib/validate-trade";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: 10 imports per 15 minutes
  const limited = rateLimit(req, "trade-import", 10, 15 * 60_000);
  if (limited) return limited;

  if (isGuest(req)) {
    return NextResponse.json(
      { error: "Guests cannot import trades. Please create an account." },
      { status: 403 }
    );
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trades } = body;

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json(
        { error: "Request must contain a non-empty 'trades' array." },
        { status: 400 }
      );
    }

    if (trades.length > 5000) {
      return NextResponse.json(
        { error: "Maximum 5000 trades per import." },
        { status: 400 }
      );
    }

    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO trades (symbol, direction, status, entry_price, stop_loss, take_profit,
        exit_price, shares, entry_date, exit_date, pnl, notes, tags, user_id, account_size, commission, risk_per_trade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const importAll = db.transaction(() => {
      for (let i = 0; i < trades.length; i++) {
        const raw = trades[i];
        if (!raw || typeof raw !== "object") {
          skipped++;
          errors.push(`Row ${i + 1}: invalid data`);
          continue;
        }

        const cleaned = pickTradeFields(raw as Record<string, unknown>);
        const validationError = validateTradeFields(cleaned);
        if (validationError) {
          skipped++;
          errors.push(`Row ${i + 1}: ${validationError}`);
          continue;
        }

        const {
          symbol, direction, status = "planned",
          entry_price, stop_loss, take_profit,
          exit_price, shares, entry_date, exit_date,
          notes, tags, account_size, commission, risk_per_trade,
        } = cleaned as Record<string, unknown>;

        // Compute PnL server-side for closed trades
        let pnl: number | null = null;
        if (
          status === "closed" &&
          typeof entry_price === "number" &&
          typeof exit_price === "number" &&
          typeof shares === "number"
        ) {
          const multiplier = direction === "long" ? 1 : -1;
          const gross = ((exit_price as number) - (entry_price as number)) * (shares as number) * multiplier;
          const comm = (typeof commission === "number" ? commission : 0);
          pnl = gross - comm * 2;
        }

        insert.run(
          typeof symbol === "string" ? symbol.toUpperCase() : null,
          direction ?? null, status,
          entry_price ?? null, stop_loss ?? null, take_profit ?? null,
          exit_price ?? null, shares ?? null, entry_date ?? null, exit_date ?? null,
          pnl, notes ?? null, tags ?? null, user.id,
          account_size ?? null, commission ?? null, risk_per_trade ?? null,
        );
        imported++;
      }
    });

    importAll();

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.slice(0, 50), // cap error list
    });
  } catch (e) {
    console.error("trade import error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
