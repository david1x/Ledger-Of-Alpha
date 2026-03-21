import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { getIBClient, waitForConnection, getIbkrSettings, getManagedAccounts } from "@/lib/ibkr-client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { host, port, clientId } = getIbkrSettings(db, user.id);

  if (!host || !port) {
    return NextResponse.json({ error: "No connection configured" }, { status: 400 });
  }

  try {
    const ib = getIBClient(host, port, clientId);
    const connected = await waitForConnection(ib, 5000);

    if (!connected) {
      return NextResponse.json({ error: "Not connected to TWS/IB Gateway" }, { status: 503 });
    }

    const accountIds = await getManagedAccounts(ib);
    const accounts = accountIds.map(id => ({ id, type: "account" }));

    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
