import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, generateToken, hashToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  const limited = rateLimit(req, "register", 5, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const { name, email, password, confirmPassword } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const password_hash = await hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, email_verified)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, email.toLowerCase(), name.trim(), password_hash);

    // Seed default settings for this user
    const defaults = [
      ["account_size", "10000"],
      ["risk_per_trade", "1"],
      ["discord_webhook", ""],
      ["fmp_api_key", ""],
    ];
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)"
    );
    for (const [key, value] of defaults) {
      insertSetting.run(id, key, value);
    }

    // Email verification token (raw sent in email, hash stored in DB)
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_tokens (id, user_id, email, token_hash, type, expires_at)
      VALUES (?, ?, ?, ?, 'verify_email', ?)
    `).run(crypto.randomUUID(), id, email.toLowerCase(), tokenHash, expiresAt);

    await sendVerificationEmail(email, name.trim(), rawToken);

    return NextResponse.json({ message: "Account created. Check your email to verify." }, { status: 201 });
  } catch (e) {
    console.error("register error:", e);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
