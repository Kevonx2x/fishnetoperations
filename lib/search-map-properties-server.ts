import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import {
  propertyRowsToSearchMapProperties,
  type SearchMapProperty,
} from "@/lib/search-map-markers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";

const SEARCH_MAP_PROPERTY_SELECT = `
  id, lat, lng, name, location, city, neighborhood, price, rent_price, listing_type, sqft, beds, baths, image_url, status,
  property_photos (url, sort_order, created_at)
`;

/** Public marketplace listings with coordinates — same discovery filters as homepage. */
export async function fetchSearchMapPropertyMarkersServer(): Promise<SearchMapProperty[]> {
  const supabase = await createSupabaseServerClient();
  const expiryOr = publicListingExpiryOrFilter();

  const { data, error } = await supabase
    .from("properties")
    .select(SEARCH_MAP_PROPERTY_SELECT)
    .or(expiryOr)
    .or(hideTutorialDemoPropertiesOrFilter())
    .is("deleted_at", null)
    .or("availability_state.eq.available,availability_state.is.null")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    console.error("[search-map] properties fetch failed", error);
    return [];
  }

  return propertyRowsToSearchMapProperties(data ?? []);
}
