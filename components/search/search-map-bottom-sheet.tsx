"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { MobileSheetPortal } from "@/components/mobile/mobile-sheet-portal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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
};

export function SearchMapBottomSheet({ property, open, onOpenChange }: Props) {
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

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || dragStartY.current == null) return;
    const dy = (e.touches[0]?.clientY ?? dragStartY.current) - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  };

  const onTouchEnd = () => {
    if (dragOffset >= SWIPE_DISMISS_PX) {
      handleOpenChange(false);
      return;
    }
    resetDrag();
  };

  const photoUrl = property ? searchMapPropertyPhotoUrl(property) : "";
  const priceLabel = property ? searchMapPropertyPriceLabel(property) : "";
  const locationLine = property ? searchMapPropertyLocationLine(property) : "";
  const bedsLabel = property?.beds === 0 ? "Studio" : `${property?.beds ?? 0} beds`;
  const detailHref = property ? `/properties/${encodeURIComponent(property.id)}` : "#";

  return (
    <MobileSheetPortal>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="z-[100] bg-black/25"
          className={cn(
            "z-[100] flex max-h-[min(48dvh,420px)] flex-col gap-0 rounded-t-[18px] border-[#2C2C2C]/10 bg-[#FAF8F4] px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_rgba(44,44,44,0.14)]",
            "transition-transform duration-200 ease-out data-[side=bottom]:data-open:animate-in data-[side=bottom]:data-open:slide-in-from-bottom-10",
          )}
          style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[#2C2C2C]/18" aria-hidden />

          <SheetTitle className="sr-only">
            {property?.title ?? "Property details"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Map search listing preview
          </SheetDescription>

          {property ? (
            <div
              key={property.id}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 animate-in fade-in duration-150"
            >
              <Link
                href={detailHref}
                className="block w-full text-left active:opacity-95"
              >
                <div className="relative h-24 w-full overflow-hidden rounded-xl bg-[#F3F0EA]">
                  {photoUrl ? (
                    <ListingCardPhoto src={photoUrl} alt="" sizes="92vw" eager priority />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#d8e4da]" />
                  )}
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-none text-[#6B9E6E]">{priceLabel}</p>
                    <h3 className="mt-1.5 line-clamp-2 font-sans text-[15px] font-medium leading-snug text-[#2C2C2C]">
                      {property.name?.trim() || property.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#888888]">
                      <MapPin className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
                      <span className="line-clamp-1">{locationLine}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#888888]">
                      {bedsLabel} · {property.baths} baths · {property.sqft} sqft
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-[#6B9E6E]/35 bg-white px-3 py-1.5 text-xs font-semibold text-[#6B9E6E] shadow-sm">
                    View details
                  </span>
                </div>
              </Link>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </MobileSheetPortal>
  );
}
