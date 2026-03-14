import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tradesToCsv } from "@/lib/csv";
import { pickTradeFields } from "@/lib/validate-trade";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "csv";
  const accountId = searchParams.get("account_id");

  const db = getDb();
  let query = "SELECT * FROM trades WHERE user_id = ?";
  const params: any[] = [user.id];

  if (accountId) {
    query += " AND account_id = ?";
    params.push(accountId);
  }

  query += " ORDER BY entry_date DESC, created_at DESC";

  try {
    const trades = db.prepare(query).all(...params) as any[];

    if (format === "json") {
      return new Response(JSON.stringify(trades, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="trades-export-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // CSV Format
    const csv = tradesToCsv(trades);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="trades-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
