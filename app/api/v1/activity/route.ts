import { fail, ok } from "@/lib/api/response";
import { isAdminPanelRole } from "@/lib/auth-roles";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session) {
      return fail("UNAUTHORIZED", "Sign in to view activity", 401);
    }

    if (isAdminPanelRole(session.role)) {
      const sb = createSupabaseAdmin();
      const { data, error } = await sb
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return fail("DATABASE_ERROR", error.message, 500);
      return ok(data ?? []);
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .eq("actor_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return fail("DATABASE_ERROR", error.message, 500);
    return ok(data ?? []);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
