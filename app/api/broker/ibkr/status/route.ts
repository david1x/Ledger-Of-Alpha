import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { getIBClient, waitForConnection, getIbkrSettings, getManagedAccounts, disconnectIB } from "@/lib/ibkr-client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { host, port, clientId } = getIbkrSettings(db, user.id);

  if (!host || !port) {
    return NextResponse.json({ connected: false, error: "No connection configured" });
  }

  try {
    const ib = getIBClient(host, port, clientId);
    const connected = await waitForConnection(ib, 5000);

    if (!connected) {
      disconnectIB();
      return NextResponse.json({ connected: false, error: "Could not connect to TWS/IB Gateway. Check that it is running and API connections are enabled." });
    }

    const accounts = await getManagedAccounts(ib);
    return NextResponse.json({ connected: true, accounts });
  } catch (err: unknown) {
    disconnectIB();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ connected: false, error: message });
  }
}
