import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { calculateAndStoreWalkTimes } from "@/lib/dormspace-walk-times";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const BACKFILL_PAUSE_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const admin = createSupabaseAdmin();
  const { data: listings, error: listErr } = await admin
    .from("dormspaces")
    .select("id, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (listErr) {
    console.error("[admin/backfill-walk-times] list failed", listErr);
    return fail("SERVER_ERROR", listErr.message, 500);
  }

  let processed = 0;

  for (const listing of listings ?? []) {
    const { count, error: countErr } = await admin
      .from("dormspace_walk_times")
      .select("*", { count: "exact", head: true })
      .eq("dormspace_id", listing.id);

    if (countErr) {
      console.error("[admin/backfill-walk-times] count failed", listing.id, countErr);
      continue;
    }

    if ((count ?? 0) > 0) continue;

    const lat = Number(listing.latitude);
    const lng = Number(listing.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    await calculateAndStoreWalkTimes(listing.id, lat, lng);
    processed += 1;
    await sleep(BACKFILL_PAUSE_MS);
  }

  return NextResponse.json({ ok: true, processed });
}
