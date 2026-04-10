import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { notifyAdminNewClientFromSession } from "@/lib/admin-notify-sms";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const code = requestUrl.searchParams.get("code");

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  if (token_hash && type) {
    const {
      data: { session },
      error,
    } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });

    if (!error && session) {
      try {
        await notifyAdminNewClientFromSession(session);
      } catch {
        /* admin SMS is best-effort */
      }
      return NextResponse.redirect(new URL("/?welcome=true", request.url));
    }
  }

  if (code) {
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      try {
        await notifyAdminNewClientFromSession(session);
      } catch {
        /* admin SMS is best-effort */
      }
      return NextResponse.redirect(new URL("/?welcome=true", request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
}
