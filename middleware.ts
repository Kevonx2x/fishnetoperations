import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { pathForRole, type ProfileRole } from "@/lib/auth-roles";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

const AUTH_PREFIX = "/auth";

const protectedExact: { path: string; roles: ProfileRole[] }[] = [
  { path: "/admin", roles: ["admin"] },
  { path: "/dashboard/broker", roles: ["broker"] },
  { path: "/dashboard/agent", roles: ["agent"] },
  { path: "/settings", roles: ["admin", "broker", "agent", "client"] },
];

function matchesProtected(pathname: string) {
  return protectedExact.some(
    (p) => pathname === p.path || pathname.startsWith(`${p.path}/`),
  );
}

function protectionFor(pathname: string): { path: string; roles: ProfileRole[] } | null {
  const hit = protectedExact.find(
    (p) => pathname === p.path || pathname.startsWith(`${p.path}/`),
  );
  return hit ?? null;
}

export async function middleware(request: NextRequest) {
  let supabaseUrl: string;
  let anonKey: string;
  try {
    const env = getPublicSupabaseEnv();
    supabaseUrl = env.url;
    anonKey = env.anonKey;
  } catch (e) {
    console.error("[middleware] Supabase public env:", e);
    return new NextResponse(
      "Configuration error: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them for Production and redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: ProfileRole = "client";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const r = profile?.role;
    if (r === "admin" || r === "broker" || r === "agent" || r === "client") {
      role = r;
    }
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/onboarding") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.searchParams.delete("next");
    return NextResponse.redirect(home);
  }

  // Logged-in users: skip auth marketing pages
  if (
    user &&
    (pathname === `${AUTH_PREFIX}/login` ||
      pathname === `${AUTH_PREFIX}/signup` ||
      pathname === `${AUTH_PREFIX}/forgot-password`)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = pathForRole(role);
    return NextResponse.redirect(url);
  }

  const needsAuth = matchesProtected(pathname);
  const rule = protectionFor(pathname);

  if (needsAuth && rule) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = `${AUTH_PREFIX}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (!rule.roles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = pathForRole(role);
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    // everything except next internals and api routes
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/admin",
    "/admin/:path*",
    "/dashboard/broker",
    "/dashboard/broker/:path*",
    "/dashboard/agent",
    "/dashboard/agent/:path*",
    "/settings",
    "/settings/:path*",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
  ],
};
