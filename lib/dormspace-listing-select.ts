/** Shared Supabase select for dormspace listings with photos + cached walk times. */
export const DORMSPACE_LISTING_SELECT = `
  *,
  dormspace_photos(id, url, display_order, created_at),
  dormspace_walk_times(
    walk_duration_seconds,
    walk_distance_meters,
    university_id,
    universities(id, short_name, name, display_order)
  )
`;
