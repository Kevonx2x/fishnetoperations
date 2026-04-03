import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/** All agent registrations (any status) for admin overview. */
export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("agents")
    .select(
      "id, name, email, license_number, status, verified, user_id, created_at, rejection_reason",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok(data ?? []);
}
