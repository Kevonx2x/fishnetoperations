import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation redirect target. Configure in Supabase Auth → URL config:
 * Redirect URLs must include `${SITE_URL}/auth/callback`
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/?welcome=true", requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=auth", requestUrl.origin));
}
