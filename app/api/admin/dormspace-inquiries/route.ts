import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Admin sign-in required", 401);

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("dormspace_inquiries")
    .select(
      "*, dormspaces(id, title, landlord_name, landlord_email, status, dormspace_photos(url, display_order))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/dormspace-inquiries] load failed", error);
    return fail("SERVER_ERROR", "Could not load inquiries", 500);
  }

  return ok({ items: data ?? [] });
}
