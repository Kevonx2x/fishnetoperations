export type SearchMapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
};

export const SEARCH_MAP_SAGE = "#6B9E6E";
export const SEARCH_MAP_SAGE_BORDER = "#3d6b40";

export const SEARCH_MAP_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 44 56"><path fill="#6B9E6E" stroke="#3d6b40" stroke-width="1.5" d="M22 4C13.2 4 6.3 10.6 6.3 19c0 11.2 15.7 31.8 15.7 31.8S37.7 30.2 37.7 19C37.7 10.6 30.8 4 22 4zm0 24.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19z"/></svg>`,
);

type PropertyRow = {
  id: string;
  lat: number | string | null;
  lng: number | string | null;
  name?: string | null;
};

export function propertyRowsToSearchMapMarkers(rows: PropertyRow[]): SearchMapMarker[] {
  const markers: SearchMapMarker[] = [];

  for (const row of rows) {
    const lat = typeof row.lat === "number" ? row.lat : row.lat != null ? Number(row.lat) : NaN;
    const lng = typeof row.lng === "number" ? row.lng : row.lng != null ? Number(row.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    markers.push({
      id: row.id,
      lat,
      lng,
      title: row.name?.trim() || "Property",
    });
  }

  return markers;
}
