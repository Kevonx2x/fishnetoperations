import { useEffect, useMemo, useState } from "react";

import { fetchPropertySummary, type PropertySummary } from "@/lib/services/property-summary";

export function usePropertySummary(propertyIdRaw: string | null | undefined) {
  const propertyId = useMemo(() => (propertyIdRaw ?? "").trim() || null, [propertyIdRaw]);
  const [cache, setCache] = useState<Record<string, PropertySummary>>({});
  const summary = propertyId ? cache[propertyId] ?? null : null;
  const [loading, setLoading] = useState(false);
  const hasCached = Boolean(propertyId && cache[propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    if (hasCached) return;
    const ac = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const res = await fetchPropertySummary(propertyId, { signal: ac.signal });
        if (ac.signal.aborted) return;
        if (res.ok) setCache((prev) => ({ ...prev, [propertyId]: res.data }));
      } catch (err) {
        // AbortError is expected on fast nav/unmount; ignore it.
        if (err instanceof Error && err.name === "AbortError") return;
        // We intentionally don't console.error here; the UI can remain in a safe empty state.
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [hasCached, propertyId]);

  return { propertyId, summary, loading };
}

