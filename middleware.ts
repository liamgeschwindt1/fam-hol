import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/setup",
  "/join",
  "/welcome-back",
  "/api/health",
  "/cal/",
  "/api/upload",
  "/api/images",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files, Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Public paths don't need auth check in middleware
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("ft_session")?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/welcome-back", request.url));
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
