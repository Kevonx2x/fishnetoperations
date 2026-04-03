"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "bahaygo_recently_viewed_properties_v1";
const EVENT = "bahaygo:recently-viewed-properties";
const MAX = 12;

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore
  }
}

export function recordRecentlyViewedPropertyId(id: string) {
  const current = readIds();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX);
  writeIds(next);
}

export function useRecentlyViewedPropertyIds() {
  const [ids, setIds] = useState<string[]>(() => readIds());

  useEffect(() => {
    const onChange = () => setIds(readIds());
    window.addEventListener("storage", onChange);
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  const clear = useCallback(() => writeIds([]), []);

  return useMemo(() => ({ ids, clear }), [ids, clear]);
}

