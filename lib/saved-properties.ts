"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const KEY = "fishnet_saved_properties_v1";

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
    window.dispatchEvent(new Event("fishnet:saved-properties"));
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
    window.addEventListener("fishnet:saved-properties", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("fishnet:saved-properties", onChange);
    };
  }, []);

  const toggle = useCallback((id: string) => toggleSavedPropertyId(id), []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return useMemo(() => ({ ids, toggle, has }), [ids, toggle, has]);
}

