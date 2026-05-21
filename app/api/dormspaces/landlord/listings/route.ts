import { fail, ok } from "@/lib/api/response";
import { dormspacePrimaryPhotoUrl, type DormspacePhotoRow } from "@/lib/dormspaces";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const admin = createSupabaseAdmin();
  const { data: listings, error } = await admin
    .from("dormspaces")
    .select("*, dormspace_photos(*)")
    .eq("landlord_user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[landlord/listings] load failed", error);
    return fail("SERVER_ERROR", "Could not load listings", 500);
  }

  const listingIds = (listings ?? []).map((l) => l.id as string);
  const inquiryCounts: Record<string, number> = {};
  const likeCounts: Record<string, number> = {};
  const saveCounts: Record<string, number> = {};

  if (listingIds.length > 0) {
    const [{ data: inquiries }, { data: likes }, { data: saves }] = await Promise.all([
      admin.from("dormspace_inquiries").select("dormspace_id").in("dormspace_id", listingIds),
      admin.from("dormspace_likes").select("dormspace_id").in("dormspace_id", listingIds),
      admin.from("dormspace_saves").select("dormspace_id").in("dormspace_id", listingIds),
    ]);

    for (const row of inquiries ?? []) {
      const id = row.dormspace_id as string;
      inquiryCounts[id] = (inquiryCounts[id] ?? 0) + 1;
    }
    for (const row of likes ?? []) {
      const id = row.dormspace_id as string;
      likeCounts[id] = (likeCounts[id] ?? 0) + 1;
    }
    for (const row of saves ?? []) {
      const id = row.dormspace_id as string;
      saveCounts[id] = (saveCounts[id] ?? 0) + 1;
    }
  }

  const items = (listings ?? []).map((row) => {
    const photos = (row.dormspace_photos ?? []) as DormspacePhotoRow[];
    const id = row.id as string;
    return {
      ...row,
      dormspace_photos: photos,
      thumbnail_url: dormspacePrimaryPhotoUrl(photos),
      inquiry_count: inquiryCounts[id] ?? 0,
      like_count: likeCounts[id] ?? 0,
      save_count: saveCounts[id] ?? 0,
    };
  });

  return ok({ items });
}
