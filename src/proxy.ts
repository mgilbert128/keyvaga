import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/tokens";

/**
 * Optimistic check only: sends visitors with no session cookie to the login page
 * before rendering a portal. The real permission check (valid session + role)
 * happens in the data access layer on every protected page.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/trips/:path*", "/owner/:path*", "/provider/:path*", "/admin/:path*"],
};
