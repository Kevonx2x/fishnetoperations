"use client";

import useSWR from "swr";

import {
  fetchFeaturedLocationCounts,
  fetchHomepageAgentsDirectory,
  fetchHomepageProperties,
  type HomepageAgentsResult,
  type HomepagePropertiesResult,
} from "@/lib/marketplace-home-fetchers";

export function useHomepageProperties(
  args: {
    neighborhoodFilter: string | null;
    listingTypeFilter: "sale" | "rent" | null;
  },
  options?: { fallbackData?: HomepagePropertiesResult },
) {
  const key = ["homepage-properties", args.neighborhoodFilter, args.listingTypeFilter] as const;
  return useSWR<HomepagePropertiesResult>(
    key,
    () =>
      fetchHomepageProperties({
        neighborhoodFilter: args.neighborhoodFilter,
        listingTypeFilter: args.listingTypeFilter,
      }),
    {
      revalidateOnMount: true,
      fallbackData: options?.fallbackData,
      keepPreviousData: true,
    },
  );
}

export function useHomepageAgentsDirectory() {
  return useSWR<HomepageAgentsResult>("homepage-agents", fetchHomepageAgentsDirectory);
}

export function useFeaturedLocationCounts(args: {
  mode: "buy" | "rent" | "all";
  listingTypeFilter: "sale" | "rent" | null;
}) {
  const key = ["homepage-featured-location-counts", args.mode, args.listingTypeFilter] as const;
  return useSWR<Record<string, number>>(key, () => fetchFeaturedLocationCounts(args));
}
