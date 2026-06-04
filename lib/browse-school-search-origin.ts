import type { GeoPoint } from "@/lib/geo-point";
import { isValidGeoPoint } from "@/lib/geo-point";
import { resolveGeoPointFromBrowseLabel } from "@/lib/ph-location-options";

/**
 * Origin for approximate straight-line distances on school browse cards.
 * Prefer explicit anchor from search/GPS; fall back to resolving committed query text.
 */
export function resolveBrowseSchoolSearchOrigin(
  searchOrigin: GeoPoint | null,
  committedLocationLabel: string,
  filtersCity: string,
): GeoPoint | null {
  const committed = Boolean(committedLocationLabel.trim() || filtersCity.trim());
  if (!committed) return null;

  if (isValidGeoPoint(searchOrigin)) return searchOrigin;

  const label = committedLocationLabel.trim() || filtersCity.trim();
  if (!label) return null;

  return resolveGeoPointFromBrowseLabel(label);
}
