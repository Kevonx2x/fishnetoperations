import {
  DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS,
  dormspaceNeighborhoodRowsToPopularAreas,
} from "@/lib/dormspace-featured-neighborhoods";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";
import type { DormspaceFeaturedNeighborhoodRow } from "@/lib/visual-assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchDormspaceFeaturedNeighborhoodsServer(): Promise<DormspacePopularArea[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dormspace_featured_neighborhoods")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data?.length) {
    if (error) {
      console.warn("[dormspace-featured-neighborhoods] fetch failed (migration may be pending)", error.message);
    }
    return DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS;
  }

  return dormspaceNeighborhoodRowsToPopularAreas(data as DormspaceFeaturedNeighborhoodRow[]);
}

export async function fetchAllDormspaceFeaturedNeighborhoodsAdmin(): Promise<DormspaceFeaturedNeighborhoodRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dormspace_featured_neighborhoods")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DormspaceFeaturedNeighborhoodRow[];
}
