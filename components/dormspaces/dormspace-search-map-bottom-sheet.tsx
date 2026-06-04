"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";

import { MobileSheetPortal } from "@/components/mobile/mobile-sheet-portal";
import { SearchMapSwipeCard } from "@/components/search/search-map-swipe-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import {
  dormspaceBedAvailability,
  dormspaceRoomTypeLabel,
} from "@/lib/dormspaces";
import {
  searchMapDormspaceLocationLine,
  searchMapDormspacePhotoUrl,
  searchMapDormspacePriceLabel,
  type SearchMapDormspace,
} from "@/lib/search-map-dormspace-markers";
import { cn } from "@/lib/utils";

const SWIPE_DISMISS_PX = 72;

type Props = {
  dormspace: SearchMapDormspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSwipeNext: boolean;
  canSwipePrevious: boolean;
  showSwipeArrows: boolean;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
};

export function DormspaceSearchMapBottomSheet({
  dormspace,
  open,
  onOpenChange,
  canSwipeNext,
  canSwipePrevious,
  showSwipeArrows,
  onSwipeNext,
  onSwipePrevious,
}: Props) {
  const { user } = useAuth();
  const { isLiked, toggleLike } = useDormspaceEngagement();
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragging = useRef(false);

  const resetDrag = useCallback(() => {
    dragStartY.current = null;
    dragging.current = false;
    setDragOffset(0);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetDrag();
      onOpenChange(next);
    },
    [onOpenChange, resetDrag],
  );

  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
    dragging.current = true;
  };

  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || dragStartY.current == null) return;
    const dy = (e.touches[0]?.clientY ?? dragStartY.current) - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  };

  const onHandleTouchEnd = () => {
    if (dragOffset >= SWIPE_DISMISS_PX) {
      handleOpenChange(false);
      return;
    }
    resetDrag();
  };

  const photoUrl = dormspace ? searchMapDormspacePhotoUrl(dormspace) : "";
  const priceLabel = dormspace ? searchMapDormspacePriceLabel(dormspace) : "";
  const locationLine = dormspace ? searchMapDormspaceLocationLine(dormspace) : "";
  const roomPill = dormspace ? dormspaceRoomTypeLabel(dormspace.room_type) : "";
  const bedLine = dormspace
    ? dormspaceBedAvailability({
        room_type: dormspace.room_type,
        total_beds: dormspace.total_beds,
        available_beds: dormspace.available_beds,
      }).shortLine
    : "";
  const detailHref = dormspace ? `/dormspaces/${encodeURIComponent(dormspace.id)}` : "#";
  const liked = dormspace ? isLiked(dormspace.id) : false;
  const showLikeButton =
    dormspace && !isOwnDormspaceListing(user?.id, dormspace.landlord_user_id);

  return (
    <MobileSheetPortal>
      <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          showOverlay={false}
          className={cn(
            "z-[100] flex max-h-[min(52dvh,460px)] flex-col gap-0 rounded-t-[18px] border-[#2C2C2C]/10 bg-[#FAF8F4] px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_rgba(44,44,44,0.14)]",
            "!bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:!bottom-0",
            "transition-none duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-open:animate-in data-closed:animate-out",
            "data-[side=bottom]:data-open:slide-in-from-bottom-full",
            "data-[side=bottom]:data-closed:slide-out-to-bottom-full",
          )}
          style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          <div
            className="mx-auto mb-2 h-1 w-10 shrink-0 cursor-grab rounded-full bg-[#2C2C2C]/18 active:cursor-grabbing"
            aria-hidden
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={onHandleTouchEnd}
          />

          <SheetTitle className="sr-only">{dormspace?.title ?? "Dorm listing"}</SheetTitle>
          <SheetDescription className="sr-only">Map search dorm preview</SheetDescription>

          {dormspace ? (
            <SearchMapSwipeCard
              canSwipeNext={canSwipeNext}
              canSwipePrevious={canSwipePrevious}
              onSwipeNext={onSwipeNext}
              onSwipePrevious={onSwipePrevious}
            >
              <div
                key={dormspace.id}
                className="flex min-h-0 flex-1 flex-col px-4 pb-1 animate-in fade-in duration-150"
              >
                <Link href={detailHref} className="flex min-h-0 flex-1 flex-col active:opacity-95">
                  <div className="relative h-[150px] w-full shrink-0 overflow-hidden rounded-xl bg-[#F3F0EA]">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="92vw"
                        priority
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#d8e4da]" />
                    )}

                    {roomPill ? (
                      <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-5rem)] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
                        {roomPill}
                      </span>
                    ) : null}

                    {showSwipeArrows ? (
                      <button
                        type="button"
                        aria-label="Previous nearby dorm"
                        disabled={!canSwipePrevious}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canSwipePrevious) onSwipePrevious();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute inset-y-0 left-0 z-20 flex w-10 items-center justify-center pl-0.5 active:opacity-80",
                          !canSwipePrevious && "pointer-events-none opacity-35",
                        )}
                      >
                        <ChevronLeft
                          className="size-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      </button>
                    ) : null}

                    {showSwipeArrows ? (
                      <button
                        type="button"
                        aria-label="Next nearby dorm"
                        disabled={!canSwipeNext}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canSwipeNext) onSwipeNext();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-center pr-0.5 active:opacity-80",
                          !canSwipeNext && "pointer-events-none opacity-35",
                        )}
                      >
                        <ChevronRight
                          className="size-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      </button>
                    ) : null}

                    {showLikeButton ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleLike(dormspace.id, {
                            landlordUserId: dormspace.landlord_user_id,
                          });
                        }}
                        className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/[0.06]"
                        aria-label={liked ? "Remove from liked" : "Like dorm"}
                      >
                        <Heart
                          className={cn(
                            "size-4",
                            liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]/80",
                          )}
                          strokeWidth={2}
                        />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex min-h-0 flex-1 flex-col">
                    <p className="font-sans text-xl font-bold leading-tight text-[#D4A843]">{priceLabel}</p>
                    <h3 className="mt-1.5 line-clamp-1 font-sans text-[15px] font-medium leading-snug text-[#2C2C2C]">
                      {dormspace.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1 font-sans text-xs font-medium text-[#888888]">
                      <MapPin className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
                      <span className="line-clamp-1">{locationLine}</span>
                    </p>
                    {bedLine ? (
                      <p className="mt-1 font-sans text-xs font-medium text-[#888888]">{bedLine}</p>
                    ) : null}
                  </div>
                </Link>

                <Link
                  href={detailHref}
                  className="mt-3 flex w-full shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E] px-4 py-3 font-sans text-sm font-semibold text-white shadow-sm active:bg-[#5d8a60]"
                >
                  View details
                </Link>
              </div>
            </SearchMapSwipeCard>
          ) : null}
        </SheetContent>
      </Sheet>
    </MobileSheetPortal>
  );
}
