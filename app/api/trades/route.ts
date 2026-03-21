import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { DEMO_TRADES } from "@/lib/demo-data";
import { validateTradeFields } from "@/lib/validate-trade";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    const { searchParams } = new URL(req.url);
    let trades = [...DEMO_TRADES];
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const symbol = searchParams.get("symbol");
    const guestAccountId = searchParams.get("account_id");
    const guestAiPattern = searchParams.get("ai_pattern");
    const guestDateFrom = searchParams.get("date_from");
    const guestDateTo = searchParams.get("date_to");
    if (guestAccountId) trades = trades.filter(t => t.account_id === guestAccountId);
    if (status)    trades = trades.filter(t => t.status === status);
    if (direction) trades = trades.filter(t => t.direction === direction);
    if (symbol)    trades = trades.filter(t => t.symbol.includes(symbol.toUpperCase()));
    if (guestAiPattern) trades = trades.filter(t => t.ai_primary_pattern === guestAiPattern);
    if (guestDateFrom) trades = trades.filter(t => t.exit_date != null && t.exit_date >= guestDateFrom);
    if (guestDateTo)   trades = trades.filter(t => t.exit_date != null && t.exit_date <= guestDateTo);
    return NextResponse.json(trades);
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const symbol = searchParams.get("symbol");
    const aiPattern = searchParams.get("ai_pattern");

    let query = `SELECT t.*,
      (SELECT GROUP_CONCAT(tmt.mistake_id) FROM trade_mistake_tags tmt WHERE tmt.trade_id = t.id) AS mistake_tag_ids
      FROM trades t WHERE t.user_id = ?`;
    const params: unknown[] = [user.id];

    const accountId = searchParams.get("account_id");
    if (accountId) { query += " AND account_id = ?"; params.push(accountId); }

    if (status)    { query += " AND status = ?";   params.push(status); }
    if (direction) { query += " AND direction = ?"; params.push(direction); }
    if (symbol)    { query += " AND symbol LIKE ?"; params.push(`%${symbol.toUpperCase()}%`); }
    if (aiPattern) { query += " AND ai_primary_pattern = ?"; params.push(aiPattern); }

    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (dateFrom) { query += " AND exit_date >= ?"; params.push(dateFrom); }
    if (dateTo)   { query += " AND exit_date <= ?"; params.push(dateTo); }

    query += " ORDER BY created_at DESC";

    return NextResponse.json(db.prepare(query).all(...params));
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot delete trades." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    const result = db.prepare(
      `DELETE FROM trades WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, user.id);

    return NextResponse.json({ deleted: result.changes });
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ error: "Guests cannot save trades. Please create an account." }, { status: 403 });
  }

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const body = await req.json();

    const validationError = validateTradeFields(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const {
      symbol, direction, status = "planned",
      entry_price, stop_loss, take_profit,
      exit_price, shares, entry_date, exit_date,
      notes, tags, emotions, wyckoff_checklist, account_size, commission, risk_per_trade,
      rating, mistakes, market_context, lessons,
      chart_tf, chart_saved_at, account_id, strategy_id, checklist_items, checklist_state,
    } = body;

    // Validate account_id if provided
    let resolvedAccountId = account_id;
    if (resolvedAccountId) {
      const acct = db.prepare("SELECT id FROM accounts WHERE id = ? AND user_id = ?").get(resolvedAccountId, user.id);
      if (!acct) return NextResponse.json({ error: "Account not found" }, { status: 400 });
    } else {
      // Default to user's default account
      const defaultAcct = db.prepare("SELECT id FROM accounts WHERE user_id = ? AND is_default = 1").get(user.id) as { id: string } | undefined;
      resolvedAccountId = defaultAcct?.id ?? null;
    }

    let pnl: number | null = null;
    if (status === "closed" && entry_price && exit_price && shares) {
      const multiplier = direction === "long" ? 1 : -1;
      const gross = (exit_price - entry_price) * shares * multiplier;
      const comm = commission ?? 0;
      pnl = gross - (comm * 2);
    }

    const result = db.prepare(`
      INSERT INTO trades (symbol, direction, status, entry_price, stop_loss, take_profit,
        exit_price, shares, entry_date, exit_date, pnl, notes, tags, emotions, wyckoff_checklist, user_id, account_size, commission, risk_per_trade,
        rating, mistakes, market_context, lessons, chart_tf, chart_saved_at, account_id, strategy_id, checklist_items, checklist_state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      symbol?.toUpperCase(), direction, status,
      entry_price ?? null, stop_loss ?? null, take_profit ?? null,
      exit_price ?? null, shares ?? null, entry_date ?? null, exit_date ?? null,
      pnl, notes ?? null, tags ?? null, emotions ?? null, wyckoff_checklist ?? null, user.id,
      account_size ?? null, commission ?? null, risk_per_trade ?? null,
      rating ?? null, mistakes ?? null, market_context ?? null, lessons ?? null,
      chart_tf ?? null, chart_saved_at ?? null, resolvedAccountId ?? null, strategy_id ?? null, checklist_items ?? null, checklist_state ?? null,
    );

    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(trade, { status: 201 });
  } catch (e) {
    console.error("trades API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
