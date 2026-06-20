"use client";

import useSWR from "swr";

import { fetchSavedListings, type SavedListingEntry } from "@/lib/saved-listings-fetcher";

export function useSavedListings(userId: string | null | undefined) {
  return useSWR<SavedListingEntry[]>(
    userId ? (["saved-listings", userId] as const) : null,
    () => fetchSavedListings(userId!),
    { keepPreviousData: false },
  );
}
