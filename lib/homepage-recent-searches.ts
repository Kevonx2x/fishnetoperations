"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bahaygo:homepage-recent-searches";
const MAX_RECENT = 3;
const RECENT_EVENT = "bahaygo:homepage-recent-searches";

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeRecentSearches(queries: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queries.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota / private mode
  }
}

/** Persist a hero search query (most recent first, max 3). */
export function recordHomepageRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return;
  const prev = readRecentSearches();
  const next = [trimmed, ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  writeRecentSearches(next);
  window.dispatchEvent(new CustomEvent(RECENT_EVENT));
}

/** Last few homepage location searches for the hero autocomplete. */
export function useRecentHomepageSearches(): { queries: string[] } {
  const [queries, setQueries] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setQueries(readRecentSearches());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(RECENT_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(RECENT_EVENT, onCustom);
    };
  }, [refresh]);

  return { queries };
}
