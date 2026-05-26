"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import { cn } from "@/lib/utils";

const FLOATING_BTN =
  "flex size-10 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/10 transition hover:bg-white";

type Props = {
  dormspaceId: string;
  landlordUserId?: string | null;
  title: string;
  backHref?: string;
};

export function DormspaceDetailHeroChrome({
  dormspaceId,
  landlordUserId,
  title,
  backHref = "/dormspaces",
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { mayEngage, isLiked, toggleLike } = useDormspaceEngagement();

  const ownListing = isOwnDormspaceListing(user?.id, landlordUserId);
  const liked = isLiked(dormspaceId);
  const showHeart = !ownListing && (mayEngage || user);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // user cancelled share
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 md:hidden">
      <button
        type="button"
        className={cn(FLOATING_BTN, "pointer-events-auto")}
        aria-label="Go back"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push(backHref);
        }}
      >
        <ChevronLeft className="size-5 text-[#2C2C2C]" aria-hidden />
      </button>
      <div className="pointer-events-auto flex items-center gap-2">
        <button type="button" className={FLOATING_BTN} aria-label="Share listing" onClick={() => void handleShare()}>
          <Share2 className="size-[18px] text-[#2C2C2C]" aria-hidden />
        </button>
        {showHeart ? (
          <button
            type="button"
            className={cn(
              FLOATING_BTN,
              liked && "ring-2 ring-red-200",
            )}
            aria-label={liked ? "Remove from liked" : "Add to liked"}
            aria-pressed={liked}
            onClick={() => void toggleLike(dormspaceId, { signInNext: `/dormspaces/${dormspaceId}`, landlordUserId })}
          >
            <Heart
              className={cn("size-5", liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]")}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Desktop breadcrumb back link. */
export function DormspaceDetailBackLink({ href = "/dormspaces" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 hidden items-center gap-1 text-sm font-semibold text-[#6B9E6E] hover:underline md:inline-flex"
    >
      ← All dormspaces
    </Link>
  );
}
