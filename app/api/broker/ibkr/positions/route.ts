import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { ibkrFetch, getIbkrSettings, IbkrPosition } from "@/lib/ibkr-client";

interface MappedPosition {
  symbol: string;
  quantity: number;
  unrealizedPnl: number;
  pnlPercent: number;
  direction: "long" | "short";
  mktPrice: number;
  avgPrice: number;
  ibkrAccountId: string;
}

async function fetchPositionPage(
  gatewayUrl: string,
  ibkrAccountId: string,
  sslVerify: boolean,
  page: number
): Promise<IbkrPosition[]> {
  const res = await ibkrFetch(
    gatewayUrl,
    `/portfolio/${ibkrAccountId}/positions/${page}`,
    sslVerify
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as IbkrPosition[]) : [];
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { gatewayUrl, sslVerify, accountMappings } = getIbkrSettings(db, user.id);

  if (!gatewayUrl) {
    return NextResponse.json({ error: "No gateway URL configured" }, { status: 400 });
  }

  const positions: MappedPosition[] = [];

  for (const { ibkrAccountId } of accountMappings) {
    let page = 0;
    let keepFetching = true;

    while (keepFetching) {
      let batch: IbkrPosition[];
      try {
        batch = await fetchPositionPage(gatewayUrl, ibkrAccountId, sslVerify, page);
      } catch {
        break;
      }

      for (const pos of batch) {
        const pnlPercent =
          pos.mktValue !== 0
            ? (pos.unrealizedPnl / Math.abs(pos.mktValue)) * 100
            : 0;

        positions.push({
          symbol: pos.ticker,
          quantity: pos.position,
          unrealizedPnl: pos.unrealizedPnl,
          pnlPercent,
          direction: pos.position > 0 ? "long" : "short",
          mktPrice: pos.mktPrice,
          avgPrice: pos.avgPrice,
          ibkrAccountId,
        });
      }

      // IBKR returns at most 30 positions per page; fewer means last page
      keepFetching = batch.length === 30;
      page++;
    }
  }

  return NextResponse.json({ positions, fetchedAt: new Date().toISOString() });
}
