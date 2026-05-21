"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import {
  canLikeDormspaces,
  dormspaceLikeSignInPath,
  ONLY_SEEKERS_CAN_LIKE_DORMS,
} from "@/lib/dormspace-engagement";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useDormspaceLikes() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [dbIds, setDbIds] = useState<string[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());

  const mayLike = canLikeDormspaces(profile?.role);

  useEffect(() => {
    if (!user?.id || !mayLike) {
      setDbIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("dormspace_likes")
        .select("dormspace_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      setDbIds((data ?? []).map((r: { dormspace_id: string }) => r.dormspace_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, mayLike, supabase]);

  const isLiked = useCallback(
    (id: string) => (user?.id && mayLike ? dbIds.includes(id) : false),
    [dbIds, user?.id, mayLike],
  );

  const toggleLike = useCallback(
    async (dormspaceId: string, options?: { signInNext?: string }) => {
      if (pendingRef.current.has(dormspaceId)) return false;
      pendingRef.current.add(dormspaceId);
      try {
        if (!user?.id) {
          const next = options?.signInNext ?? (typeof window !== "undefined" ? window.location.pathname : "/dormspaces");
          router.push(dormspaceLikeSignInPath(next));
          return false;
        }
        if (authLoading || !profile) return false;
        if (!mayLike) {
          toast.error(ONLY_SEEKERS_CAN_LIKE_DORMS);
          return false;
        }

        if (dbIds.includes(dormspaceId)) {
          const { error } = await supabase
            .from("dormspace_likes")
            .delete()
            .eq("user_id", user.id)
            .eq("dormspace_id", dormspaceId);
          if (error) {
            toast.error("Could not remove like");
            return false;
          }
          setDbIds((prev) => prev.filter((id) => id !== dormspaceId));
          return true;
        }

        const { error } = await supabase.from("dormspace_likes").insert({
          user_id: user.id,
          dormspace_id: dormspaceId,
        });
        if (error) {
          toast.error("Could not save like");
          return false;
        }
        setDbIds((prev) => [...prev, dormspaceId]);
        return true;
      } finally {
        pendingRef.current.delete(dormspaceId);
      }
    },
    [user?.id, authLoading, profile, mayLike, dbIds, supabase, router],
  );

  return {
    dbIds,
    mayLike,
    isLiked,
    toggleLike,
    loading: authLoading,
  };
}
