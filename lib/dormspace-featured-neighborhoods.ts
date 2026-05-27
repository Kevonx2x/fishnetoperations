import type { DormspaceFeaturedNeighborhoodRow } from "@/lib/visual-assets";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";

/** Listing filter metadata keyed by neighborhood slug (stable across renames). */
const NEIGHBORHOOD_MATCH_BY_SLUG: Record<
  string,
  Pick<DormspacePopularArea, "city" | "area" | "neighborhood">
> = {
  bgc: { area: "BGC", city: "Taguig" },
  "makati-cbd": { city: "Makati" },
  "ortigas-center": { neighborhood: "Ortigas Center", area: "Ortigas", city: "Pasig" },
  manila: { city: "Manila" },
  alabang: { area: "Alabang", city: "Muntinlupa" },
  baguio: { city: "Baguio" },
};

/** Fallback when DB table is not migrated yet. */
export const DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS: DormspacePopularArea[] = [
  {
    label: "BGC",
    area: "BGC",
    city: "Taguig",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    label: "Makati CBD",
    city: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    label: "Ortigas Center",
    neighborhood: "Ortigas Center",
    area: "Ortigas",
    city: "Pasig",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    label: "Manila",
    city: "Manila",
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    label: "Alabang",
    area: "Alabang",
    city: "Muntinlupa",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&h=600&q=80",
  },
  {
    label: "Baguio",
    city: "Baguio",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=800&h=600&q=80",
  },
];

const FALLBACK_BY_LABEL = new Map(
  DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS.map((area) => [area.label, area]),
);

export function dormspaceNeighborhoodRowToPopularArea(
  row: DormspaceFeaturedNeighborhoodRow,
): DormspacePopularArea {
  const fallback = FALLBACK_BY_LABEL.get(row.name);
  const match = NEIGHBORHOOD_MATCH_BY_SLUG[row.slug] ?? {};
  return {
    label: row.name,
    imageUrl: row.image_url?.trim() || fallback?.imageUrl || "",
    city: row.city ?? match.city ?? fallback?.city,
    area: match.area ?? fallback?.area,
    neighborhood: match.neighborhood ?? fallback?.neighborhood,
  };
}

export function dormspaceNeighborhoodRowsToPopularAreas(
  rows: DormspaceFeaturedNeighborhoodRow[],
): DormspacePopularArea[] {
  return rows.map(dormspaceNeighborhoodRowToPopularArea);
}

export function findFeaturedNeighborhood(label: string): DormspacePopularArea | undefined {
  return DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS.find((area) => area.label === label);
}

export function findFeaturedNeighborhoodInList(
  areas: DormspacePopularArea[],
  label: string,
): DormspacePopularArea | undefined {
  return areas.find((area) => area.label === label);
}
