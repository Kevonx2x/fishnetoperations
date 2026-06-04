import { normalizeBrowseLocationLabel } from "@/lib/browse-location-label";
import type { GeoPoint } from "@/lib/geo-point";

/** Hardcoded Philippine locations for browse autocomplete — approximate area centers. */
export type PhLocationOption = {
  area: string;
  city: string;
  latitude: number;
  longitude: number;
};

export const PH_LOCATION_OPTIONS: PhLocationOption[] = [
  { area: "BGC", city: "Taguig", latitude: 14.5515, longitude: 121.0466 },
  { area: "Makati CBD", city: "Makati", latitude: 14.5547, longitude: 121.0244 },
  { area: "Ortigas Center", city: "Pasig", latitude: 14.586, longitude: 121.0614 },
  { area: "Mandaluyong", city: "Mandaluyong", latitude: 14.5794, longitude: 121.0359 },
  { area: "Eastwood", city: "Quezon City", latitude: 14.6106, longitude: 121.0799 },
  { area: "Cubao", city: "Quezon City", latitude: 14.6196, longitude: 121.0565 },
  { area: "Katipunan", city: "Quezon City", latitude: 14.638, longitude: 121.0748 },
  { area: "Commonwealth", city: "Quezon City", latitude: 14.676, longitude: 121.0437 },
  { area: "Quezon City", city: "Quezon City", latitude: 14.676, longitude: 121.0437 },
  { area: "Loyola Heights", city: "Quezon City", latitude: 14.6395, longitude: 121.0778 },
  { area: "Diliman", city: "Quezon City", latitude: 14.6539, longitude: 121.0684 },
  { area: "Greenhills", city: "San Juan", latitude: 14.6019, longitude: 121.0486 },
  { area: "San Juan", city: "San Juan", latitude: 14.6019, longitude: 121.035 },
  { area: "Marikina", city: "Marikina", latitude: 14.6507, longitude: 121.1029 },
  { area: "Pasay", city: "Pasay", latitude: 14.5378, longitude: 121.0014 },
  { area: "Paranaque", city: "Paranaque", latitude: 14.4793, longitude: 121.0198 },
  { area: "Las Pinas", city: "Las Pinas", latitude: 14.4492, longitude: 120.993 },
  { area: "Muntinlupa", city: "Muntinlupa", latitude: 14.4081, longitude: 121.0415 },
  { area: "Valenzuela", city: "Valenzuela", latitude: 14.7011, longitude: 120.983 },
  { area: "Malabon", city: "Malabon", latitude: 14.6626, longitude: 120.9567 },
  { area: "Navotas", city: "Navotas", latitude: 14.6669, longitude: 120.941 },
  { area: "Caloocan", city: "Caloocan", latitude: 14.7489, longitude: 120.9858 },
  { area: "Manila", city: "Manila", latitude: 14.5995, longitude: 120.9842 },
  { area: "Intramuros", city: "Manila", latitude: 14.5906, longitude: 120.976 },
  { area: "Taft", city: "Manila", latitude: 14.5646, longitude: 120.993 },
  { area: "Malate", city: "Manila", latitude: 14.5633, longitude: 120.992 },
  { area: "España", city: "Manila", latitude: 14.605, longitude: 120.991 },
  { area: "Sampaloc", city: "Manila", latitude: 14.6097, longitude: 120.9893 },
  { area: "Cebu City", city: "Cebu City", latitude: 10.3157, longitude: 123.8854 },
  { area: "Lapu-Lapu", city: "Lapu-Lapu", latitude: 10.3103, longitude: 123.9494 },
  { area: "Mandaue", city: "Mandaue", latitude: 10.3234, longitude: 123.9229 },
  { area: "Talisay", city: "Talisay", latitude: 10.2447, longitude: 123.8334 },
  { area: "Minglanilla", city: "Minglanilla", latitude: 10.244, longitude: 123.7969 },
  { area: "Davao City", city: "Davao City", latitude: 7.1907, longitude: 125.4553 },
  { area: "Tagum", city: "Tagum", latitude: 7.4475, longitude: 125.8096 },
  { area: "Digos", city: "Digos", latitude: 6.7494, longitude: 125.357 },
  { area: "Iloilo City", city: "Iloilo City", latitude: 10.7202, longitude: 122.5621 },
  { area: "Bacolod", city: "Bacolod", latitude: 10.6407, longitude: 122.9687 },
  { area: "Cagayan de Oro", city: "Cagayan de Oro", latitude: 8.4542, longitude: 124.6319 },
  { area: "Zamboanga", city: "Zamboanga", latitude: 6.9214, longitude: 122.079 },
  { area: "Baguio", city: "Baguio", latitude: 16.4023, longitude: 120.596 },
  { area: "Clark", city: "Pampanga", latitude: 15.1857, longitude: 120.5397 },
  { area: "Angeles", city: "Pampanga", latitude: 15.145, longitude: 120.5847 },
  { area: "Cavite", city: "Cavite", latitude: 14.4791, longitude: 120.8969 },
  { area: "Laguna", city: "Laguna", latitude: 14.2691, longitude: 121.4119 },
  { area: "Batangas", city: "Batangas", latitude: 13.7565, longitude: 121.0581 },
  { area: "Antipolo", city: "Rizal", latitude: 14.6255, longitude: 121.1245 },
  { area: "Taytay", city: "Rizal", latitude: 14.5583, longitude: 121.1322 },
];

export function formatPhLocation(o: PhLocationOption): string {
  return `${o.area}, ${o.city}`;
}

export function phLocationToGeoPoint(option: PhLocationOption): GeoPoint {
  return { latitude: option.latitude, longitude: option.longitude };
}

/** Resolve browse search text to a fixed PH area center (no geocoding API). */
export function resolveGeoPointFromBrowseLabel(label: string): GeoPoint | null {
  const normalized = normalizeBrowseLocationLabel(label);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const exact = PH_LOCATION_OPTIONS.find(
    (o) => formatPhLocation(o).toLowerCase() === lower,
  );
  if (exact) return phLocationToGeoPoint(exact);

  for (const option of PH_LOCATION_OPTIONS) {
    if (option.area.toLowerCase() === lower || option.city.toLowerCase() === lower) {
      return phLocationToGeoPoint(option);
    }
  }

  const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const areaPart = parts[0]!.toLowerCase();
    const cityPart = parts[parts.length - 1]!.toLowerCase();
    const match = PH_LOCATION_OPTIONS.find(
      (o) => o.area.toLowerCase() === areaPart && o.city.toLowerCase() === cityPart,
    );
    if (match) return phLocationToGeoPoint(match);
  }

  return null;
}
