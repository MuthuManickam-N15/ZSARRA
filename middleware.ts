import { NextRequest, NextResponse } from "next/server";

// Fast pre-check only. Real authorisation happens server-side in requireUser()/requireAdmin().
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/admin")) {
    return req.cookies.get("zsarra_session") ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (!req.cookies.get("zsarra_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*", "/cart", "/wishlist", "/checkout", "/pay/:path*", "/admin/:path*"] };
