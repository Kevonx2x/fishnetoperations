import {
  fetchHomepagePropertiesWithClient,
  type HomepagePropertiesResult,
} from "@/lib/marketplace-home-fetchers";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

/** Server-side homepage listings — same filters as client SWR fetcher. */
export async function fetchHomepagePropertiesServer(args: {
  neighborhoodFilter: string | null;
  listingTypeFilter: "sale" | "rent" | null;
}): Promise<HomepagePropertiesResult> {
  const supabase = createSupabasePublicServerClient();
  return fetchHomepagePropertiesWithClient(supabase, args);
}
