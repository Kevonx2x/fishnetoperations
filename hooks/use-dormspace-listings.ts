"use client";

import useSWR from "swr";

import { fetchDormspaceListings } from "@/lib/dormspace-listings-fetcher";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";

export function useDormspaceListings(initialData?: DormspaceWithPhotos[]) {
  return useSWR<DormspaceWithPhotos[]>("dormspace-listings", fetchDormspaceListings, {
    fallbackData: initialData,
  });
}
