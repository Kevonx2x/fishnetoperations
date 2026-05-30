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
  const hasSeed = options?.fallbackData != null;
  return useSWR<HomepagePropertiesResult>(
    key,
    () =>
      fetchHomepageProperties({
        neighborhoodFilter: args.neighborhoodFilter,
        listingTypeFilter: args.listingTypeFilter,
      }),
    {
      revalidateOnMount: !hasSeed,
      fallbackData: options?.fallbackData,
      keepPreviousData: true,
    },
  );
}

export function useHomepageAgentsDirectory(options?: { isPaused?: boolean }) {
  return useSWR<HomepageAgentsResult>("homepage-agents", fetchHomepageAgentsDirectory, {
    isPaused: () => options?.isPaused ?? false,
  });
}

export function useFeaturedLocationCounts(
  args: {
    mode: "buy" | "rent" | "all";
    listingTypeFilter: "sale" | "rent" | null;
  },
  options?: { isPaused?: boolean },
) {
  const key = ["homepage-featured-location-counts", args.mode, args.listingTypeFilter] as const;
  return useSWR<Record<string, number>>(key, () => fetchFeaturedLocationCounts(args), {
    isPaused: () => options?.isPaused ?? false,
  });
}
