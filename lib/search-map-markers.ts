import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { propertyPhotoDisplayUrl } from "@/lib/cloudinary-property-photo-url";
import { comparePropertyPhotos } from "@/lib/marketplace-property";

export type SearchMapProperty = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  name: string | null;
  location: string;
  city: string | null;
  neighborhood: string | null;
  price: string;
  rent_price: string | null;
  listing_type: "sale" | "rent" | "both" | null;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  status: "for_sale" | "for_rent" | "sold" | "rented" | "both";
  property_photos?: { url: string; sort_order?: number | null; created_at?: string | null }[];
};

/** @deprecated Alias for map pin + card data. */
export type SearchMapMarker = SearchMapProperty;

export const SEARCH_MAP_SAGE = "#6B9E6E";
export const SEARCH_MAP_SAGE_BORDER = "#3d6b40";
export const SEARCH_MAP_GOLD = "#D4A843";

export const SEARCH_MAP_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 44 56"><path fill="#6B9E6E" stroke="#3d6b40" stroke-width="1.5" d="M22 4C13.2 4 6.3 10.6 6.3 19c0 11.2 15.7 31.8 15.7 31.8S37.7 30.2 37.7 19C37.7 10.6 30.8 4 22 4zm0 24.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19z"/></svg>`,
);

export const SEARCH_MAP_SELECTED_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 44 56"><path fill="#6B9E6E" stroke="#D4A843" stroke-width="2.5" d="M22 4C13.2 4 6.3 10.6 6.3 19c0 11.2 15.7 31.8 15.7 31.8S37.7 30.2 37.7 19C37.7 10.6 30.8 4 22 4zm0 24.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19z"/></svg>`,
);

type PropertyRow = {
  id: string;
  lat: number | string | null;
  lng: number | string | null;
  name?: string | null;
  location?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  price?: string | null;
  rent_price?: string | null;
  listing_type?: "sale" | "rent" | "both" | null;
  sqft?: string | null;
  beds?: number | null;
  baths?: number | null;
  image_url?: string | null;
  status?: SearchMapProperty["status"] | null;
  property_photos?: SearchMapProperty["property_photos"];
};

export function searchMapPropertyLocationLine(property: SearchMapProperty): string {
  const neighborhood = property.neighborhood?.trim();
  const city = property.city?.trim();
  if (neighborhood && city) return `${neighborhood} · ${city}`;
  return neighborhood || city || property.location?.trim() || "Metro Manila";
}

export function searchMapPropertyPriceLabel(property: SearchMapProperty): string {
  if (property.status === "for_rent" || property.listing_type === "rent") {
    return formatPropertyPriceDisplay(property.rent_price ?? property.price, "for_rent");
  }
  return formatPropertyPriceDisplay(property.price, property.status);
}

export function searchMapPropertyPhotoUrl(property: SearchMapProperty): string {
  const fromDb = (property.property_photos ?? [])
    .slice()
    .sort(comparePropertyPhotos)
    .map((x) => String(x.url || "").trim())
    .filter((u) => u.length > 0);
  const raw = fromDb[0] ?? String(property.image_url ?? "").trim();
  return raw ? propertyPhotoDisplayUrl(raw) : "";
}

export function propertyRowsToSearchMapProperties(rows: PropertyRow[]): SearchMapProperty[] {
  const properties: SearchMapProperty[] = [];

  for (const row of rows) {
    const lat = typeof row.lat === "number" ? row.lat : row.lat != null ? Number(row.lat) : NaN;
    const lng = typeof row.lng === "number" ? row.lng : row.lng != null ? Number(row.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    properties.push({
      id: row.id,
      lat,
      lng,
      title: row.name?.trim() || row.location?.trim() || "Property",
      name: row.name?.trim() || null,
      location: row.location?.trim() || "",
      city: row.city?.trim() || null,
      neighborhood: row.neighborhood?.trim() || null,
      price: String(row.price ?? "").trim(),
      rent_price: row.rent_price != null ? String(row.rent_price).trim() : null,
      listing_type: row.listing_type ?? null,
      sqft: String(row.sqft ?? "").trim(),
      beds: Number(row.beds ?? 0),
      baths: Number(row.baths ?? 0),
      image_url: String(row.image_url ?? "").trim(),
      status: row.status ?? "for_sale",
      property_photos: row.property_photos,
    });
  }

  return properties;
}

export function propertyRowsToSearchMapMarkers(rows: PropertyRow[]): SearchMapProperty[] {
  return propertyRowsToSearchMapProperties(rows);
}
