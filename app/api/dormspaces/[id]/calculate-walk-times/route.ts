import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { calculateAndStoreWalkTimes } from "@/lib/dormspace-walk-times";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { data: listing, error } = await admin
    .from("dormspaces")
    .select("id, latitude, longitude")
    .eq("id", id)
    .maybeSingle();

  if (error || !listing) {
    return fail("NOT_FOUND", "Dormspace not found", 404);
  }

  const lat = listing.latitude != null ? Number(listing.latitude) : NaN;
  const lng = listing.longitude != null ? Number(listing.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail("BAD_REQUEST", "Listing is missing latitude/longitude", 400);
  }

  const stored = await calculateAndStoreWalkTimes(id, lat, lng);
  return NextResponse.json({ ok: true, stored });
}
