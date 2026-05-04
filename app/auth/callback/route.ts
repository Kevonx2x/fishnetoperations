import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { notifyAdminNewClientFromSession } from "@/lib/admin-notify-sms";
import { pathForRole } from "@/lib/auth-roles";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * If Supabase created an auth user (e.g. Google OAuth) before a profiles row exists,
 * insert a client profile using service role. Skips when row already exists (trigger or prior run).
 */
async function ensureProfileExistsForOAuthUser(session: Session): Promise<void> {
  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return;
  }

  const user = session.user;
  const { data: existing } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawFull = String(meta.full_name ?? meta.name ?? "").trim();
  let first_name = "";
  let last_name = "";
  if (rawFull) {
    const sp = rawFull.indexOf(" ");
    if (sp === -1) {
      first_name = rawFull;
      last_name = "";
    } else {
      first_name = rawFull.slice(0, sp).trim();
      last_name = rawFull.slice(sp + 1).trim();
    }
  }
  const avatarRaw = meta.avatar_url ?? meta.picture;
  const avatar_url =
    typeof avatarRaw === "string" && avatarRaw.trim() ? avatarRaw.trim() : null;
  const email = user.email?.trim() || null;
  const full_name = rawFull || email || "";

  const { error } = await admin.from("profiles").insert({
    id: user.id,
    email,
    full_name,
    first_name: first_name || null,
    last_name,
    avatar_url,
    role: "client",
  });
  if (error && error.code !== "23505") {
    console.error("[auth/callback] ensureProfileExistsForOAuthUser insert failed", error);
  }
}

function redirectForAuthenticatedUser(requestUrl: URL, role: string | null | undefined) {
  // Clients always land on the public homepage after login.
  const dest =
    role === "client"
      ? "/"
      : role === "agent" || role === "team_member"
        ? "/dashboard/agent?tab=pipeline"
        : pathForRole(role ?? "client");
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

  await ensureProfileExistsForOAuthUser(session);

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
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", request.url));
  }

  return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
}
