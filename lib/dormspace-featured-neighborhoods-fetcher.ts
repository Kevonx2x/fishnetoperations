import {
  DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS,
  dormspaceNeighborhoodRowsToPopularAreas,
} from "@/lib/dormspace-featured-neighborhoods";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";
import type { DormspaceFeaturedNeighborhoodRow } from "@/lib/visual-assets";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function fetchDormspaceFeaturedNeighborhoods(): Promise<DormspacePopularArea[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("dormspace_featured_neighborhoods")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data?.length) {
    if (error) throw error;
    return DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS;
  }

  return dormspaceNeighborhoodRowsToPopularAreas(data as DormspaceFeaturedNeighborhoodRow[]);
}
