import { useEffect, useMemo, useState } from "react";

import { fetchPropertySummary, type PropertySummary } from "@/lib/services/property-summary";

/**
 * Fetches and caches property summary data for the active conversation's property id.
 *
 * Important: Stream mutates channel objects in-place, so callers must pass stable primitives
 * (e.g. `channel?.cid`, `propertyId`) and never the channel object itself.
 */
export function usePropertySummary(params: { channelCid: string | null; propertyIdRaw: string | null | undefined }) {
  const propertyId = useMemo(
    () => (params.propertyIdRaw ?? "").trim() || null,
    [params.propertyIdRaw],
  );
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
  }, [params.channelCid, hasCached, propertyId]);

  return { propertyId, summary, loading };
}

