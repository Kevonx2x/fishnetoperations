"use client";

import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";

/** @deprecated Prefer `useDormspaceEngagement` for likes + saves. */
export function useDormspaceLikes() {
  const { mayEngage, likedIds, isLiked, toggleLike, loading } = useDormspaceEngagement();
  return {
    dbIds: likedIds,
    mayLike: mayEngage,
    isLiked,
    toggleLike,
    loading,
  };
}
