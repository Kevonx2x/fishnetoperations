import "server-only";

import { calculateWalkTimes } from "@/lib/google-distance-matrix";
import { UNIVERSITY_LISTING_WALK_MAX_SECONDS } from "@/lib/dormspace-walk-times-display";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export { UNIVERSITY_LISTING_WALK_MAX_SECONDS } from "@/lib/dormspace-walk-times-display";

export async function refreshUniversityListingCounts(): Promise<void> {
  const admin = createSupabaseAdmin();
  const { data: universities, error: uniErr } = await admin
    .from("universities")
    .select("id")
    .eq("is_active", true);

  if (uniErr || !universities?.length) {
    if (uniErr) console.error("[dormspace-walk-times] university list failed", uniErr);
    return;
  }

  for (const university of universities) {
    const { data: walkRows, error } = await admin
      .from("dormspace_walk_times")
      .select("dormspace_id, dormspaces!inner(status)")
      .eq("university_id", university.id)
      .lte("walk_duration_seconds", UNIVERSITY_LISTING_WALK_MAX_SECONDS)
      .in("dormspaces.status", ["pending", "approved"]);

    if (error) {
      console.error("[dormspace-walk-times] count failed", university.id, error);
      continue;
    }

    await admin
      .from("universities")
      .update({ listing_count: walkRows?.length ?? 0 })
      .eq("id", university.id);
  }
}

export async function calculateAndStoreWalkTimes(
  dormspaceId: string,
  originLat: number,
  originLng: number,
): Promise<number> {
  const results = await calculateWalkTimes(originLat, originLng);
  if (results.length === 0) return 0;

  const admin = createSupabaseAdmin();
  const calculatedAt = new Date().toISOString();

  await admin.from("dormspace_walk_times").delete().eq("dormspace_id", dormspaceId);

  const rows = results.map((result) => ({
    dormspace_id: dormspaceId,
    university_id: result.universityId,
    walk_duration_seconds: result.walkSeconds,
    walk_distance_meters: result.walkMeters,
    calculated_at: calculatedAt,
  }));

  const { error } = await admin.from("dormspace_walk_times").insert(rows);
  if (error) {
    console.error("[dormspace-walk-times] insert failed", dormspaceId, error);
    return 0;
  }

  await refreshUniversityListingCounts();
  return rows.length;
}
