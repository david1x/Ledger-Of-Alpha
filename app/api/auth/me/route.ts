import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isGuest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (isGuest(req)) {
    return NextResponse.json({ guest: true, name: "Guest", email: null });
  }
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}
