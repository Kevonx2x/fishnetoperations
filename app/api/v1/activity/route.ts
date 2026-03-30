import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { verifyAdminApiRequest } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminApiRequest(request);
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();

    if (admin) {
      const sb = createSupabaseAdmin();
      const { data, error } = await sb
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return fail("DATABASE_ERROR", error.message, 500);
      return ok(data ?? []);
    }

    if (!userData.user) {
      return fail("UNAUTHORIZED", "Sign in or provide x-admin-password", 401);
    }

    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .eq("actor_id", userData.user.id)
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
