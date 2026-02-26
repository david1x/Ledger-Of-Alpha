import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";

// Routes that never require auth
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/_next/",
  "/favicon.svg",
];
const PUBLIC_EXACT = ["/login", "/register", "/verify-2fa"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Guest cookie — allow through (API routes return demo data for guests)
  if (req.cookies.get("guest")?.value === "true") {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  if (token) {
    const payload = await verifyJwt(token);
    if (payload) {
      // If 2FA is enabled but not yet verified this session → force 2FA page
      if (payload.twoFactorEnabled && !payload.twoFactorDone) {
        if (pathname !== "/verify-2fa") {
          return NextResponse.redirect(new URL("/verify-2fa", req.url));
        }
      }
      return NextResponse.next();
    }
  }

  // No valid session → redirect to login, preserving intended destination
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     * The public list above handles the rest of the exclusions.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
