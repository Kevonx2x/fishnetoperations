import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Permanent redirects after brokers → agencies rename (preserve bookmarks / SEO). */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/brokers" || pathname === "/brokers/") {
    const url = request.nextUrl.clone();
    url.pathname = "/agencies";
    return NextResponse.redirect(url, 308);
  }

  const brokerDetail = pathname.match(/^\/brokers\/([^/]+)\/?$/);
  if (brokerDetail) {
    const url = request.nextUrl.clone();
    url.pathname = `/agencies/${brokerDetail[1]}`;
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/dashboard/broker" || pathname.startsWith("/dashboard/broker/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/dashboard/broker", "/dashboard/agency");
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/register/broker" || pathname.startsWith("/register/broker/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/register/broker", "/register/agency");
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/brokers/:path*", "/dashboard/broker/:path*", "/register/broker/:path*"],
};
