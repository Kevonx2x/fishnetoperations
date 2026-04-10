import { NextRequest } from "next/server";
import { notifyAdminNewClientFromUser } from "@/lib/admin-notify-sms";
import { fail, ok } from "@/lib/api/response";
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
      await notifyAdminNewClientFromUser(userData.user);
    } catch (e) {
      console.error("[notify/admin-new-client]", e);
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
