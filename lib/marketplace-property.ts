/** Shared types/helpers for marketplace property cards and modals. */

import { cloudinaryPropertyPhotoDisplayUrl } from "@/lib/cloudinary-property-photo-url";

export type SortMode = "newest" | "price_low" | "price_high" | "most_beds";

export type DbProperty = {
  id: string;
  created_at: string;
  name: string | null;
  location: string;
  /** Canonical city/area for Featured Locations grouping; see `normalizeCity` in lib/normalize-city.ts. */
  city?: string | null;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  status: "for_sale" | "for_rent" | "sold" | "rented" | "both";
  /** sale | rent | both — mirrors `properties.listing_type`. */
  listing_type?: "sale" | "rent" | "both" | null;
  /** Monthly rent when `listing_type` is rent or both. */
  rent_price?: string | null;
  listed_by?: string | null;
  description?: string | null;
  property_type?: string | null;
  /** Presale development overlay (see `is_presale`). */
  is_presale?: boolean;
  developer_name?: string | null;
  /** ISO date string `YYYY-MM-DD` from DB. */
  turnover_date?: string | null;
  unit_types?: string[] | null;
  property_photos?: { url: string; sort_order?: number | null; created_at?: string | null }[];
  property_agents?: { agent: unknown }[];
};

/** Order gallery: lowest sort_order first; ties or missing sort_order use created_at ascending. */
export function comparePropertyPhotos(
  a: { sort_order?: number | null; created_at?: string | null },
  b: { sort_order?: number | null; created_at?: string | null },
): number {
  const hasA = a.sort_order != null && !Number.isNaN(Number(a.sort_order));
  const hasB = b.sort_order != null && !Number.isNaN(Number(b.sort_order));
  const na = hasA ? Number(a.sort_order) : Number.POSITIVE_INFINITY;
  const nb = hasB ? Number(b.sort_order) : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}

export function roomUrlsFor(p: DbProperty): string[] {
  const fromDb = (p.property_photos ?? [])
    .slice()
    .sort(comparePropertyPhotos)
    .map((x) => String(x.url || "").trim())
    .filter((u) => u.length > 0)
    .map((u) => cloudinaryPropertyPhotoDisplayUrl(u));
  if (fromDb.length) return fromDb;
  return [p.image_url];
}
