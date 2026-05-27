import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";

/** Mobile homepage featured neighborhood cards (rectangular carousel). */
export const DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS: DormspacePopularArea[] = [
  {
    label: "BGC",
    area: "BGC",
    city: "Taguig",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=260&fit=crop",
  },
  {
    label: "Makati CBD",
    city: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=260&fit=crop",
  },
  {
    label: "Ortigas Center",
    neighborhood: "Ortigas Center",
    area: "Ortigas",
    city: "Pasig",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=260&fit=crop",
  },
  {
    label: "Manila",
    city: "Manila",
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=260&fit=crop",
  },
  {
    label: "Alabang",
    area: "Alabang",
    city: "Muntinlupa",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=260&fit=crop",
  },
  {
    label: "Baguio",
    city: "Baguio",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=260&fit=crop",
  },
];

export function findFeaturedNeighborhood(label: string): DormspacePopularArea | undefined {
  return DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS.find((area) => area.label === label);
}
