import type { DbProperty } from "@/lib/marketplace-property";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function propertyHaystack(p: DbProperty): string {
  return [p.name, p.location, p.city, p.neighborhood].map(norm).filter(Boolean).join(" ");
}

function isRentListing(p: DbProperty): boolean {
  const lt = norm(p.listing_type);
  if (lt === "rent" || lt === "both") return true;
  const st = norm(p.status);
  return st === "for_rent" || st === "both";
}

/**
 * Prefer Uptown Park Suite BGC for the rent homepage spotlight when present in candidates.
 */
export function findRentHomepageSpotlightUptownParkSuite(candidates: DbProperty[]): DbProperty | null {
  const seen = new Set<string>();
  for (const p of candidates) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    if (!isRentListing(p)) continue;
    const h = propertyHaystack(p);
    if (!h.includes("uptown")) continue;
    if (!h.includes("park") && !h.includes("suite")) continue;
    return p;
  }
  return null;
}
