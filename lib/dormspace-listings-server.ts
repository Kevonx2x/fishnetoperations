import { DORMSPACE_LISTING_SELECT } from "@/lib/dormspace-listing-select";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FALLBACK_SELECT = "*, dormspace_photos(id, url, display_order, created_at)";

export async function fetchDormspaceListingsServer(): Promise<DormspaceWithPhotos[]> {
  const supabase = await createSupabaseServerClient();

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

  if (error) {
    console.error("[dormspaces] listings fetch failed", error);
    return [];
  }

  return (data ?? []) as DormspaceWithPhotos[];
}

export async function fetchDormspaceListingByIdServer(id: string): Promise<DormspaceWithPhotos | null> {
  const supabase = await createSupabaseServerClient();

  let { data, error } = await supabase
    .from("dormspaces")
    .select(DORMSPACE_LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    ({ data, error } = await supabase
      .from("dormspaces")
      .select(FALLBACK_SELECT)
      .eq("id", id)
      .maybeSingle());
  }

  if (error || !data) return null;
  return data as DormspaceWithPhotos;
}
