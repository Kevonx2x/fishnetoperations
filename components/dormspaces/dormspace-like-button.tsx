"use client";

import { Heart } from "lucide-react";

import { useDormspaceLikes } from "@/hooks/use-dormspace-likes";
import { cn } from "@/lib/utils";

type Props = {
  dormspaceId: string;
  signInNext?: string;
  size?: "sm" | "md";
  className?: string;
  /** Hide entirely for landlords / staff (no disabled stub). */
  hideWhenBlocked?: boolean;
};

export function DormspaceLikeButton({
  dormspaceId,
  signInNext,
  size = "sm",
  className,
  hideWhenBlocked = true,
}: Props) {
  const { mayLike, isLiked, toggleLike } = useDormspaceLikes();

  if (hideWhenBlocked && !mayLike) return null;

  const liked = isLiked(dormspaceId);
  const iconSize = size === "md" ? "size-5" : "size-4";
  const btnSize = size === "md" ? "size-10" : "size-8";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border bg-white transition",
        liked ? "border-red-200 text-red-500" : "border-[#2C2C2C]/12 text-[#888888] hover:border-[#6B9E6E]/40 hover:text-[#6B9E6E]",
        btnSize,
        className,
      )}
      aria-label={liked ? "Remove from liked" : "Add to liked"}
      aria-pressed={liked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleLike(dormspaceId, { signInNext });
      }}
    >
      <Heart
        className={cn(iconSize, liked ? "fill-red-500 text-red-500" : "fill-none")}
        aria-hidden
      />
    </button>
  );
}
