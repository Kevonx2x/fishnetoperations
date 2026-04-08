"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "bahaygo_saved_properties_v1";
/** Legacy key — merged when loading wishlist */
const LEGACY_KEY = "savedProperties";

function parseIdArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIdArray(window.localStorage.getItem(KEY));
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event("bahaygo:saved-properties"));
  } catch {
    // ignore
  }
}

/** All locally stored saved property IDs (primary + legacy key), de-duplicated. */
export function readAllLocalSavedPropertyIds(): string[] {
  if (typeof window === "undefined") return [];
  const a = parseIdArray(window.localStorage.getItem(KEY));
  const b = parseIdArray(window.localStorage.getItem(LEGACY_KEY));
  return [...new Set([...a, ...b])];
}

/** Remove one id from primary local storage list (and legacy if present). */
export function removeSavedPropertyIdLocal(id: string) {
  if (typeof window === "undefined") return;
  try {
    const ids = readIds().filter((x) => x !== id);
    writeIds(ids);
    const legacy = parseIdArray(window.localStorage.getItem(LEGACY_KEY)).filter((x) => x !== id);
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    window.dispatchEvent(new Event("bahaygo:saved-properties"));
  } catch {
    // ignore
  }
}

export function toggleSavedPropertyId(id: string) {
  const ids = readIds();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
  writeIds(next);
}

export function isSavedPropertyId(id: string): boolean {
  return readIds().includes(id);
}

export function useSavedPropertyIds() {
  const [ids, setIds] = useState<string[]>(() => readIds());

  useEffect(() => {
    const onChange = () => setIds(readIds());
    window.addEventListener("storage", onChange);
    window.addEventListener("bahaygo:saved-properties", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("bahaygo:saved-properties", onChange);
    };
  }, []);

  const toggle = useCallback((id: string) => toggleSavedPropertyId(id), []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return useMemo(() => ({ ids, toggle, has }), [ids, toggle, has]);
}

