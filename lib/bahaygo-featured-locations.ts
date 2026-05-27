import type { BahaygoFeaturedLocationRow } from "@/lib/visual-assets";
import type { DbProperty } from "@/lib/marketplace-property";
import { propertyCanonicalCity } from "@/lib/normalize-city";

export type BahaygoFeaturedLocation = {
  id: string;
  label: string;
  slug: string;
  imageUrl: string;
  match: { city?: string; neighborhood?: string };
};

const BAHAYGO_MATCH_BY_SLUG: Record<string, { city?: string; neighborhood?: string }> = {
  bgc: { neighborhood: "BGC" },
  makati: { city: "Makati" },
  ortigas: { neighborhood: "Ortigas Center" },
  "cebu-city": { city: "Cebu City" },
  davao: { city: "Davao" },
  tagaytay: { city: "Tagaytay" },
  bacolod: { city: "Bacolod" },
};

export const DEFAULT_BAHAYGO_FEATURED_LOCATIONS: BahaygoFeaturedLocation[] = [
  {
    id: "fallback-bgc",
    label: "BGC",
    slug: "bgc",
    match: { neighborhood: "BGC" },
    imageUrl:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-makati",
    label: "Makati",
    slug: "makati",
    match: { city: "Makati" },
    imageUrl:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-ortigas",
    label: "Ortigas",
    slug: "ortigas",
    match: { neighborhood: "Ortigas Center" },
    imageUrl:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-cebu",
    label: "Cebu City",
    slug: "cebu-city",
    match: { city: "Cebu City" },
    imageUrl:
      "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-davao",
    label: "Davao",
    slug: "davao",
    match: { city: "Davao" },
    imageUrl:
      "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-tagaytay",
    label: "Tagaytay",
    slug: "tagaytay",
    match: { city: "Tagaytay" },
    imageUrl:
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    id: "fallback-bacolod",
    label: "Bacolod",
    slug: "bacolod",
    match: { city: "Bacolod" },
    imageUrl:
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&h=600&q=80",
  },
];

const FALLBACK_BY_SLUG = new Map(
  DEFAULT_BAHAYGO_FEATURED_LOCATIONS.map((loc) => [loc.slug, loc]),
);

export function bahaygoLocationRowToFeatured(
  row: BahaygoFeaturedLocationRow,
): BahaygoFeaturedLocation {
  const fallback = FALLBACK_BY_SLUG.get(row.slug);
  const match = BAHAYGO_MATCH_BY_SLUG[row.slug] ?? (row.city ? { city: row.city } : {});
  return {
    id: row.id,
    label: row.name,
    slug: row.slug,
    imageUrl: row.image_url?.trim() || fallback?.imageUrl || "",
    match,
  };
}

export function bahaygoLocationRowsToFeatured(
  rows: BahaygoFeaturedLocationRow[],
): BahaygoFeaturedLocation[] {
  return rows.map(bahaygoLocationRowToFeatured);
}

export function propertyMatchesBahaygoFeaturedLocation(
  property: DbProperty,
  label: string,
  locations: BahaygoFeaturedLocation[],
): boolean {
  const entry = locations.find((x) => x.label === label);
  if (!entry) return false;
  if (entry.match.neighborhood) {
    const v = entry.match.neighborhood;
    return (
      (property.neighborhood ?? "").trim() === v ||
      property.location.toLowerCase().includes(v.toLowerCase())
    );
  }
  const city = entry.match.city ?? "";
  return (
    propertyCanonicalCity(property).toLowerCase() === city.toLowerCase() ||
    (property.city ?? "").trim().toLowerCase() === city.toLowerCase() ||
    property.location.toLowerCase().includes(city.toLowerCase())
  );
}
