import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, isGuest } from "@/lib/auth";
import { askFollowUp, AnalysisResult } from "@/lib/ai-vision";

function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { filename?: string; question?: string; priorAnalysis?: AnalysisResult };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, question, priorAnalysis } = body;

  if (!filename || !question || !priorAnalysis) {
    return NextResponse.json(
      { error: "Missing required fields: filename, question, priorAnalysis" },
      { status: 400 }
    );
  }

  // Validate filename ownership and safety
  if (!isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  if (!filename.startsWith(user.id + "-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Retrieve Gemini API key — user key takes priority, fall back to system key
  const db = getDb();
  const userRow = db
    .prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'openai_api_key'")
    .get(user.id) as { value: string } | undefined;
  const apiKey =
    (userRow as { value: string } | undefined)?.value ||
    (db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'openai_api_key'").get() as { value: string } | undefined)?.value ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API key set. Configure one in Settings > Integrations or ask your admin to set a system key.", code: "NO_API_KEY" },
      { status: 400 }
    );
  }

  try {
    const answer = await askFollowUp(apiKey, filename, question, priorAnalysis);
    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI follow-up failed:", message);
    return NextResponse.json(
      { error: "AI analysis failed", details: message },
      { status: 502 }
    );
  }
}
