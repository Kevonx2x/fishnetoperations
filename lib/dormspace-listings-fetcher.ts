import { DORMSPACE_LISTING_SELECT } from "@/lib/dormspace-listing-select";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FALLBACK_SELECT = "*, dormspace_photos(id, url, display_order, created_at)";

export async function fetchDormspaceListings(): Promise<DormspaceWithPhotos[]> {
  const supabase = createSupabaseBrowserClient();

  let { data, error } = await supabase
    .from("dormspaces")
    .select(DORMSPACE_LISTING_SELECT)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  if (error) {
    ({ data, error } = await supabase
      .from("dormspaces")
      .select(FALLBACK_SELECT)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false }));
  }

  if (error) throw error;
  return (data ?? []) as DormspaceWithPhotos[];
}
