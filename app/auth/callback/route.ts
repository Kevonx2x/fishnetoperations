import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { notifyAdminNewClientFromSession } from "@/lib/admin-notify-sms";

/**
 * OAuth / email-confirmation redirect target. Configure in Supabase Auth → URL config:
 * Redirect URLs must include `${SITE_URL}/auth/callback`
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=auth", requestUrl.origin));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    return NextResponse.redirect(new URL("/auth/login?error=auth", requestUrl.origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
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

  try {
    await notifyAdminNewClientFromSession(session);
  } catch (e) {
    console.error("[auth/callback] admin new-client SMS", e);
  }

  return NextResponse.redirect(new URL("/?welcome=true", request.url));
}
