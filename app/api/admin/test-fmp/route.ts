import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const apiKey =
    (
      db
        .prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'fmp_api_key'")
        .get() as { value: string } | undefined
    )?.value ?? "";

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "FMP API key not configured" });
  }

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/stable/search-symbol?query=AAPL&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (!res.ok || data["Error Message"]) {
      return NextResponse.json({
        ok: false,
        error: (data["Error Message"] as string | undefined) ?? "API error",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message });
  }
}
