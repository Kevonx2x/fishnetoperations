import {
  bahaygoLocationRowsToFeatured,
  DEFAULT_BAHAYGO_FEATURED_LOCATIONS,
  type BahaygoFeaturedLocation,
} from "@/lib/bahaygo-featured-locations";
import type { BahaygoFeaturedLocationRow } from "@/lib/visual-assets";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function fetchBahaygoFeaturedLocations(): Promise<BahaygoFeaturedLocation[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("bahaygo_featured_locations")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data?.length) {
    if (error) throw error;
    return DEFAULT_BAHAYGO_FEATURED_LOCATIONS;
  }

  return bahaygoLocationRowsToFeatured(data as BahaygoFeaturedLocationRow[]);
}
