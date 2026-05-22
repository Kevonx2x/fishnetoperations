import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  available_beds: z.number().int().min(0).max(50),
  vacancy_notes: z.string().max(300).optional().nullable(),
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
    .select("id, landlord_user_id, total_beds, title")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", "Could not load listing", 500);
  if (!listing || listing.landlord_user_id !== session.userId) {
    return fail("NOT_FOUND", "Listing not found", 404);
  }

  const totalBeds = Math.max(1, Number(listing.total_beds) || 1);
  const available = Math.min(totalBeds, Math.max(0, parsed.data.available_beds));

  const { error: updateErr } = await admin
    .from("dormspaces")
    .update({
      available_beds: available,
      vacancy_notes: parsed.data.vacancy_notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[dormspaces/vacancy] update failed", updateErr);
    return fail("SERVER_ERROR", "Could not update vacancy", 500);
  }

  return ok({
    available_beds: available,
    total_beds: totalBeds,
    vacancy_notes: parsed.data.vacancy_notes?.trim() || null,
  });
}
