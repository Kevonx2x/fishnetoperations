/** WGS84 point for straight-line distance and map anchors. */
export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) return false;
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

/** Coerce Supabase / form values (may arrive as strings) into a valid point. */
export function coerceGeoPoint(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): GeoPoint | null {
  const lat = typeof latitude === "string" ? Number(latitude) : latitude;
  const lng = typeof longitude === "string" ? Number(longitude) : longitude;
  const point = { latitude: lat ?? NaN, longitude: lng ?? NaN };
  return isValidGeoPoint(point) ? point : null;
}
