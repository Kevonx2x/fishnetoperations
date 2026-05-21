"use client";

import { Bookmark, Heart } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import { cn } from "@/lib/utils";

type Props = {
  dormspaceId: string;
  landlordUserId?: string | null;
  signInNext?: string;
  size?: "sm" | "md";
  className?: string;
  hideWhenBlocked?: boolean;
};

export function DormspaceEngagementButtons({
  dormspaceId,
  landlordUserId,
  signInNext,
  size = "md",
  className,
  hideWhenBlocked = true,
}: Props) {
  const { user } = useAuth();
  const { mayEngage, isLiked, isSaved, toggleLike, toggleSave } = useDormspaceEngagement();

  if (isOwnDormspaceListing(user?.id, landlordUserId)) return null;
  if (hideWhenBlocked && !mayEngage) return null;

  const liked = isLiked(dormspaceId);
  const saved = isSaved(dormspaceId);
  const iconSize = size === "md" ? "size-5" : "size-4";
  const btnSize = size === "md" ? "size-10" : "size-8";

  const btnClass = (active: boolean, activeRing: string) =>
    cn(
      "inline-flex shrink-0 items-center justify-center rounded-lg border bg-white transition",
      active
        ? activeRing
        : "border-[#2C2C2C]/12 text-[#888888] hover:border-[#6B9E6E]/40 hover:text-[#6B9E6E]",
      btnSize,
    );

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <button
        type="button"
        className={btnClass(liked, "border-red-200 text-red-500")}
        aria-label={liked ? "Remove from liked" : "Add to liked"}
        aria-pressed={liked}
        title={mayEngage ? (liked ? "Unlike" : "Like") : "Sign in to like"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggleLike(dormspaceId, { signInNext, landlordUserId });
        }}
      >
        <Heart
          className={cn(iconSize, liked ? "fill-red-500 text-red-500" : "fill-none")}
          aria-hidden
        />
      </button>
      <button
        type="button"
        className={btnClass(saved, "border-[#D4A843]/40 text-[#8a6d32]")}
        aria-label={saved ? "Remove from saved" : "Save listing"}
        aria-pressed={saved}
        title={mayEngage ? (saved ? "Unsave" : "Save") : "Sign in to save"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggleSave(dormspaceId, { signInNext, landlordUserId });
        }}
      >
        <Bookmark
          className={cn(iconSize, saved ? "fill-[#D4A843] text-[#D4A843]" : "fill-none")}
          aria-hidden
        />
      </button>
    </div>
  );
}
