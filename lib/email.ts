import nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/** Returns true if SMTP is configured (via DB or env vars). */
export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function getSmtpConfig(): SmtpConfig | null {
  // DB settings take precedence over env vars (set via admin panel)
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const get = (key: string): string =>
      (db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = ?").get(key) as { value: string } | undefined)?.value ?? "";
    const host = get("smtp_host");
    const user = get("smtp_user");
    const pass = get("smtp_pass");
    if (host && user && pass) {
      return {
        host,
        port: parseInt(get("smtp_port") || "587", 10),
        secure: get("smtp_secure") === "true",
        user,
        pass,
        from: get("smtp_from") || "Ledger Of Alpha <noreply@ledgerofalpha.local>",
      };
    }
  } catch {}

  // Fall back to environment variables
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: process.env.SMTP_FROM ?? "Ledger Of Alpha <noreply@ledgerofalpha.local>",
  };
}

function getAppUrl(): string {
  try {
    const { getDb } = require("./db");
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE user_id = '_system' AND key = 'app_url'").get() as { value: string } | undefined;
    if (row?.value) return row.value;
  } catch {}
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function send(to: string, subject: string, html: string) {
  const cfg = getSmtpConfig();
  if (!cfg) {
    console.log(`\n📧 EMAIL (no SMTP configured)\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, "")}\n`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transport.sendMail({ from: cfg.from, to, subject, html });
}

/** Escape HTML special characters to prevent XSS in email templates. */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Email templates ────────────────────────────────────────────────────────
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${getAppUrl()}/api/auth/verify-email?token=${token}`;
  await send(
    to,
    "Verify your Ledger Of Alpha account",
    `<p>Hi ${escHtml(name)},</p>
     <p>Click the link below to verify your email address. The link expires in 24 hours.</p>
     <p><a href="${url}" style="background:#10b981;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify Email</a></p>
     <p>Or paste this URL: ${url}</p>
     <p>If you didn't register, you can safely ignore this email.</p>`
  );
}

export async function sendOtpEmail(
  to: string,
  name: string,
  otp: string
): Promise<void> {
  await send(
    to,
    "Your Ledger Of Alpha login code",
    `<p>Hi ${escHtml(name)},</p>
     <p>Your one-time login code is:</p>
     <p style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#10b981;">${otp}</p>
     <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
     <p>If you didn't request this, you can safely ignore this email.</p>`
  );
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${getAppUrl()}/reset-password?token=${token}`;
  await send(
    to,
    "Reset your Ledger Of Alpha password",
    `<p>Hi ${escHtml(name)},</p>
     <p>Click the link below to reset your password. The link expires in 1 hour.</p>
     <p><a href="${url}" style="background:#10b981;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
     <p>Or paste this URL: ${url}</p>
     <p>If you didn't request a password reset, you can safely ignore this email.</p>`
  );
}
