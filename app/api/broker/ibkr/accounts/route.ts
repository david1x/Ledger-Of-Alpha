import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { ibkrFetch, getIbkrSettings } from "@/lib/ibkr-client";

interface IbkrAccount {
  id: string;
  type?: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const { gatewayUrl, sslVerify } = getIbkrSettings(db, user.id);

  if (!gatewayUrl) {
    return NextResponse.json({ error: "No gateway URL configured" }, { status: 400 });
  }

  try {
    const [portfolioRes, subRes] = await Promise.allSettled([
      ibkrFetch(gatewayUrl, "/portfolio/accounts", sslVerify),
      ibkrFetch(gatewayUrl, "/portfolio/subaccounts", sslVerify),
    ]);

    const accounts: IbkrAccount[] = [];

    if (portfolioRes.status === "fulfilled" && portfolioRes.value.ok) {
      const data = (await portfolioRes.value.json()) as IbkrAccount[];
      if (Array.isArray(data)) accounts.push(...data);
    }

    if (subRes.status === "fulfilled" && subRes.value.ok) {
      const data = (await subRes.value.json()) as IbkrAccount[];
      if (Array.isArray(data)) {
        // avoid duplicates by id
        const existing = new Set(accounts.map(a => a.id));
        for (const sub of data) {
          if (!existing.has(sub.id)) accounts.push(sub);
        }
      }
    }

    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
