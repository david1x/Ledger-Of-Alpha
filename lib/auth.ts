import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import type { SessionUser } from "./types";

const JWT_SECRET_RAW = process.env.JWT_SECRET ?? "dev-secret-please-set-JWT_SECRET-in-env";
const JWT_SECRET_PLACEHOLDER = "dev-secret-please-set-JWT_SECRET-in-env";

if (process.env.NODE_ENV === "production" &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === JWT_SECRET_PLACEHOLDER || process.env.JWT_SECRET.length < 32)) {
  throw new Error("FATAL: JWT_SECRET must be set to a random string of at least 32 characters in production.");
}

if (JWT_SECRET_RAW === JWT_SECRET_PLACEHOLDER) {
  console.warn("⚠️  WARNING: Using default JWT secret. Set JWT_SECRET in .env for production.");
}

const SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

const BCRYPT_ROUNDS = 12;

/** Pre-computed bcrypt hash for timing attack mitigation — used when user not found. */
export const DUMMY_HASH = "$2a$12$K4G1fW1XG1mW1qK1w1K1wOW1mW1qK1w1K1wOW1mW1qK1w1K1w1q";

// ── Password ───────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT ────────────────────────────────────────────────────────────────────
export interface SessionPayload extends JWTPayload {
  sub: string;      // user id
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorDone: boolean;
  isAdmin: boolean;
}

export async function signJwt(
  payload: Omit<SessionPayload, "iat" | "exp">,
  expiresIn: string = "7d"
): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ── Session helpers ────────────────────────────────────────────────────────
function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get("session")?.value ?? null;
}

export async function getSessionUser(
  req: NextRequest
): Promise<SessionUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload?.sub) return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    emailVerified: payload.emailVerified,
    twoFactorEnabled: payload.twoFactorEnabled,
    twoFactorDone: payload.twoFactorDone,
    isAdmin: payload.isAdmin ?? false,
  };
}

/**
 * Requires the request to carry a valid session from an admin user.
 * Always re-checks the DB so a revoked admin can't use a stale JWT.
 */
export async function requireAdmin(req: NextRequest): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  if (!user) return null;
  // Re-verify in DB to prevent stale JWT from granting admin after demotion
  const { getDb } = await import("./db");
  const db = getDb();
  const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(user.id) as { is_admin: number } | undefined;
  if (!row?.is_admin) return null;
  return user;
}

/** True when the request carries a guest cookie (not a real user session). */
export function isGuest(req: NextRequest): boolean {
  return req.cookies.get("guest")?.value === "true";
}

// ── Token utilities (for email verification / OTP) ─────────────────────────
/** Generates a cryptographically secure URL-safe token string. */
export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hash of a raw token, hex-encoded. Store this in the DB. */
export async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generates a 6-digit numeric OTP string. */
export function generateOtp(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const num = new DataView(arr.buffer).getUint32(0, false);
  return String(num % 1_000_000).padStart(6, "0");
}
