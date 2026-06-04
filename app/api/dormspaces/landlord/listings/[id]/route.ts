import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { calculateAndStoreWalkTimes } from "@/lib/dormspace-walk-times";
import { uploadDormspaceListingPhoto } from "@/lib/dormspace-storage";
import {
  buildGenderBedDbFields,
  parseBedInventoryFromFormData,
} from "@/components/dormspaces/dormspace-bed-inventory-fields";
import { resolveDormspaceGenderBedCounts } from "@/lib/dormspace-gender-beds";
import { sortedDormspacePhotos } from "@/lib/dormspaces";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  action: z.enum(["archive", "restore", "delete"]),
});

const roomTypes = ["private", "shared_2", "shared_4", "shared_6_plus"] as const;

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "true" || v === "on" || v === "1";
}

function parseNum(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

type RouteContext = { params: Promise<{ id: string }> };

async function loadOwnedListing(id: string, userId: string) {
  const admin = createSupabaseAdmin();
  const { data: listing, error } = await admin
    .from("dormspaces")
    .select("*, dormspace_photos(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  if (!listing || listing.landlord_user_id !== userId) return null;
  return { listing, admin };
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const { id } = await context.params;
  const owned = await loadOwnedListing(id, session.userId);
  if (!owned) return fail("NOT_FOUND", "Listing not found", 404);

  const listing = owned.listing;
  return ok({
    item: {
      ...listing,
      dormspace_photos: sortedDormspacePhotos(listing.dormspace_photos ?? null),
    },
  });
}

export async function PUT(req: Request, context: RouteContext) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const { id } = await context.params;
  const owned = await loadOwnedListing(id, session.userId);
  if (!owned) return fail("NOT_FOUND", "Listing not found", 404);

  const listing = owned.listing;
  const admin = owned.admin;

  const form = await req.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim();
  const city = String(form.get("city") ?? "").trim() || null;
  const neighborhood = String(form.get("neighborhood") ?? "").trim() || null;
  const near_school = String(form.get("near_school") ?? "").trim() || null;
  const curfew = String(form.get("curfew") ?? "").trim() || null;
  const rules_notes = String(form.get("rules_notes") ?? "").trim() || null;
  const deposit_months = parseNum(form.get("deposit_months")) ?? 1;
  const latitude = parseNum(form.get("latitude"));
  const longitude = parseNum(form.get("longitude"));
  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  let keepPhotoIds: string[] = [];
  try {
    const raw = String(form.get("keep_photo_ids") ?? "[]");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      keepPhotoIds = parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    return fail("BAD_REQUEST", "Invalid keep_photo_ids", 400);
  }

  const bedInventory = parseBedInventoryFromFormData(form);
  if (!bedInventory) {
    return fail("BAD_REQUEST", "Invalid room type or bed setup", 400);
  }

  const prevCounts = resolveDormspaceGenderBedCounts(listing);
  const bedFields = buildGenderBedDbFields(bedInventory, {
    maleAvailable: prevCounts.maleAvailable,
    femaleAvailable: prevCounts.femaleAvailable,
  });
  if (bedFields.error) {
    return fail("BAD_REQUEST", bedFields.error, 400);
  }

  const room_type = bedFields.payload.room_type as string;

  const baseSchema = z.object({
    title: z.string().min(3).max(300),
    room_type: z.enum(roomTypes),
    address: z.string().min(5).max(500),
  });

  const parsed = baseSchema.safeParse({
    title,
    room_type,
    address,
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const existingPhotos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
  const validKeepIds = keepPhotoIds.filter((pid) => existingPhotos.some((p) => p.id === pid));
  const totalPhotos = validKeepIds.length + photoFiles.length;

  if (totalPhotos < 3) {
    return fail("BAD_REQUEST", "Keep at least 3 listing photos", 400);
  }
  if (totalPhotos > 10) {
    return fail("BAD_REQUEST", "Maximum 10 listing photos", 400);
  }

  const prevLat = listing.latitude != null ? Number(listing.latitude) : null;
  const prevLng = listing.longitude != null ? Number(listing.longitude) : null;
  const coordsChanged =
    latitude != null &&
    longitude != null &&
    (latitude !== prevLat || longitude !== prevLng || address !== listing.address);

  const wasApproved = listing.status === "approved";
  const nowIso = new Date().toISOString();

  const { error: updateErr } = await admin
    .from("dormspaces")
    .update({
      title,
      description,
      deposit_months,
      address,
      city,
      neighborhood,
      latitude,
      longitude,
      near_school,
      has_wifi: parseBool(form.get("has_wifi")),
      has_aircon: parseBool(form.get("has_aircon")),
      has_kitchen: parseBool(form.get("has_kitchen")),
      has_laundry: parseBool(form.get("has_laundry")),
      has_water_included: parseBool(form.get("has_water_included")),
      has_electricity_included: parseBool(form.get("has_electricity_included")),
      has_security: parseBool(form.get("has_security")),
      curfew,
      rules_notes,
      ...bedFields.payload,
      updated_at: nowIso,
      ...(wasApproved ? { status: "pending", approved_at: null, approved_by: null } : {}),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[landlord/listings] PUT update failed", updateErr);
    return fail("SERVER_ERROR", "Could not update listing", 500);
  }

  const removeIds = existingPhotos.filter((p) => !validKeepIds.includes(p.id)).map((p) => p.id);
  if (removeIds.length > 0) {
    const { error: deleteErr } = await admin.from("dormspace_photos").delete().in("id", removeIds);
    if (deleteErr) {
      console.error("[landlord/listings] photo delete failed", deleteErr);
      return fail("SERVER_ERROR", "Could not update photos", 500);
    }
  }

  for (let i = 0; i < validKeepIds.length; i++) {
    const photoId = validKeepIds[i]!;
    await admin.from("dormspace_photos").update({ display_order: i }).eq("id", photoId);
  }

  try {
    for (let i = 0; i < photoFiles.length; i++) {
      const order = validKeepIds.length + i;
      const url = await uploadDormspaceListingPhoto(admin, id, photoFiles[i]!, order);
      const { error: insertErr } = await admin.from("dormspace_photos").insert({
        dormspace_id: id,
        url,
        display_order: order,
      });
      if (insertErr) throw new Error(insertErr.message);
    }
  } catch (e) {
    console.error("[landlord/listings] photo upload failed", e);
    return fail("SERVER_ERROR", "Could not upload new photos", 500);
  }

  if (coordsChanged && latitude != null && longitude != null) {
    try {
      await calculateAndStoreWalkTimes(id, latitude, longitude);
    } catch (e) {
      console.warn("[landlord/listings] walk times recalc failed", e);
    }
  }

  return ok({
    id,
    status: wasApproved ? "pending" : listing.status,
    reReview: wasApproved,
  });
}

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
