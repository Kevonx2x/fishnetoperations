import { NextRequest } from "next/server";
import { notifyAdminVerificationDocumentsSubmitted } from "@/lib/admin-notify-sms";
import { fail, ok } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function POST(request: NextRequest) {
  try {
    const fromCookies = await createSupabaseServerClient();
    const { data: cookieAuth } = await fromCookies.auth.getUser();
    const supabase = cookieAuth.user ? fromCookies : createSupabaseUserClient(request);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }

    try {
      const sb = createSupabaseAdmin();
      const { data: agent } = await sb
        .from("agents")
        .select("name, email")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (agent?.name && agent.email) {
        await notifyAdminVerificationDocumentsSubmitted({
          name: String(agent.name),
          email: String(agent.email),
        });
      }
    } catch (e) {
      console.error("[notify/admin-verification-submitted]", e);
    }

    return ok({});
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
