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
