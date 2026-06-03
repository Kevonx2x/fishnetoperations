import type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";
import { findFeaturedNeighborhood, findFeaturedNeighborhoodInList } from "@/lib/dormspace-featured-neighborhoods";
import { listingMatchesPopularArea } from "@/lib/dormspace-popular-areas";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";
import { UNIVERSITY_LISTING_WALK_MAX_SECONDS } from "@/lib/dormspace-walk-times-display";
import {
  METRO_MANILA_CITIES,
  type DormspaceGenderPreference,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

export type DormspaceBrowseRow = {
  key: string;
  title: string;
  subtitle: string;
  items: DormspaceWithPhotos[];
  featured?: boolean;
};

/** Homepage browse: featured + two category rows (matches BahayGo recommended density). */
export const DORMSPACE_BROWSE_MAX_ROWS = 3;
export const DORMSPACE_ROW_ITEM_LIMIT = 12;
export const DORMSPACE_ROW_MIN_CARDS = 5;

/** Matches `NewlyListedCard` compact / `DormspaceListingCardCompact` widths. */
export { DORMSPACE_LISTING_CARD_WIDTH } from "@/lib/dormspace-listing-card-layout";

type RowTemplate = {
  id: string;
  priority: number;
  title: string;
  subtitle: string;
  featured?: boolean;
  matches: (row: DormspaceWithPhotos) => boolean;
};

function priceNum(row: DormspaceWithPhotos): number {
  const n = Number(row.monthly_price);
  return Number.isFinite(n) ? n : 0;
}

function cityMatch(row: DormspaceWithPhotos, city: string): boolean {
  const c = row.city?.trim().toLowerCase() ?? "";
  const hood = row.neighborhood?.trim().toLowerCase() ?? "";
  const addr = row.address?.trim().toLowerCase() ?? "";
  const needle = city.trim().toLowerCase();
  return c === needle || c.includes(needle) || hood.includes(needle) || addr.includes(needle);
}

const CITY_TEMPLATES: RowTemplate[] = METRO_MANILA_CITIES.map((city, i) => ({
  id: `city-${city.toLowerCase().replace(/\s+/g, "-")}`,
  priority: 100 + i,
  title: `Dorms in ${city}`,
  subtitle: `Bedspaces & coliving around ${city}`,
  matches: (row) => cityMatch(row, city),
}));

const CATEGORY_TEMPLATES: RowTemplate[] = [
  {
    id: "featured",
    priority: 10,
    featured: true,
    title: "Featured dormspaces",
    subtitle: "Verified listings hand-picked for students & young pros",
    matches: (row) => row.status === "approved",
  },
  {
    id: "newly-listed",
    priority: 20,
    title: "Newly listed",
    subtitle: "Fresh bedspaces — inquire before they fill up",
    matches: () => true,
  },
  {
    id: "budget",
    priority: 200,
    title: "Budget-friendly",
    subtitle: "Under ₱5,000 per month",
    matches: (row) => {
      const p = priceNum(row);
      return p > 0 && p <= 5_000;
    },
  },
  {
    id: "mid-range",
    priority: 210,
    title: "Mid-range picks",
    subtitle: "₱5,000 – ₱12,000 per month",
    matches: (row) => {
      const p = priceNum(row);
      return p > 5_000 && p <= 12_000;
    },
  },
  {
    id: "private-room",
    priority: 220,
    title: "Private rooms",
    subtitle: "Your own space in a dorm or coliving house",
    matches: (row) => row.room_type === "private",
  },
  {
    id: "shared-room",
    priority: 230,
    title: "Shared rooms",
    subtitle: "Affordable bunk & shared bed options",
    matches: (row) => row.room_type !== "private",
  },
  {
    id: "near-schools",
    priority: 240,
    title: "Near schools",
    subtitle: "Walking distance to universities & colleges",
    matches: (row) => Boolean(row.near_school?.trim()),
  },
  {
    id: "wifi",
    priority: 250,
    title: "Wi-Fi included",
    subtitle: "Stay connected for work and study",
    matches: (row) => row.has_wifi === true,
  },
  {
    id: "female",
    priority: 260,
    title: "Female-only",
    subtitle: "Listings that welcome female tenants",
    matches: (row) => row.gender_preference === "female",
  },
  {
    id: "male",
    priority: 270,
    title: "Male-only",
    subtitle: "Listings that welcome male tenants",
    matches: (row) => row.gender_preference === "male",
  },
  ...CITY_TEMPLATES,
];

const ALL_TEMPLATES = [...CATEGORY_TEMPLATES].sort((a, b) => a.priority - b.priority);

function sortNewest(a: DormspaceWithPhotos, b: DormspaceWithPhotos): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function assignRowItems(
  pool: DormspaceWithPhotos[],
  template: RowTemplate,
  seen: Set<string>,
  allowOverlap: boolean,
): DormspaceWithPhotos[] {
  const matched = pool.filter(template.matches).sort(sortNewest);
  const unique = matched.filter((r) => !seen.has(r.id));
  let items = unique.slice(0, DORMSPACE_ROW_ITEM_LIMIT);

  if (items.length < 3 && allowOverlap && matched.length >= 1) {
    const need = Math.min(3 - items.length, matched.length);
    const overlap = matched.filter((r) => seen.has(r.id)).slice(0, need);
    items = [...items, ...overlap].slice(0, DORMSPACE_ROW_ITEM_LIMIT);
  }

  if (items.length === 0 && matched.length > 0) {
    items = matched.slice(0, DORMSPACE_ROW_ITEM_LIMIT);
  }

  for (const r of items) seen.add(r.id);
  return items;
}

/** Build browse carousels: featured, newly listed, and one more category row. */
export function buildDormspaceBrowseRows(pool: DormspaceWithPhotos[]): DormspaceBrowseRow[] {
  const sortedPool = [...pool].sort(sortNewest);
  const seen = new Set<string>();
  const allowOverlap = sortedPool.length < 8;
  const rowsByKey = new Map<string, DormspaceBrowseRow>();

  for (const template of ALL_TEMPLATES) {
    const items = assignRowItems(sortedPool, template, seen, allowOverlap);
    rowsByKey.set(template.id, {
      key: template.id,
      title: template.title,
      subtitle: template.subtitle,
      items,
      featured: template.featured,
    });
  }

  const featured = rowsByKey.get("featured");
  const newlyListed = rowsByKey.get("newly-listed");
  let third: DormspaceBrowseRow | undefined;
  for (const template of ALL_TEMPLATES) {
    if (template.id === "featured" || template.id === "newly-listed") continue;
    const row = rowsByKey.get(template.id);
    if (row && row.items.length > 0) {
      third = row;
      break;
    }
  }
  if (!third) {
    for (const template of ALL_TEMPLATES) {
      if (template.id === "featured" || template.id === "newly-listed") continue;
      const row = rowsByKey.get(template.id);
      if (row) {
        third = row;
        break;
      }
    }
  }

  return [featured, newlyListed, third].filter((r): r is DormspaceBrowseRow => r != null);
}

export function dormspaceMatchesFilters(
  row: DormspaceWithPhotos,
  filters: DormspaceBrowseFilters,
  featuredNeighborhoods?: DormspacePopularArea[],
): boolean {
  const price = priceNum(row);
  const min = filters.minPrice.trim() ? Number(filters.minPrice) : null;
  const max = filters.maxPrice.trim() ? Number(filters.maxPrice) : null;

  if (filters.city && (row.city?.trim() ?? "") !== filters.city) return false;
  if (filters.roomType && row.room_type !== filters.roomType) return false;
  if (filters.gender) {
    const g = row.gender_preference ?? "any";
    if (filters.gender !== "any" && g !== "any" && g !== filters.gender) return false;
  }
  if (min != null && Number.isFinite(min) && price < min) return false;
  if (max != null && Number.isFinite(max) && price > max) return false;

  if (filters.universityId) {
    const match = (row.dormspace_walk_times ?? []).some(
      (walkTime) =>
        walkTime.university_id === filters.universityId &&
        walkTime.walk_duration_seconds <= UNIVERSITY_LISTING_WALK_MAX_SECONDS,
    );
    if (!match) return false;
  }

  if (filters.neighborhood) {
    const area = featuredNeighborhoods
      ? findFeaturedNeighborhoodInList(featuredNeighborhoods, filters.neighborhood)
      : findFeaturedNeighborhood(filters.neighborhood);
    if (area && !listingMatchesPopularArea(row, area)) return false;
  }

  return true;
}

export function hasActiveDormspaceFilters(filters: DormspaceBrowseFilters): boolean {
  return Boolean(
    filters.city ||
      filters.roomType ||
      filters.gender ||
      filters.minPrice.trim() ||
      filters.maxPrice.trim() ||
      filters.universityId ||
      filters.neighborhood,
  );
}
