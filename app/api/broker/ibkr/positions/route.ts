import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { getIBClient, waitForConnection, getIbkrSettings, getPositions } from "@/lib/ibkr-client";
import { IBApiNext } from "@stoqey/ib";
import { firstValueFrom, take, timeout, catchError, of } from "rxjs";

interface PositionWithPnl {
  symbol: string;
  quantity: number;
  unrealizedPnl: number;
  pnlPercent: number;
  direction: "long" | "short";
  mktPrice: number;
  avgPrice: number;
  ibkrAccountId: string;
}

async function getPositionPnl(
  ib: IBApiNext,
  account: string,
  conId: number,
): Promise<{ unrealizedPnl: number; mktPrice: number } | null> {
  try {
    const pnl = await firstValueFrom(
      ib.getPnLSingle(account, "", conId).pipe(
        take(1),
        timeout(5000),
        catchError(() => of(null)),
      )
    );
    if (pnl) {
      return {
        unrealizedPnl: pnl.unrealizedPnL ?? 0,
        mktPrice: pnl.marketValue && pnl.position ? pnl.marketValue / Math.abs(pnl.position) : 0,
      };
    }
  } catch { /* fall through */ }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { host, port, clientId, accountMappings } = getIbkrSettings(db, user.id);

  if (!host || !port) {
    return NextResponse.json({ error: "No connection configured" }, { status: 400 });
  }

  const ib = getIBClient(host, port, clientId);
  const connected = await waitForConnection(ib, 5000);

  if (!connected) {
    return NextResponse.json({ error: "Not connected to TWS/IB Gateway" }, { status: 503 });
  }

  try {
    const rawPositions = await getPositions(ib);

    // Filter to only mapped accounts
    const mappedAccountIds = new Set(accountMappings.map(m => m.ibkrAccountId));
    const filtered = mappedAccountIds.size > 0
      ? rawPositions.filter(p => mappedAccountIds.has(p.account))
      : rawPositions;

    // Enrich with P&L data
    const positions: PositionWithPnl[] = [];
    for (const pos of filtered) {
      if (pos.quantity === 0) continue;

      const pnlData = await getPositionPnl(ib, pos.account, pos.conId);
      const unrealizedPnl = pnlData?.unrealizedPnl ?? 0;
      const mktPrice = pnlData?.mktPrice ?? 0;
      const costBasis = Math.abs(pos.quantity) * pos.avgCost;
      const pnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

      positions.push({
        symbol: pos.symbol,
        quantity: pos.quantity,
        unrealizedPnl,
        pnlPercent,
        direction: pos.quantity > 0 ? "long" : "short",
        mktPrice,
        avgPrice: pos.avgCost,
        ibkrAccountId: pos.account,
      });
    }

    return NextResponse.json({ positions, fetchedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
