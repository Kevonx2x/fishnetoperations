/** Shared types/helpers for marketplace property cards and modals. */

export type SortMode = "newest" | "price_low" | "price_high" | "most_beds";

export type DbProperty = {
  id: string;
  created_at: string;
  name: string | null;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  status: "for_sale" | "for_rent";
  listed_by?: string | null;
  property_photos?: { url: string; sort_order: number }[];
  property_agents?: { agent: unknown }[];
};

export function roomUrlsFor(p: DbProperty): string[] {
  const fromDb = (p.property_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((x) => x.url);
  if (fromDb.length) return fromDb.slice(0, 4);
  return [p.image_url];
}
