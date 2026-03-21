import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { getIBClient, waitForConnection, getIbkrSettings, getExecutions } from "@/lib/ibkr-client";

interface SyncBody {
  dateRange?: "7d" | "30d" | "custom";
  startDate?: string;
  endDate?: string;
}

interface SyncResult {
  ibkrAccountId: string;
  ledgerAccountId: string;
  newCount: number;
  dupCount: number;
  errCount: number;
  error?: string;
}

/**
 * Build the IB time filter string (format: "yyyymmdd hh:mm:ss").
 * IB only returns executions from the current and previous 6 days max.
 */
function buildTimeFilter(dateRange: string, startDate?: string): string {
  let since: Date;

  if (dateRange === "custom" && startDate) {
    since = new Date(startDate);
  } else if (dateRange === "30d") {
    // IB caps at ~7 days, but we'll send the filter anyway
    since = new Date();
    since.setDate(since.getDate() - 30);
  } else {
    since = new Date();
    since.setDate(since.getDate() - 7);
  }

  const yyyy = since.getFullYear().toString();
  const mm = (since.getMonth() + 1).toString().padStart(2, "0");
  const dd = since.getDate().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd} 00:00:00`;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { dateRange = "7d", startDate } = body;

  const db = getDb();
  const { host, port, clientId, accountMappings } = getIbkrSettings(db, user.id);

  if (!host || !port) {
    return NextResponse.json({ error: "No connection configured" }, { status: 400 });
  }

  if (!accountMappings || accountMappings.length === 0) {
    return NextResponse.json({ error: "No accounts linked" }, { status: 400 });
  }

  const ib = getIBClient(host, port, clientId);
  const connected = await waitForConnection(ib, 5000);

  if (!connected) {
    return NextResponse.json({ error: "Not connected to TWS/IB Gateway" }, { status: 503 });
  }

  const sinceTime = buildTimeFilter(dateRange, startDate);
  const syncedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  const insertTrade = db.prepare(`
    INSERT OR IGNORE INTO trades
      (user_id, account_id, symbol, direction, status, entry_price, shares, entry_date,
       commission, ibkr_exec_id, source, created_at)
    VALUES
      (?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, 'ibkr', datetime('now'))
  `);

  for (const mapping of accountMappings) {
    const { ibkrAccountId, ledgerAccountId } = mapping;
    const result: SyncResult = {
      ibkrAccountId,
      ledgerAccountId,
      newCount: 0,
      dupCount: 0,
      errCount: 0,
    };

    try {
      const executions = await getExecutions(ib, ibkrAccountId, sinceTime);

      for (const exec of executions) {
        try {
          const insertResult = insertTrade.run(
            user.id,
            ledgerAccountId,
            exec.symbol,
            exec.side,
            exec.price,
            exec.shares,
            exec.time,
            exec.commission,
            exec.execId,
          ) as { changes: number };

          if (insertResult.changes === 0) {
            result.dupCount++;
          } else {
            result.newCount++;
          }
        } catch {
          result.errCount++;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.error = message;
      result.errCount++;
    }

    results.push(result);
  }

  // Update last sync status
  const hasError = results.some(r => r.error);
  const syncStatus = hasError
    ? `error: ${results.find(r => r.error)?.error ?? "unknown"}`
    : "success";

  const upsertSetting = db.prepare(`
    INSERT INTO settings (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `);
  upsertSetting.run(user.id, "ibkr_last_sync", syncedAt);
  upsertSetting.run(user.id, "ibkr_last_sync_status", syncStatus);

  return NextResponse.json({ results, syncedAt });
}
