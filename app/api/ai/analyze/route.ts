import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { analyzeChartScreenshot } from "@/lib/ai-vision";

function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename } = body;
  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  // Validate filename ownership and safety
  if (!isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  if (!filename.startsWith(user.id + "-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Retrieve OpenAI API key from user settings
  const db = getDb();
  const keyRow = db
    .prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'openai_api_key'")
    .get(user.id) as { value: string } | undefined;
  const apiKey = keyRow?.value ?? "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured", code: "NO_API_KEY" },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeChartScreenshot(apiKey, filename);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI analysis failed:", message);
    return NextResponse.json(
      { error: "AI analysis failed", details: message },
      { status: 502 }
    );
  }
}
