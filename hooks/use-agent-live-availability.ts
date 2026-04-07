"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DbProperty } from "@/lib/marketplace-property";
import type { MarketplaceAgent } from "@/lib/marketplace-types";

/**
 * Fetches current `agents.availability` and `updated_at` for all agent ids seen on
 * properties (plus optional extra ids, e.g. directory). Merges onto marketplace agents
 * so UI reflects the live `agents` row, not only nested join snapshots.
 */
export function useAgentLiveAvailabilityFromPropertyRows(
  properties: DbProperty[],
  extraAgentIds: readonly string[] = [],
) {
  const [liveAgentAvailabilityById, setLiveAgentAvailabilityById] = useState<
    Record<string, { availability: string; updatedAt: string }>
  >({});

  const idKey = useMemo(() => {
    const ids = new Set<string>();
    for (const p of properties) {
      for (const x of p.property_agents ?? []) {
        const aid = (x as { agent?: { id?: string | null } }).agent?.id;
        if (aid) ids.add(aid);
      }
    }
    for (const id of extraAgentIds) {
      if (id) ids.add(id);
    }
    return [...ids].sort().join(",");
  }, [properties, extraAgentIds]);

  useEffect(() => {
    const ids = idKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setLiveAgentAvailabilityById({});
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("id, availability, updated_at")
      .in("id", ids)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const next: Record<string, { availability: string; updatedAt: string }> = {};
        for (const row of data as { id: string; availability?: string | null; updated_at?: string | null }[]) {
          next[row.id] = {
            availability: row.availability == null ? "" : String(row.availability),
            updatedAt: row.updated_at == null ? "" : String(row.updated_at),
          };
        }
        setLiveAgentAvailabilityById(next);
      });
    return () => {
      cancelled = true;
    };
  }, [idKey]);

  const mergeLiveAvailability = useCallback(
    (a: MarketplaceAgent): MarketplaceAgent => {
      const live = liveAgentAvailabilityById[a.id];
      if (!live) return a;
      return { ...a, availability: live.availability, updatedAt: live.updatedAt };
    },
    [liveAgentAvailabilityById],
  );

  return mergeLiveAvailability;
}
