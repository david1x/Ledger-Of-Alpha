import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, hashPassword } from "@/lib/auth";
import QRCode from "qrcode";
import { generateSecret, keyUri, verifyTotp } from "@/lib/totp";
import type { User } from "@/lib/types";

/** GET — generate a new TOTP secret + QR code for setup UI */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateSecret();
  const otpauth = keyUri(sessionUser.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ secret, qrDataUrl });
}

/** POST — confirm code and enable 2FA; or disable 2FA */
export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { action, code, secret } = await req.json();
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser.id) as User | undefined;
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    if (action === "enable") {
      if (!secret || !code) {
        return NextResponse.json({ error: "Secret and code are required." }, { status: 400 });
      }
      const valid = verifyTotp(code, secret);
      if (!valid) {
        return NextResponse.json({ error: "Invalid code. Make sure your authenticator is synced." }, { status: 400 });
      }

      // Generate 8 backup codes
      const rawCodes = Array.from({ length: 8 }, () =>
        Math.random().toString(36).slice(2, 8).toUpperCase()
      );
      const hashedCodes = await Promise.all(rawCodes.map(c => hashPassword(c)));

      db.prepare(`
        UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1,
        two_factor_backup_codes = ? WHERE id = ?
      `).run(secret, JSON.stringify(hashedCodes), user.id);

      return NextResponse.json({ ok: true, backupCodes: rawCodes });
    }

    if (action === "disable") {
      if (!code) return NextResponse.json({ error: "Code is required to disable 2FA." }, { status: 400 });

      const valid = user.two_factor_secret ? verifyTotp(code, user.two_factor_secret) : false;
      if (!valid) return NextResponse.json({ error: "Invalid code." }, { status: 400 });

      db.prepare(`
        UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0,
        two_factor_backup_codes = NULL WHERE id = ?
      `).run(user.id);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("2fa setup error:", e);
    return NextResponse.json({ error: "Setup failed." }, { status: 500 });
  }
}
