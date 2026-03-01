import { NextRequest, NextResponse } from "next/server";

interface Entry {
  timestamps: number[];
}

const store = new Map<string, Entry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 3600_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000);

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Sliding-window rate limiter.
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 */
export function rateLimit(
  req: NextRequest,
  /** Unique namespace to separate limiters (e.g. "login", "register") */
  namespace: string,
  /** Max requests allowed in the window */
  max: number,
  /** Window size in milliseconds */
  windowMs: number,
  /** Optional extra key to scope the limit (e.g. email) instead of just IP */
  extraKey?: string
): NextResponse | null {
  const ip = getIp(req);
  const key = extraKey ? `${namespace}:${extraKey}` : `${namespace}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= max) {
    const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  entry.timestamps.push(now);
  return null;
}
