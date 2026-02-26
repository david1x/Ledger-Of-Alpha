import nodemailer from "nodemailer";

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  // If SMTP isn't configured, return null — callers log to console instead.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = process.env.SMTP_FROM ?? "Ledger Of Alpha <noreply@ledgerofalpha.local>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function send(to: string, subject: string, html: string) {
  const transport = getTransport();
  if (!transport) {
    // Dev fallback — print to console so dev workflow still works
    console.log(`\n📧 EMAIL (no SMTP configured)\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, "")}\n`);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, html });
}

// ── Email templates ────────────────────────────────────────────────────────
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await send(
    to,
    "Verify your Ledger Of Alpha account",
    `<p>Hi ${name},</p>
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
    `<p>Hi ${name},</p>
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
  const url = `${APP_URL}/reset-password?token=${token}`;
  await send(
    to,
    "Reset your Ledger Of Alpha password",
    `<p>Hi ${name},</p>
     <p>Click the link below to reset your password. The link expires in 1 hour.</p>
     <p><a href="${url}" style="background:#10b981;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
     <p>Or paste this URL: ${url}</p>
     <p>If you didn't request a password reset, you can safely ignore this email.</p>`
  );
}
