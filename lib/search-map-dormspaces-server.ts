import { isDormspaceVisibleOnBrowse, type DormspaceGenderBedInput } from "@/lib/dormspace-gender-beds";
import {
  dormspaceRowsToSearchMapDormspaces,
  type SearchMapDormspace,
} from "@/lib/search-map-dormspace-markers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SEARCH_MAP_DORMSPACE_SELECT = `
  id,
  title,
  address,
  city,
  neighborhood,
  monthly_price,
  room_type,
  landlord_user_id,
  latitude,
  longitude,
  total_beds,
  available_beds,
  male_beds_total,
  male_beds_available,
  female_beds_total,
  female_beds_available,
  gender_preference,
  hidden_from_browse,
  status,
  dormspace_photos(id, url, display_order, created_at)
`;

/** Public dorm listings with coordinates for /dormspaces/search map. */
export async function fetchDormspaceSearchMapMarkersServer(): Promise<SearchMapDormspace[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("dormspaces")
    .select(SEARCH_MAP_DORMSPACE_SELECT)
    .eq("status", "approved")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    console.error("[dormspace-search-map] dormspaces fetch failed", error);
    return [];
  }

  const visible = (data ?? []).filter((row) =>
    isDormspaceVisibleOnBrowse(row as DormspaceGenderBedInput),
  );
  return dormspaceRowsToSearchMapDormspaces(visible);
}
