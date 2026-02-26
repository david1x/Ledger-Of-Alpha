/**
 * TOTP (RFC 6238) implementation using Node.js built-in crypto only.
 * No external dependencies needed.
 */
import { createHmac, randomBytes } from "crypto";

// ── Base32 codec (RFC 4648) ────────────────────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Decode(s: string): Buffer {
  const str = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function b32Encode(buf: Buffer): string {
  let bits = 0, val = 0, out = "";
  for (const byte of buf) {
    val = (val << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

// ── HOTP (RFC 4226) ───────────────────────────────────────────────────────
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac("sha1", key).update(buf).digest();
  const offset = mac[19] & 0xf;
  const code =
    ((mac[offset]     & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) <<  8) |
     (mac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Generate a random 20-byte base32-encoded TOTP secret. */
export function generateSecret(): string {
  return b32Encode(randomBytes(20));
}

/** Build the otpauth:// URI that QR-code apps scan. */
export function keyUri(email: string, secret: string): string {
  const label = `Ledger%20Of%20Alpha:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=Ledger%20Of%20Alpha&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verify a 6-digit TOTP token against a base32 secret.
 * Accepts tokens from [current - window … current + window] time steps
 * to accommodate clock drift (window=1 means ±30 seconds).
 */
export function verifyTotp(token: string, secret: string, window = 1): boolean {
  const key = b32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (hotp(key, step + i) === token) return true;
  }
  return false;
}
