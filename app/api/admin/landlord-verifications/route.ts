import { ok, fail } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, landlord_verification_status, landlord_verification_submitted_at, created_at",
    )
    .eq("landlord_verification_status", "pending")
    .order("landlord_verification_submitted_at", { ascending: false });

  if (error) {
    console.error("[admin/landlord-verifications] list failed", error);
    return fail("SERVER_ERROR", error.message, 500);
  }

  return ok({ items: data ?? [] });
}
