/** Popular area cards for /dormspaces — same pattern as homepage Featured Locations. */

export type DormspacePopularArea = {
  label: string;
  imageUrl: string;
  /** Match listing `city` (case-insensitive substring). */
  city?: string;
  /** Match `neighborhood` or `address` (case-insensitive substring). */
  area?: string;
};

export const DORMSPACE_POPULAR_AREAS: DormspacePopularArea[] = [
  {
    label: "Makati",
    city: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=260&fit=crop",
  },
  {
    label: "BGC",
    area: "BGC",
    city: "Taguig",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=260&fit=crop",
  },
  {
    label: "Manila",
    city: "Manila",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&h=260&fit=crop",
  },
  {
    label: "Ortigas",
    area: "Ortigas",
    city: "Pasig",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=260&fit=crop",
  },
  {
    label: "Quezon City",
    city: "Quezon City",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=260&fit=crop",
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
