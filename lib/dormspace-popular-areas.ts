/** Popular area cards for /dormspaces — aligned with homepage FEATURED_LOCATIONS. */

export type DormspacePopularArea = {
  label: string;
  imageUrl: string;
  /** Match listing `city` (case-insensitive substring). */
  city?: string;
  /** Match `neighborhood` or `address` (case-insensitive substring). */
  area?: string;
  /** Prefer neighborhood field when set (e.g. Ortigas Center). */
  neighborhood?: string;
};

/** Same cities as `FEATURED_LOCATIONS` in fishnet-home-marketplace.tsx */
export const DORMSPACE_POPULAR_AREAS: DormspacePopularArea[] = [
  {
    label: "BGC",
    area: "BGC",
    city: "Taguig",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=260&fit=crop",
  },
  {
    label: "Makati",
    city: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=260&fit=crop",
  },
  {
    label: "Ortigas",
    neighborhood: "Ortigas Center",
    area: "Ortigas",
    city: "Pasig",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=260&fit=crop",
  },
  {
    label: "Cebu City",
    city: "Cebu City",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&h=260&fit=crop",
  },
  {
    label: "Davao",
    city: "Davao",
    imageUrl: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=400&h=260&fit=crop",
  },
  {
    label: "Tagaytay",
    city: "Tagaytay",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=260&fit=crop",
  },
  {
    label: "Bacolod",
    city: "Bacolod",
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=260&fit=crop",
  },
];

export function countListingsInPopularArea(
  listings: { city?: string | null; neighborhood?: string | null; address?: string | null }[],
  area: DormspacePopularArea,
): number {
  return listings.filter((row) => listingMatchesPopularArea(row, area)).length;
}

export function listingMatchesPopularArea(
  row: { city?: string | null; neighborhood?: string | null; address?: string | null },
  area: DormspacePopularArea,
): boolean {
  const c = row.city?.trim().toLowerCase() ?? "";
  const hood = row.neighborhood?.trim().toLowerCase() ?? "";
  const addr = row.address?.trim().toLowerCase() ?? "";

  if (area.neighborhood) {
    const needle = area.neighborhood.trim().toLowerCase();
    if (hood === needle || hood.includes(needle) || addr.includes(needle)) return true;
  }
  if (area.city) {
    const needle = area.city.trim().toLowerCase();
    if (c.includes(needle) || hood.includes(needle) || addr.includes(needle)) return true;
  }
  if (area.area) {
    const needle = area.area.trim().toLowerCase();
    if (hood.includes(needle) || addr.includes(needle) || c.includes(needle)) return true;
  }
  return false;
}
