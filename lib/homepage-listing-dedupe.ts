import { normalizeListingLocation } from "@/lib/duplicate-listing";
import type { DbProperty } from "@/lib/marketplace-property";

/** Location-only key — matches backend duplicate rule (LOWER(TRIM(location))). */
export function propertyListingLocationKey(p: DbProperty): string {
  return normalizeListingLocation(p.location ?? "");
}

/** Near-duplicate key: same trimmed location + title (case-insensitive). */
export function propertyListingFingerprint(p: DbProperty): string {
  const loc = propertyListingLocationKey(p);
  const name = (p.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${loc}|${name}`;
}

/** True when two listings likely describe the same address. */
export function listingsShareLocation(a: DbProperty, b: DbProperty): boolean {
  const keyA = propertyListingLocationKey(a);
  const keyB = propertyListingLocationKey(b);
  return keyA.length > 0 && keyA === keyB;
}

export function dedupePropertiesById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function dedupePropertiesByFingerprint(
  items: DbProperty[],
  seenFingerprints: Set<string> = new Set(),
): { items: DbProperty[]; seenFingerprints: Set<string> } {
  const fp = new Set(seenFingerprints);
  const out: DbProperty[] = [];
  for (const p of items) {
    const key = propertyListingFingerprint(p);
    if (fp.has(key)) continue;
    fp.add(key);
    out.push(p);
  }
  return { items: out, seenFingerprints: fp };
}

function listingCanonicalScore(
  p: DbProperty,
  trustScoreById?: Map<string, number>,
): number {
  let score = 0;
  if (!p.flagged_for_admin_review) score += 1000;
  if (!p.duplicate_of_property_id) score += 500;
  if (p.featured) score += 200;
  score += trustScoreById?.get(p.id) ?? 0;
  // Prefer the original listing when scores tie.
  score -= new Date(p.created_at).getTime() / 1_000_000_000;
  return score;
}

/** Pick the listing to show when multiple share the same address. */
export function pickCanonicalListingAmongDuplicates(
  group: DbProperty[],
  trustScoreById?: Map<string, number>,
): DbProperty {
  return group.reduce((best, cur) =>
    listingCanonicalScore(cur, trustScoreById) > listingCanonicalScore(best, trustScoreById) ? cur : best,
  );
}

/**
 * Mobile discovery pool: drop backend-flagged duplicates and merge same-address listings
 * so carousels and category rows surface a wider variety of properties.
 */
export function buildMobileDiscoveryPool(
  pool: DbProperty[],
  options?: { trustScoreById?: Map<string, number> },
): DbProperty[] {
  const byLocation = new Map<string, DbProperty[]>();

  for (const p of pool) {
    if (p.duplicate_of_property_id) continue;
    const locKey = propertyListingLocationKey(p);
    if (!locKey) continue;
    const group = byLocation.get(locKey) ?? [];
    group.push(p);
    byLocation.set(locKey, group);
  }

  const canonical = [...byLocation.values()].map((group) =>
    pickCanonicalListingAmongDuplicates(group, options?.trustScoreById),
  );

  return canonical.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function listingsAreAdjacentDuplicates(a: DbProperty, b: DbProperty): boolean {
  return (
    propertyListingFingerprint(a) === propertyListingFingerprint(b) ||
    listingsShareLocation(a, b)
  );
}

/**
 * Reorder a carousel list so listings with the same fingerprint or location are not side by side
 * when alternatives exist.
 */
export function spreadAdjacentDuplicateListings(items: DbProperty[]): DbProperty[] {
  if (items.length <= 2) return items;

  const result = [...items];

  for (let i = 0; i < result.length - 1; i++) {
    if (!listingsAreAdjacentDuplicates(result[i]!, result[i + 1]!)) continue;

    let swapIdx = -1;
    for (let j = i + 2; j < result.length; j++) {
      if (!listingsAreAdjacentDuplicates(result[i]!, result[j]!)) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx === -1) continue;

    const tmp = result[i + 1]!;
    result[i + 1] = result[swapIdx]!;
    result[swapIdx] = tmp;
  }

  return result;
}

function rotatePool<T>(pool: T[], offset: number): T[] {
  if (pool.length <= 1 || offset <= 0) return pool;
  const start = offset % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

export type MobileHomepageRow<T extends { key: string; items: DbProperty[] }> = T;

/**
 * Desktop category rows: dedupe within each row (no adjacent same-address cards).
 * Cross-row overlap is allowed so multiple rows stay populated with a small catalog.
 */
export function dedupeMobileHomepageRows<T extends { key: string; items: DbProperty[] }>(
  rows: T[],
  alternatePool: DbProperty[],
  options?: { minItemsPerRow?: number; maxItemsPerRow?: number },
): T[] {
  const minItems = options?.minItemsPerRow ?? 2;
  const maxItems = options?.maxItemsPerRow ?? 12;

  const out: T[] = [];

  rows.forEach((row, rowIndex) => {
    const seenIds = new Set<string>();
    const seenLocations = new Set<string>();

    const tryAdd = (p: DbProperty, bucket: DbProperty[]): boolean => {
      if (seenIds.has(p.id)) return false;
      const loc = propertyListingLocationKey(p);
      if (loc && seenLocations.has(loc)) return false;
      seenIds.add(p.id);
      if (loc) seenLocations.add(loc);
      bucket.push(p);
      return true;
    };

    const bucket: DbProperty[] = [];
    for (const p of row.items) {
      if (bucket.length >= maxItems) break;
      tryAdd(p, bucket);
    }

    if (bucket.length < minItems) {
      const rotated = rotatePool(alternatePool, rowIndex * 3);
      let need = minItems - bucket.length;
      for (const p of rotated) {
        if (bucket.length >= maxItems) break;
        if (tryAdd(p, bucket)) need--;
        if (need <= 0) break;
      }
    }

    if (bucket.length === 0) return;
    out.push({
      ...row,
      items: spreadAdjacentDuplicateListings(bucket),
    });
  });

  return out;
}

/** Mobile top carousels: unique ids, locations, and fingerprints; optional exclusion set. */
export function pickMobileCarouselListings(
  candidates: DbProperty[],
  options?: {
    limit?: number;
    excludeIds?: Set<string>;
    excludeLocationKeys?: Set<string>;
  },
): DbProperty[] {
  const limit = options?.limit ?? candidates.length;
  const exclude = options?.excludeIds ?? new Set<string>();
  const excludeLocations = options?.excludeLocationKeys ?? new Set<string>();
  const seenIds = new Set<string>();
  const seenFp = new Set<string>();
  const seenLocations = new Set<string>();
  const out: DbProperty[] = [];

  for (const p of candidates) {
    if (out.length >= limit) break;
    if (exclude.has(p.id) || seenIds.has(p.id)) continue;
    const loc = propertyListingLocationKey(p);
    if (loc && (excludeLocations.has(loc) || seenLocations.has(loc))) continue;
    const fp = propertyListingFingerprint(p);
    if (seenFp.has(fp)) continue;
    seenIds.add(p.id);
    if (loc) seenLocations.add(loc);
    seenFp.add(fp);
    out.push(p);
  }

  return spreadAdjacentDuplicateListings(out);
}
