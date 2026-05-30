import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchHomepagePropertiesWithClient,
  type HomepagePropertiesResult,
} from "@/lib/marketplace-home-fetchers";

/** Server-side homepage listings fetch for SSR (rent tab default on `/`). */
export async function fetchHomepagePropertiesServer(args: {
  neighborhoodFilter: string | null;
  listingTypeFilter: "sale" | "rent" | null;
}): Promise<HomepagePropertiesResult> {
  const supabase = await createSupabaseServerClient();
  return fetchHomepagePropertiesWithClient(supabase, args);
}
