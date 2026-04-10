import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/**
 * OAuth / email-confirmation redirect target. Configure in Supabase Auth → URL config:
 * Redirect URLs must include `${SITE_URL}/auth/callback`
 *
 * Session cookies must be set on the redirect `NextResponse` (not only `cookies()`),
 * otherwise the browser may not receive auth cookies after redirect.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=auth", requestUrl.origin));
  }

  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();
  const successRedirect = NextResponse.redirect(
    new URL("/?welcome=true", requestUrl.origin),
  );

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successRedirect.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(new URL("/auth/login?error=auth", requestUrl.origin));
  }

  return successRedirect;
}
