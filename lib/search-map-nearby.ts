import type { SearchMapProperty } from "@/lib/search-map-markers";

export type SearchMapGeoItem = { id: string; lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in meters between two WGS84 points. */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** All map items sorted by distance from the anchor (anchor first). */
export function sortSearchMapItemsByDistanceFrom<T extends SearchMapGeoItem>(
  items: T[],
  anchorId: string,
): T[] {
  const anchor = items.find((p) => p.id === anchorId);
  if (!anchor) return [...items];

  return [...items].sort((a, b) => {
    const da =
      a.id === anchorId ? 0 : haversineDistanceMeters(anchor.lat, anchor.lng, a.lat, a.lng);
    const db =
      b.id === anchorId ? 0 : haversineDistanceMeters(anchor.lat, anchor.lng, b.lat, b.lng);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

export function nearbySearchMapNavigation<T extends SearchMapGeoItem>(
  sorted: T[],
  currentId: string,
): { previous: T | null; next: T | null; index: number } {
  const index = sorted.findIndex((p) => p.id === currentId);
  if (index < 0) {
    return { previous: null, next: null, index: -1 };
  }
  return {
    index,
    previous: index > 0 ? sorted[index - 1]! : null,
    next: index < sorted.length - 1 ? sorted[index + 1]! : null,
  };
}

/** All properties sorted by distance from the anchor (anchor first). */
export function sortPropertiesByDistanceFrom(
  properties: SearchMapProperty[],
  anchorPropertyId: string,
): SearchMapProperty[] {
  return sortSearchMapItemsByDistanceFrom(properties, anchorPropertyId);
}

export function nearbyPropertyNavigation(
  sorted: SearchMapProperty[],
  currentPropertyId: string,
): { previous: SearchMapProperty | null; next: SearchMapProperty | null; index: number } {
  return nearbySearchMapNavigation(sorted, currentPropertyId);
}
