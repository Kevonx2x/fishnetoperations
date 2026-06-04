import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import {
  clampBedCountsForRoomType,
  resolveDormspaceGenderBedCounts,
  syncLegacyBedFields,
} from "@/lib/dormspace-gender-beds";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import type { DormspaceRoomType } from "@/lib/dormspaces";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  male_beds_available: z.number().int().min(0).max(50).optional(),
  female_beds_available: z.number().int().min(0).max(50).optional(),
  vacancy_notes: z.string().max(300).optional().nullable(),
  hidden_from_browse: z.boolean().optional(),
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
    .select(
      "id, landlord_user_id, room_type, total_beds, available_beds, male_beds_total, male_beds_available, female_beds_total, female_beds_available, male_monthly_price, female_monthly_price, monthly_price, gender_preference, hidden_from_browse",
    )
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", "Could not load listing", 500);
  if (!listing || listing.landlord_user_id !== session.userId) {
    return fail("NOT_FOUND", "Listing not found", 404);
  }

  const counts = resolveDormspaceGenderBedCounts(listing);
  const roomType = listing.room_type as DormspaceRoomType;

  let maleAvailable = counts.maleAvailable;
  let femaleAvailable = counts.femaleAvailable;
  if (parsed.data.male_beds_available !== undefined) {
    maleAvailable = Math.min(counts.maleTotal, Math.max(0, parsed.data.male_beds_available));
  }
  if (parsed.data.female_beds_available !== undefined) {
    femaleAvailable = Math.min(counts.femaleTotal, Math.max(0, parsed.data.female_beds_available));
  }

  const nextCounts = clampBedCountsForRoomType(roomType, {
    maleTotal: counts.maleTotal,
    maleAvailable,
    femaleTotal: counts.femaleTotal,
    femaleAvailable,
  });

  const legacy = syncLegacyBedFields(nextCounts, {
    malePrice:
      listing.male_monthly_price != null ? Number(listing.male_monthly_price) : null,
    femalePrice:
      listing.female_monthly_price != null ? Number(listing.female_monthly_price) : null,
  });

  const { error: updateErr } = await admin
    .from("dormspaces")
    .update({
      male_beds_available: nextCounts.maleAvailable,
      female_beds_available: nextCounts.femaleAvailable,
      total_beds: legacy.total_beds,
      available_beds: legacy.available_beds,
      gender_preference: legacy.gender_preference,
      monthly_price: legacy.monthly_price,
      vacancy_notes: parsed.data.vacancy_notes?.trim() || null,
      hidden_from_browse:
        parsed.data.hidden_from_browse !== undefined
          ? parsed.data.hidden_from_browse
          : listing.hidden_from_browse,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[dormspaces/vacancy] update failed", updateErr);
    return fail("SERVER_ERROR", "Could not update vacancy", 500);
  }

  return ok({
    male_beds_available: nextCounts.maleAvailable,
    female_beds_available: nextCounts.femaleAvailable,
    total_beds: legacy.total_beds,
    available_beds: legacy.available_beds,
    hidden_from_browse:
      parsed.data.hidden_from_browse !== undefined
        ? parsed.data.hidden_from_browse
        : listing.hidden_from_browse,
    vacancy_notes: parsed.data.vacancy_notes?.trim() || null,
  });
}
