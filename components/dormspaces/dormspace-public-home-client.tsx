"use client";

import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { DormspacePublicHome } from "@/components/dormspaces/dormspace-public-home";
import { useDormspaceListings } from "@/hooks/use-dormspace-listings";

export function DormspacePublicHomeClient({
  initialListings,
}: {
  initialListings: DormspaceWithPhotos[];
}) {
  const { data: listings = initialListings } = useDormspaceListings(initialListings);
  return <DormspacePublicHome listings={listings} />;
}
