"use client";

import useSWR from "swr";

import { fetchDormspaceFeaturedNeighborhoods } from "@/lib/dormspace-featured-neighborhoods-fetcher";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";

export function useDormspaceFeaturedNeighborhoods(initialData?: DormspacePopularArea[]) {
  return useSWR<DormspacePopularArea[]>("dormspace-featured-neighborhoods", fetchDormspaceFeaturedNeighborhoods, {
    fallbackData: initialData,
    revalidateOnMount: !initialData?.length,
  });
}
