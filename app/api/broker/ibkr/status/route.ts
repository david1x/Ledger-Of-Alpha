import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { ibkrFetch, getIbkrSettings } from "@/lib/ibkr-client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { gatewayUrl, sslVerify } = getIbkrSettings(db, user.id);

  if (!gatewayUrl) {
    return NextResponse.json({ connected: false, error: "No gateway URL configured" });
  }

  try {
    const res = await ibkrFetch(gatewayUrl, "/iserver/accounts", sslVerify);
    if (!res.ok) {
      return NextResponse.json({
        connected: false,
        error: `Gateway returned ${res.status}`,
      });
    }
    const data = (await res.json()) as { accounts?: string[] };
    return NextResponse.json({ connected: true, accounts: data.accounts ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ connected: false, error: message });
  }
}
