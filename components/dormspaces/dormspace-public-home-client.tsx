"use client";

import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";
import type { UniversityRow } from "@/lib/universities";
import { DormspacePublicHome } from "@/components/dormspaces/dormspace-public-home";
import { useDormspaceListings } from "@/hooks/use-dormspace-listings";

export function DormspacePublicHomeClient({
  initialListings,
  initialUniversities,
  initialFeaturedNeighborhoods,
  initialUniversityId = "",
  initialNeighborhood = "",
}: {
  initialListings: DormspaceWithPhotos[];
  initialUniversities: UniversityRow[];
  initialFeaturedNeighborhoods: DormspacePopularArea[];
  initialUniversityId?: string;
  initialNeighborhood?: string;
}) {
  const { data: listings = initialListings } = useDormspaceListings(initialListings);
  return (
    <DormspacePublicHome
      listings={listings}
      universities={initialUniversities}
      initialFeaturedNeighborhoods={initialFeaturedNeighborhoods}
      initialUniversityId={initialUniversityId}
      initialNeighborhood={initialNeighborhood}
    />
  );
}
