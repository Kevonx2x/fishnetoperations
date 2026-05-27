import {
  bahaygoLocationRowsToFeatured,
  DEFAULT_BAHAYGO_FEATURED_LOCATIONS,
  type BahaygoFeaturedLocation,
} from "@/lib/bahaygo-featured-locations";
import type { BahaygoFeaturedLocationRow } from "@/lib/visual-assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchBahaygoFeaturedLocationsServer(): Promise<BahaygoFeaturedLocation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bahaygo_featured_locations")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data?.length) {
    if (error) {
      console.warn("[bahaygo-featured-locations] fetch failed (migration may be pending)", error.message);
    }
    return DEFAULT_BAHAYGO_FEATURED_LOCATIONS;
  }

  return bahaygoLocationRowsToFeatured(data as BahaygoFeaturedLocationRow[]);
}
