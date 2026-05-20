import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  action: z.enum(["archive", "restore", "delete"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();
  const { data: listing, error: loadErr } = await admin
    .from("dormspaces")
    .select("id, landlord_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", "Could not load listing", 500);
  if (!listing || listing.landlord_user_id !== session.userId) {
    return fail("NOT_FOUND", "Listing not found", 404);
  }

  const { action } = parsed.data;

  if (action === "delete") {
    const { error } = await admin.from("dormspaces").delete().eq("id", id);
    if (error) {
      console.error("[landlord/listings] delete failed", error);
      return fail("SERVER_ERROR", "Could not delete listing", 500);
    }
    return ok({ deleted: true });
  }

  const nextStatus = action === "archive" ? "archived" : "pending";
  const { error: updateErr } = await admin.from("dormspaces").update({ status: nextStatus }).eq("id", id);

  if (updateErr) {
    console.error("[landlord/listings] update failed", updateErr);
    return fail("SERVER_ERROR", "Could not update listing", 500);
  }

  return ok({ status: nextStatus });
}
