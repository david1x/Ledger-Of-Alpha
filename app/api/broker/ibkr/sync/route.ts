import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { ibkrFetch, getIbkrSettings, mapSide, IbkrExecution } from "@/lib/ibkr-client";

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

async function fetchExecutions(
  gatewayUrl: string,
  ibkrAccountId: string,
  sslVerify: boolean,
  days: number
): Promise<IbkrExecution[]> {
  const res = await ibkrFetch(
    gatewayUrl,
    `/iserver/account/${ibkrAccountId}/trades?days=${days}`,
    sslVerify
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as IbkrExecution[]) : [];
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

  const { dateRange = "7d" } = body;

  const db = getDb();
  const { gatewayUrl, sslVerify, accountMappings } = getIbkrSettings(db, user.id);

  if (!gatewayUrl) {
    return NextResponse.json({ error: "No gateway URL configured" }, { status: 400 });
  }

  if (!accountMappings || accountMappings.length === 0) {
    return NextResponse.json({ error: "No accounts linked" }, { status: 400 });
  }

  // Initialize brokerage session (required before iserver/account/trades)
  try {
    await ibkrFetch(gatewayUrl, "/iserver/accounts", sslVerify);
  } catch {
    // Non-fatal — proceed and let individual account fetches fail
  }

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
      let executions: IbkrExecution[] = [];

      if (dateRange === "7d") {
        executions = await fetchExecutions(gatewayUrl, ibkrAccountId, sslVerify, 7);
      } else {
        // 30d or custom: make 5 sequential calls with 7-day windows to avoid gateway limits
        const totalDays = dateRange === "30d" ? 30 : 30;
        const windows = Math.ceil(totalDays / 7);
        for (let i = 0; i < windows; i++) {
          const windowDays = Math.min(7, totalDays - i * 7);
          const batch = await fetchExecutions(
            gatewayUrl,
            ibkrAccountId,
            sslVerify,
            windowDays
          );
          executions.push(...batch);
          if (i < windows - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        // Deduplicate executions by execution_id before inserting
        const seen = new Set<string>();
        executions = executions.filter(e => {
          if (!e.execution_id || seen.has(e.execution_id)) return false;
          seen.add(e.execution_id);
          return true;
        });
      }

      for (const exec of executions) {
        try {
          const direction = mapSide(exec.side);
          const insertResult = insertTrade.run(
            user.id,
            ledgerAccountId,
            exec.symbol,
            direction,
            exec.price,
            exec.size,
            exec.trade_time,
            exec.commission ?? 0,
            exec.execution_id,
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
