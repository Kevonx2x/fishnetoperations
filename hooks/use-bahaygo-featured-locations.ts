"use client";

import useSWR from "swr";

import { fetchBahaygoFeaturedLocations } from "@/lib/bahaygo-featured-locations-fetcher";
import type { BahaygoFeaturedLocation } from "@/lib/bahaygo-featured-locations";

export function useBahaygoFeaturedLocations(initialData?: BahaygoFeaturedLocation[]) {
  return useSWR<BahaygoFeaturedLocation[]>("bahaygo-featured-locations", fetchBahaygoFeaturedLocations, {
    fallbackData: initialData,
    revalidateOnMount: !initialData?.length,
  });
}
