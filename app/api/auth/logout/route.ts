import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const gone = { httpOnly: true, path: "/", maxAge: 0 };
  res.cookies.set("session", "", gone);
  res.cookies.set("pending_2fa", "", gone);
  res.cookies.set("guest", "", gone);
  return res;
}
