"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { excludeOwnDormspaceEngagementIds } from "@/lib/dormspace-engagement-filter";
import {
  canLikeDormspaces,
  CANNOT_SAVE_OWN_DORMSPACE,
  dormspaceLikeSignInPath,
  isOwnDormspaceListing,
  ONLY_SEEKERS_CAN_LIKE_DORMS,
} from "@/lib/dormspace-engagement";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useDormspaceEngagement() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());

  const mayEngage = canLikeDormspaces(profile?.role);

  useEffect(() => {
    if (!user?.id || !mayEngage) {
      setLikedIds([]);
      setSavedIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [likesRes, savesRes] = await Promise.all([
        supabase.from("dormspace_likes").select("dormspace_id").eq("user_id", user.id),
        supabase.from("dormspace_saves").select("dormspace_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const rawLikes = (likesRes.data ?? []).map((r: { dormspace_id: string }) => r.dormspace_id);
      const rawSaves = (savesRes.data ?? []).map((r: { dormspace_id: string }) => r.dormspace_id);
      const [filteredLikes, filteredSaves] = await Promise.all([
        excludeOwnDormspaceEngagementIds(supabase, user.id, rawLikes),
        excludeOwnDormspaceEngagementIds(supabase, user.id, rawSaves),
      ]);
      if (cancelled) return;
      setLikedIds(filteredLikes);
      setSavedIds(filteredSaves);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, mayEngage, supabase]);

  const requireSignedIn = useCallback(
    (signInNext?: string) => {
      if (user?.id) return true;
      const next = signInNext ?? (typeof window !== "undefined" ? window.location.pathname : "/dormspaces");
      toast.message("Sign in to like/save");
      router.push(dormspaceLikeSignInPath(next));
      return false;
    },
    [user?.id, router],
  );

  const guardEngage = useCallback(() => {
    if (!mayEngage) {
      toast.error(ONLY_SEEKERS_CAN_LIKE_DORMS);
      return false;
    }
    if (authLoading || !profile) return false;
    return true;
  }, [mayEngage, authLoading, profile]);

  const isLiked = useCallback(
    (id: string) => (user?.id && mayEngage ? likedIds.includes(id) : false),
    [likedIds, user?.id, mayEngage],
  );

  const isSaved = useCallback(
    (id: string) => (user?.id && mayEngage ? savedIds.includes(id) : false),
    [savedIds, user?.id, mayEngage],
  );

  const toggleLike = useCallback(
    async (
      dormspaceId: string,
      options?: { signInNext?: string; landlordUserId?: string | null },
    ) => {
      if (pendingRef.current.has(`like:${dormspaceId}`)) return false;
      pendingRef.current.add(`like:${dormspaceId}`);
      try {
        if (!requireSignedIn(options?.signInNext)) return false;
        if (!guardEngage()) return false;
        if (isOwnDormspaceListing(user?.id, options?.landlordUserId)) {
          return false;
        }

        if (likedIds.includes(dormspaceId)) {
          const { error } = await supabase
            .from("dormspace_likes")
            .delete()
            .eq("user_id", user!.id)
            .eq("dormspace_id", dormspaceId);
          if (error) {
            toast.error("Could not remove like");
            return false;
          }
          setLikedIds((prev) => prev.filter((id) => id !== dormspaceId));
          return true;
        }

        const res = await fetch("/api/dormspaces/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dormspace_id: dormspaceId }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok) {
          toast.error(json.error?.message ?? "Could not save like");
          return false;
        }
        setLikedIds((prev) => (prev.includes(dormspaceId) ? prev : [...prev, dormspaceId]));
        return true;
      } finally {
        pendingRef.current.delete(`like:${dormspaceId}`);
      }
    },
    [requireSignedIn, guardEngage, likedIds, supabase, user],
  );

  const toggleSave = useCallback(
    async (
      dormspaceId: string,
      options?: { signInNext?: string; landlordUserId?: string | null },
    ) => {
      if (pendingRef.current.has(`save:${dormspaceId}`)) return false;
      pendingRef.current.add(`save:${dormspaceId}`);
      try {
        if (!requireSignedIn(options?.signInNext)) return false;
        if (!guardEngage()) return false;
        if (isOwnDormspaceListing(user?.id, options?.landlordUserId)) {
          return false;
        }

        if (savedIds.includes(dormspaceId)) {
          const { error } = await supabase
            .from("dormspace_saves")
            .delete()
            .eq("user_id", user!.id)
            .eq("dormspace_id", dormspaceId);
          if (error) {
            toast.error("Could not remove save");
            return false;
          }
          setSavedIds((prev) => prev.filter((id) => id !== dormspaceId));
          return true;
        }

        const res = await fetch("/api/dormspaces/saves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dormspace_id: dormspaceId }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok) {
          const msg = json.error?.message ?? "Could not save listing";
          if (msg !== CANNOT_SAVE_OWN_DORMSPACE) toast.error(msg);
          return false;
        }
        setSavedIds((prev) => (prev.includes(dormspaceId) ? prev : [...prev, dormspaceId]));
        return true;
      } finally {
        pendingRef.current.delete(`save:${dormspaceId}`);
      }
    },
    [requireSignedIn, guardEngage, savedIds, supabase, user],
  );

  return {
    mayEngage,
    likedIds,
    savedIds,
    isLiked,
    isSaved,
    isOwnListing: (landlordUserId: string | null | undefined) =>
      isOwnDormspaceListing(user?.id, landlordUserId),
    toggleLike,
    toggleSave,
    loading: authLoading,
  };
}
