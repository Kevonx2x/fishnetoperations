import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { notifyAdminNewClientFromSession } from "@/lib/admin-notify-sms";
import { pathForRole } from "@/lib/auth-roles";

function redirectForAuthenticatedUser(requestUrl: URL, role: string | null | undefined) {
  // Clients always land on the public homepage after login.
  const dest = role === "client" ? "/" : pathForRole(role ?? "client");
  return NextResponse.redirect(new URL(dest, requestUrl));
}

async function finalizeSessionAndRedirect(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>,
) {
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role ?? null;

  try {
    await notifyAdminNewClientFromSession(session);
  } catch {
    /* admin SMS is best-effort */
  }

  return redirectForAuthenticatedUser(new URL(request.url), role);
}

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
      return finalizeSessionAndRedirect(request, supabase, session);
    }
  }

  if (code) {
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      return finalizeSessionAndRedirect(request, supabase, session);
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
}
