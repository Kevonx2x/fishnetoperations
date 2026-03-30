import type { z } from "zod";
import type { savedSearchFiltersSchema } from "@/lib/api/schemas/phase1";

export type PropertyRow = {
  id: string;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
};

export type SavedSearchFilters = z.infer<typeof savedSearchFiltersSchema>;

export function parsePriceValue(price: string): number {
  const t = price.replace(/₱|\s/g, "").toUpperCase();
  if (t.includes("M")) {
    const num = parseFloat(t.replace(/[^0-9.]/g, ""));
    return (Number.isFinite(num) ? num : 0) * 1_000_000;
  }
  const digits = parseInt(t.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(digits) ? digits : 0;
}

/**
 * Returns a score in [0,1] for how well a property satisfies filters.
 */
export function scorePropertyMatch(
  property: PropertyRow,
  filters: SavedSearchFilters,
): number {
  let hits = 0;
  let checks = 0;

  const price = parsePriceValue(property.price);
  if (filters.min_price != null) {
    checks++;
    if (price >= filters.min_price) hits++;
  }
  if (filters.max_price != null) {
    checks++;
    if (price <= filters.max_price) hits++;
  }
  if (filters.min_beds != null) {
    checks++;
    if (property.beds >= filters.min_beds) hits++;
  }
  if (filters.min_baths != null) {
    checks++;
    if (property.baths >= filters.min_baths) hits++;
  }
  if (filters.location_contains?.trim()) {
    checks++;
    const q = filters.location_contains.trim().toLowerCase();
    if (property.location.toLowerCase().includes(q)) hits++;
  }

  if (checks === 0) return 0.5;
  return hits / checks;
}

export function propertyMatchesFilters(
  property: PropertyRow,
  filters: SavedSearchFilters,
): boolean {
  return scorePropertyMatch(property, filters) >= 1;
}
