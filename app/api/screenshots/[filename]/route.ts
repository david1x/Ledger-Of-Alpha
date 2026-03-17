import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

function isSafeFilename(filename: string): boolean {
  // Reject path traversal attempts — no slashes or dots at the start
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await params;

  if (!isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Security: only allow files belonging to this user
  if (!filename.startsWith(user.id + "-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filepath = path.join(SCREENSHOTS_DIR, filename);
  try {
    const buffer = await readFile(filepath);
    const mime = getMimeType(filename);
    return new Response(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await params;

  if (!isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // Security: only allow files belonging to this user
  if (!filename.startsWith(user.id + "-")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filepath = path.join(SCREENSHOTS_DIR, filename);
  try {
    await unlink(filepath);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File already gone — treat as success
      return NextResponse.json({ success: true });
    }
    console.error("Failed to delete screenshot:", err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
