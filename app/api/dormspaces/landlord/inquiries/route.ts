import { fail, ok } from "@/lib/api/response";
import type { DormspaceInquiryStatus } from "@/lib/dormspaces";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as DormspaceInquiryStatus | "all" | null;

  const admin = createSupabaseAdmin();
  const { data: listings } = await admin.from("dormspaces").select("id").eq("landlord_user_id", session.userId);

  const listingIds = (listings ?? []).map((l) => l.id as string);
  if (listingIds.length === 0) {
    return ok({ items: [] });
  }

  let query = admin
    .from("dormspace_inquiries")
    .select("*, dormspaces(id, title, dormspace_photos(url, display_order))")
    .in("dormspace_id", listingIds)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[landlord/inquiries] load failed", error);
    return fail("SERVER_ERROR", "Could not load inquiries", 500);
  }

  return ok({ items: data ?? [] });
}
