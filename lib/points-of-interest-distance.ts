import { formatApproxStraightLineDistance } from "@/lib/format-straight-line-distance";
import type { GeoPoint } from "@/lib/geo-point";
import { haversineMeters } from "@/lib/haversine";

/** Landmark / school / station — any POI with coordinates. */
export type PointOfInterest = GeoPoint & {
  id: string;
};

export function straightLineMetersFromOrigin(
  origin: GeoPoint,
  point: GeoPoint,
): number {
  return haversineMeters(origin, point);
}

export function straightLineDistancesFromOrigin(
  origin: GeoPoint,
  points: readonly PointOfInterest[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const point of points) {
    out.set(point.id, haversineMeters(origin, point));
  }
  return out;
}

export function formatStraightLineDistanceFromOrigin(
  origin: GeoPoint,
  point: GeoPoint,
): string {
  return formatApproxStraightLineDistance(haversineMeters(origin, point));
}

/** e.g. "~1.2 km from Makati" when a search place label is known. */
export function formatStraightLineDistanceWithPlace(
  origin: GeoPoint,
  point: GeoPoint,
  placeLabel: string | null | undefined,
): string {
  const distance = formatApproxStraightLineDistance(haversineMeters(origin, point));
  const place = placeLabel?.trim();
  if (!distance) return "";
  if (!place) return distance;
  return `${distance} from ${place}`;
}
