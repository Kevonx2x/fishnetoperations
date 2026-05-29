import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { buildPropertyGeocodeAddress, geocodeAddress } from "@/lib/google-geocoding";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const BACKFILL_PAUSE_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PropertyRow = {
  id: string;
  location: string | null;
  city: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
};

export async function POST() {
  const session = await getSessionProfile();
  if (!session) return fail("UNAUTHORIZED", "Unauthorized", 401);
  if (session.role !== "admin") return fail("FORBIDDEN", "Admin role required", 403);

  const admin = createSupabaseAdmin();
  const { data: rows, error: listErr } = await admin
    .from("properties")
    .select("id, location, city, formatted_address, lat, lng")
    .or("lat.is.null,lng.is.null");

  if (listErr) {
    console.error("[admin/backfill-coordinates] list failed", listErr);
    return fail("SERVER_ERROR", listErr.message, 500);
  }

  const properties = (rows ?? []) as PropertyRow[];
  const failures: Array<{ id: string; reason: string }> = [];
  let success = 0;

  for (const property of properties) {
    const address = buildPropertyGeocodeAddress(property);
    if (!address) {
      const reason = "Missing address fields";
      console.warn("[admin/backfill-coordinates] skip", property.id, reason);
      failures.push({ id: property.id, reason });
      continue;
    }

    const geocoded = await geocodeAddress(address);
    if (!geocoded.ok) {
      console.warn("[admin/backfill-coordinates] failed", property.id, geocoded.reason, { address });
      failures.push({ id: property.id, reason: geocoded.reason });
      await sleep(BACKFILL_PAUSE_MS);
      continue;
    }

    const { error: updateErr } = await admin
      .from("properties")
      .update({ lat: geocoded.lat, lng: geocoded.lng })
      .eq("id", property.id);

    if (updateErr) {
      const reason = `Database update failed: ${updateErr.message}`;
      console.error("[admin/backfill-coordinates] update failed", property.id, updateErr);
      failures.push({ id: property.id, reason });
    } else {
      success += 1;
    }

    await sleep(BACKFILL_PAUSE_MS);
  }

  return NextResponse.json({
    total: properties.length,
    success,
    failed: failures.length,
    failures,
  });
}
