"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useOpenEngagementSignIn } from "@/contexts/engagement-signin-context";

/** Stable comma-separated sorted ids — avoids effect loops when `properties` is a new array reference each render. */
function propertyIdsDependencyKey(properties: readonly { id: string }[]): string {
  if (!properties.length) return "";
  return [...properties.map((p) => p.id)].sort().join(",");
}

/** Minimal shape for “does this agent represent this listing?” checks. */
export type PropertyEngagementSource = {
  id: string;
  listed_by?: string | null;
  property_agents?: { agent?: unknown }[] | null;
};

/** Heart (like) + pin (saved_properties) UI contract for property cards and modals. */
export type PropertyEngagement = {
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => void | Promise<void>;
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void | Promise<void>;
  likeCount: (id: string) => number;
  saveCount: (id: string) => number;
  /** When false (agents viewing others’ listings), hide aggregate like/pin counts in the UI. */
  showEngagementCounts: (id: string) => boolean;
};

export const ONLY_CLIENTS_CAN_LIKE_OR_PIN = "Only clients can like or pin properties";

function notifyPropertyEngagement(args: {
  propertyId: string;
  type: "like" | "pin";
  clientName: string;
}) {
  void fetch("/api/notify-property-engagement", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  }).catch(() => {});
}

function isClientRole(role: string | null | undefined): boolean {
  return role === "client";
}

function agentRepresentsListing(
  viewerUserId: string,
  viewerAgentRecordId: string | null,
  row: PropertyEngagementSource,
): boolean {
  if (row.listed_by === viewerUserId) return true;
  if (!viewerAgentRecordId) return false;
  for (const pa of row.property_agents ?? []) {
    const ag = pa?.agent;
    const aid =
      ag && typeof ag === "object" && "id" in ag ? String((ag as { id?: string }).id ?? "") : "";
    if (aid && aid === viewerAgentRecordId) return true;
  }
  return false;
}

/** Heart / like — `property_likes` when signed-in client only. */
export function usePropertyLikes() {
  const { user, profile, loading: authLoading } = useAuth();
  const openSignIn = useOpenEngagementSignIn();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [dbIds, setDbIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id || !isClientRole(profile?.role)) {
      setDbIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("property_likes")
        .select("property_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      setDbIds((data ?? []).map((r: { property_id: string }) => r.property_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, supabase]);

  const has = useCallback(
    (id: string) =>
      user?.id && profile && isClientRole(profile.role) ? dbIds.includes(id) : false,
    [dbIds, user?.id, profile],
  );

  const toggle = useCallback(
    async (propertyId: string): Promise<boolean> => {
      if (!user?.id) {
        openSignIn();
        return false;
      }
      if (authLoading || !profile) return false;
      if (!isClientRole(profile.role)) {
        toast.error(ONLY_CLIENTS_CAN_LIKE_OR_PIN);
        return false;
      }

      if (dbIds.includes(propertyId)) {
        const { data: existing } = await supabase
          .from("property_likes")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("property_id", propertyId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("property_likes")
            .delete()
            .eq("user_id", user.id)
            .eq("property_id", propertyId);
          if (error) {
            toast.error(error.message);
            return false;
          }
        }
        setDbIds((prev) => prev.filter((x) => x !== propertyId));
        return true;
      }
      const { error } = await supabase.from("property_likes").upsert(
        { user_id: user.id, property_id: propertyId },
        { onConflict: "user_id,property_id", ignoreDuplicates: true },
      );
      if (error) {
        toast.error(error.message);
        return false;
      }
      setDbIds((prev) => (prev.includes(propertyId) ? prev : [propertyId, ...prev]));
      notifyPropertyEngagement({
        propertyId,
        type: "like",
        clientName: profile?.full_name?.trim() || "Someone",
      });
      return true;
    },
    [user?.id, supabase, dbIds, profile, profile?.full_name, profile?.role, authLoading, openSignIn],
  );

  return { has, toggle, dbIds };
}

/** Pin / wishlist — `saved_properties` only; clients only. */
export function usePinnedPropertyIds() {
  const { user, profile, loading: authLoading } = useAuth();
  const openSignIn = useOpenEngagementSignIn();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id || !isClientRole(profile?.role)) {
      setIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("saved_properties")
        .select("property_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      setIds((data ?? []).map((r: { property_id: string }) => r.property_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, supabase]);

  const has = useCallback(
    (id: string) =>
      user?.id && profile && isClientRole(profile.role) ? ids.includes(id) : false,
    [ids, user?.id, profile],
  );

  const toggle = useCallback(
    async (propertyId: string): Promise<boolean> => {
      if (!user?.id) {
        openSignIn();
        return false;
      }
      if (authLoading || !profile) return false;
      if (!isClientRole(profile.role)) {
        toast.error(ONLY_CLIENTS_CAN_LIKE_OR_PIN);
        return false;
      }

      if (ids.includes(propertyId)) {
        const { data: existing } = await supabase
          .from("saved_properties")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("property_id", propertyId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("saved_properties")
            .delete()
            .eq("user_id", user.id)
            .eq("property_id", propertyId);
          if (error) {
            toast.error(error.message);
            return false;
          }
        }
        setIds((prev) => prev.filter((x) => x !== propertyId));
        return true;
      }
      const { error } = await supabase.from("saved_properties").upsert(
        { user_id: user.id, property_id: propertyId },
        { onConflict: "user_id,property_id", ignoreDuplicates: true },
      );
      if (error) {
        toast.error(error.message);
        return false;
      }
      setIds((prev) => (prev.includes(propertyId) ? prev : [propertyId, ...prev]));
      notifyPropertyEngagement({
        propertyId,
        type: "pin",
        clientName: profile?.full_name?.trim() || "Someone",
      });
      return true;
    },
    [user?.id, supabase, ids, profile, profile?.full_name, profile?.role, authLoading, openSignIn],
  );

  return { has, toggle, ids };
}

/**
 * Batch like/save counts + heart/pin toggles for listing pages (homepage, landmarks, etc.).
 * RPCs: `property_like_counts_for(property_ids uuid[])`, `property_save_counts_for(property_ids uuid[])`.
 */
export function usePropertyEngagementForProperties(
  properties: readonly PropertyEngagementSource[],
): {
  engagement: PropertyEngagement;
  likeCountsByPropertyId: Record<string, number>;
  saveCountsByPropertyId: Record<string, number>;
} {
  const { user, profile } = useAuth();
  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [likeCountBias, setLikeCountBias] = useState<Record<string, number>>({});
  const [saveCountBias, setSaveCountBias] = useState<Record<string, number>>({});
  const [viewerAgentRecordId, setViewerAgentRecordId] = useState<string | null>(null);

  const propertyIdsKey = propertyIdsDependencyKey(properties);

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyEngagementSource>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  useEffect(() => {
    if (!user?.id || profile?.role !== "agent") {
      setViewerAgentRecordId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("agents").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      const id = (data as { id?: string } | null)?.id;
      setViewerAgentRecordId(id ? String(id) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, supabase]);

  useEffect(() => {
    if (!propertyIdsKey) {
      setLikeCounts({});
      setSaveCounts({});
      setLikeCountBias({});
      setSaveCountBias({});
      return;
    }
    const ids = propertyIdsKey.split(",");
    let cancelled = false;
    void (async () => {
      const [lc, sc] = await Promise.all([
        supabase.rpc("property_like_counts_for", { property_ids: ids }),
        supabase.rpc("property_save_counts_for", { property_ids: ids }),
      ]);
      if (cancelled) return;

      if (lc.error) {
        console.error("[usePropertyEngagementForProperties] property_like_counts_for", lc.error);
      }
      if (sc.error) {
        console.error("[usePropertyEngagementForProperties] property_save_counts_for", sc.error);
      }

      const lm: Record<string, number> = {};
      for (const row of (lc.data ?? []) as { property_id: string; like_count: number }[]) {
        lm[row.property_id] = Number(row.like_count);
      }
      const sm: Record<string, number> = {};
      for (const row of (sc.data ?? []) as { property_id: string; save_count: number }[]) {
        sm[row.property_id] = Number(row.save_count);
      }
      setLikeCounts(lm);
      setSaveCounts(sm);
      setLikeCountBias({});
      setSaveCountBias({});
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyIdsKey, supabase]);

  const showEngagementCounts = useCallback(
    (propertyId: string) => {
      if (profile?.role !== "agent" || !user?.id) return true;
      const row = propertyById.get(propertyId);
      if (!row) return false;
      return agentRepresentsListing(user.id, viewerAgentRecordId, row);
    },
    [profile?.role, user?.id, viewerAgentRecordId, propertyById],
  );

  const toggleLikeWrapped = useCallback(
    async (propertyId: string) => {
      const wasLiked = likes.has(propertyId);
      const ok = await likes.toggle(propertyId);
      if (!ok) return;
      setLikeCountBias((prev) => ({
        ...prev,
        [propertyId]: (prev[propertyId] ?? 0) + (wasLiked ? -1 : 1),
      }));
    },
    [likes],
  );

  const togglePinWrapped = useCallback(
    async (propertyId: string) => {
      const wasPinned = pins.has(propertyId);
      const ok = await pins.toggle(propertyId);
      if (!ok) return;
      setSaveCountBias((prev) => ({
        ...prev,
        [propertyId]: (prev[propertyId] ?? 0) + (wasPinned ? -1 : 1),
      }));
    },
    [pins],
  );

  const engagement = useMemo(
    () => ({
      isLiked: (id: string) => likes.has(id),
      toggleLike: (id: string) => {
        void toggleLikeWrapped(id);
      },
      isPinned: (id: string) => pins.has(id),
      togglePin: (id: string) => {
        void togglePinWrapped(id);
      },
      likeCount: (id: string) => (likeCounts[id] ?? 0) + (likeCountBias[id] ?? 0),
      saveCount: (id: string) => (saveCounts[id] ?? 0) + (saveCountBias[id] ?? 0),
      showEngagementCounts,
    }),
    [
      likes,
      pins,
      likeCounts,
      saveCounts,
      likeCountBias,
      saveCountBias,
      toggleLikeWrapped,
      togglePinWrapped,
      showEngagementCounts,
    ],
  );

  return { engagement, likeCountsByPropertyId: likeCounts, saveCountsByPropertyId: saveCounts };
}
