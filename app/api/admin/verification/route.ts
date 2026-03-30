import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  try {
    const sb = createSupabaseAdmin();
    const [brokersRes, agentsRes] = await Promise.all([
      sb
        .from("brokers")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      sb
        .from("agents")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    if (brokersRes.error) {
      return fail("DATABASE_ERROR", brokersRes.error.message, 500);
    }
    if (agentsRes.error) {
      return fail("DATABASE_ERROR", agentsRes.error.message, 500);
    }
    return ok({
      brokers: brokersRes.data ?? [],
      agents: agentsRes.data ?? [],
    });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
