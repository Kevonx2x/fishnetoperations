"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";

import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { MobileSheetPortal } from "@/components/mobile/mobile-sheet-portal";
import { SearchMapSwipeCard } from "@/components/search/search-map-swipe-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPropertyFloorAreaDisplay } from "@/lib/format-property-floor-area";
import {
  searchMapPropertyLocationLine,
  searchMapPropertyPhotoUrl,
  searchMapPropertyPriceLabel,
  type SearchMapProperty,
} from "@/lib/search-map-markers";
import { cn } from "@/lib/utils";

const SWIPE_DISMISS_PX = 72;

type Props = {
  property: SearchMapProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSwipeNext: boolean;
  canSwipePrevious: boolean;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
};

export function SearchMapBottomSheet({
  property,
  open,
  onOpenChange,
  canSwipeNext,
  canSwipePrevious,
  onSwipeNext,
  onSwipePrevious,
  isLiked,
  onToggleLike,
}: Props) {
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

  const photoUrl = property ? searchMapPropertyPhotoUrl(property) : "";
  const priceLabel = property ? searchMapPropertyPriceLabel(property) : "";
  const locationLine = property ? searchMapPropertyLocationLine(property) : "";
  const bedsLabel =
    property?.beds === 0
      ? "Studio"
      : property?.beds === 1
        ? "1 bed"
        : `${property?.beds ?? 0} beds`;
  const bathsLabel =
    property?.baths === 1 ? "1 bath" : `${property?.baths ?? 0} baths`;
  const floorAreaLabel = property ? formatPropertyFloorAreaDisplay(property.sqft) : "";
  const detailHref = property ? `/properties/${encodeURIComponent(property.id)}` : "#";

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

          <SheetTitle className="sr-only">
            {property?.title ?? "Property details"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Map search listing preview
          </SheetDescription>

          {property ? (
            <SearchMapSwipeCard
              canSwipeNext={canSwipeNext}
              canSwipePrevious={canSwipePrevious}
              onSwipeNext={onSwipeNext}
              onSwipePrevious={onSwipePrevious}
            >
              <div
                key={property.id}
                className="flex min-h-0 flex-1 flex-col px-4 pb-1 animate-in fade-in duration-150"
              >
                <Link href={detailHref} className="flex min-h-0 flex-1 flex-col active:opacity-95">
                  <div className="relative h-[150px] w-full shrink-0 overflow-hidden rounded-xl bg-[#F3F0EA]">
                    {photoUrl ? (
                      <ListingCardPhoto src={photoUrl} alt="" sizes="92vw" eager priority />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#d8e4da]" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleLike();
                      }}
                      className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/[0.06]"
                      aria-label={isLiked ? "Remove from saved" : "Save property"}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          isLiked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]/80",
                        )}
                        strokeWidth={2}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex min-h-0 flex-1 flex-col">
                    <p className="text-xl font-bold leading-tight text-[#6B9E6E]">{priceLabel}</p>
                    <h3 className="mt-1.5 line-clamp-1 font-sans text-[15px] font-medium leading-snug text-[#2C2C2C]">
                      {property.name?.trim() || property.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#888888]">
                      <MapPin className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
                      <span className="line-clamp-1">{locationLine}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#888888]">
                      {bedsLabel} · {bathsLabel} · {floorAreaLabel}
                    </p>
                  </div>
                </Link>

                <Link
                  href={detailHref}
                  className="mt-3 flex w-full shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E] px-4 py-3 text-sm font-semibold text-white shadow-sm active:bg-[#5d8a60]"
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
