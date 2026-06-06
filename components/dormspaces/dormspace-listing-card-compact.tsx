"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Heart, MapPin } from "lucide-react";
import { GalleryNavButton } from "@/components/ui/gallery-nav-button";

import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import {
  DORMSPACE_DESKTOP_CARD_BODY_CLASS,
  DORMSPACE_DESKTOP_CARD_HEIGHT_CLASS,
  DORMSPACE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS,
  DORMSPACE_DESKTOP_SLOT,
  DORMSPACE_DESKTOP_WALK_PLACEHOLDER,
  DORMSPACE_LISTING_CARD_WIDTH,
  DORMSPACE_MOBILE_SLOT,
} from "@/lib/dormspace-listing-card-layout";
import { listingListedCompactLabel } from "@/lib/listing-listed-time";
import { DormspaceWalkTimesLine } from "@/components/dormspaces/dormspace-walk-times-line";
import { closestWalkTimes } from "@/lib/dormspace-walk-times-display";
import {
  dormspaceCardAvailabilityText,
  dormspaceCardFromPrice,
  dormspaceCardPriceLabel,
  dormspaceImagePillLabel,
} from "@/lib/dormspace-gender-beds";
import {
  dormspaceLocationLine,
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

const dormCardStatusPillClass =
  "inline-flex w-fit shrink-0 items-center rounded-full border border-black/10 bg-white/90 px-2 py-0.5 text-xs font-medium text-[#2C2C2C] shadow-sm";
const dormCardListedPillClass =
  "inline-flex w-fit shrink-0 items-center rounded-full bg-white/90 px-1.5 py-px text-[10px] font-medium leading-tight text-[#2C2C2C] shadow-sm ring-1 ring-black/5 md:px-2 md:py-0.5 md:text-[10px]";

/** Matches homepage `NewlyListedCard` compact layout — dorm engagement (like only, no pipeline). */
export function DormspaceListingCardCompact({ listing }: { listing: DormspaceWithPhotos }) {
  const { user } = useAuth();
  const { mayEngage, isLiked, toggleLike } = useDormspaceEngagement();
  const hideHeart = isOwnDormspaceListing(user?.id, listing.landlord_user_id);
  const href = `/dormspaces/${listing.id}`;
  const detailLabel = `View ${listing.title}`;

  const photos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
  const urls = photos.map((p) => p.url).filter(Boolean);
  const [roomIdx, setRoomIdx] = useState(0);
  const img = urls[roomIdx] ?? urls[0] ?? "";
  const listedLabel = listingListedCompactLabel(listing.created_at);
  const liked = isLiked(listing.id);
  const locationLine = dormspaceLocationLine(listing);
  const hasWalkTimes = closestWalkTimes(listing.dormspace_walk_times).length > 0;
  const cardPriceLine =
    dormspaceCardPriceLabel(listing, formatDormspacePrice) ??
    (dormspaceCardFromPrice(listing) != null
      ? `From ${formatDormspacePrice(dormspaceCardFromPrice(listing)!)}`
      : null);
  const availabilityLine = dormspaceCardAvailabilityText(listing);
  const imagePill = dormspaceImagePillLabel(listing);

  return (
    <div
      className={cn(
        "relative flex h-full touch-manipulation flex-col bg-white max-md:min-h-0 max-md:snap-start max-md:overflow-hidden max-md:rounded-2xl max-md:shadow-[0_4px_16px_rgba(44,44,44,0.08)] max-md:ring-1 max-md:ring-black/[0.05] max-md:transition max-md:active:scale-[0.99]",
        "md:flex md:flex-col md:overflow-hidden md:rounded-2xl md:border md:border-[#2C2C2C]/10 md:shadow-md",
        DORMSPACE_DESKTOP_CARD_HEIGHT_CLASS,
        DORMSPACE_LISTING_CARD_WIDTH,
      )}
    >
      <Link
        href={href}
        prefetch
        className="absolute inset-0 z-[12] rounded-2xl md:hidden"
        aria-label={detailLabel}
      />

      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden bg-[#F3F0EA] max-md:aspect-[4/3] max-md:rounded-t-2xl md:aspect-auto md:rounded-none",
          DORMSPACE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS,
        )}
      >
        {img ? (
          <Image src={img} alt="" fill className="object-cover" sizes="(max-width: 767px) 50vw, 208px" priority={false} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" aria-hidden />
        )}

        <Link
          href={href}
          prefetch
          className="absolute inset-0 z-[7] max-md:hidden"
          aria-label={detailLabel}
        />

        {urls.length > 1 ? (
          <>
            <GalleryNavButton
              direction="prev"
              className="left-1 z-[25]"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setRoomIdx((i) => (i - 1 + urls.length) % urls.length);
              }}
              aria-label="Previous photo"
            />
            <GalleryNavButton
              direction="next"
              className="right-1 z-[25]"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setRoomIdx((i) => (i + 1) % urls.length);
              }}
              aria-label="Next photo"
            />
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/25 to-transparent" />

        <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-1 md:left-2.5 md:top-2.5">
          <span className={dormCardStatusPillClass}>{imagePill}</span>
        </div>

        {mayEngage && !hideHeart ? (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 md:right-2.5 md:top-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void toggleLike(listing.id, {
                  signInNext: href,
                  landlordUserId: listing.landlord_user_id,
                });
              }}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full border bg-white/80 p-1 shadow-sm transition hover:bg-[#FAF8F4] max-md:border-0 max-md:bg-white/95 max-md:shadow-md md:p-1.5",
                liked ? "border-red-200 bg-white" : "border-gray-200",
              )}
              aria-label={liked ? "Remove from liked" : "Add to liked"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 shrink-0 md:h-3.5 md:w-3.5",
                  liked ? "fill-red-500 text-red-500" : "fill-none text-[#222] md:text-red-400",
                )}
              />
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-2 left-2 z-20 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1 md:bottom-2.5 md:left-2.5 md:max-w-[calc(100%-5rem)]">
          <span className={dormCardListedPillClass}>{listedLabel}</span>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-0.5 border-t border-[#2C2C2C]/10 bg-white max-md:rounded-b-2xl max-md:border-0 max-md:px-2.5 max-md:pb-2 max-md:pt-2 px-3 py-2",
          "md:gap-0 md:border-t md:border-[#2C2C2C]/10 md:px-2 md:pt-1.5 md:pb-1",
          DORMSPACE_DESKTOP_CARD_BODY_CLASS,
        )}
      >
        <p
          className={cn(
            "truncate text-sm font-semibold leading-tight text-[#D4A843] md:text-sm",
            DORMSPACE_DESKTOP_SLOT.price,
          )}
        >
          {cardPriceLine ?? formatDormspacePrice(listing.monthly_price)}
        </p>
        <p
          className={cn(
            "line-clamp-2 text-[13px] font-semibold leading-snug text-[#2C2C2C] max-md:block md:hidden",
            DORMSPACE_MOBILE_SLOT.title,
          )}
        >
          {listing.title}
        </p>
        <Link
          href={href}
          prefetch
          className={cn(
            "line-clamp-2 hidden text-left text-[13px] font-semibold leading-snug text-[#2C2C2C] hover:underline md:block",
            DORMSPACE_DESKTOP_SLOT.title,
          )}
        >
          {listing.title}
        </Link>
        {availabilityLine ? (
          <p
            className={cn(
              "truncate text-[11px] font-medium text-[#6B9E6E]",
              DORMSPACE_DESKTOP_SLOT.meta,
              DORMSPACE_MOBILE_SLOT.beds,
            )}
          >
            {availabilityLine}
          </p>
        ) : (
          <p
            className={cn(
              "truncate text-[11px] text-[#888888]",
              DORMSPACE_DESKTOP_SLOT.meta,
              DORMSPACE_MOBILE_SLOT.beds,
            )}
          >
            Currently full
          </p>
        )}
        <p
          className={cn(
            "flex items-center gap-1 text-[11px] text-[#717171]",
            DORMSPACE_DESKTOP_SLOT.location,
            DORMSPACE_MOBILE_SLOT.location,
          )}
        >
          <MapPin className="h-3 w-3 shrink-0 text-[#8E8E8E]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {locationLine ? (
              locationLine
            ) : (
              <span className="invisible select-none" aria-hidden>
                {"\u00a0"}
              </span>
            )}
          </span>
        </p>
        <div
          className={cn(
            "max-md:mt-0.5",
            DORMSPACE_DESKTOP_SLOT.walk,
            DORMSPACE_MOBILE_SLOT.walk,
            "md:flex md:items-center",
          )}
        >
          {hasWalkTimes ? (
            <DormspaceWalkTimesLine listing={listing} className="truncate text-[11px] md:text-[11px]" />
          ) : (
            <span className="truncate text-[11px] max-md:invisible md:inline" aria-hidden>
              {DORMSPACE_DESKTOP_WALK_PLACEHOLDER}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 mt-auto hidden shrink-0 flex-col justify-center overflow-hidden bg-white md:flex",
          DORMSPACE_DESKTOP_SLOT.landlord,
          "px-2 pb-1.5 pt-0",
        )}
      >
        <div className="flex h-full min-h-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-1 ring-[#6B9E6E]/20">
            <BadgeCheck className="size-4 text-[#D4A843]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[#2C2C2C]/85">
              {listing.landlord_name?.trim() || (
                <span className="text-gray-400">Landlord</span>
              )}
            </p>
            <p className="truncate text-[10px] text-gray-400">
              {listing.status === "approved" ? "Verified landlord" : "Landlord · pending review"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
