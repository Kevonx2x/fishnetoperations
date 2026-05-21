"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { DORMSPACE_LISTING_CARD_WIDTH } from "@/lib/dormspace-browse-rows";
import {
  dormspaceGenderLabel,
  dormspaceLocationLine,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

/** Matches homepage `NewlyListedCard` compact layout — dorm engagement (like only, no pipeline). */
export function DormspaceListingCardCompact({ listing }: { listing: DormspaceWithPhotos }) {
  const router = useRouter();
  const { user } = useAuth();
  const { mayEngage, isLiked, toggleLike } = useDormspaceEngagement();
  const hideHeart = isOwnDormspaceListing(user?.id, listing.landlord_user_id);
  const href = `/dormspaces/${listing.id}`;

  const photos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
  const urls = photos.map((p) => p.url).filter(Boolean);
  const [roomIdx, setRoomIdx] = useState(0);
  const img = urls[roomIdx] ?? urls[0] ?? "";
  const listedLabel = listingListedLabel(listing.created_at);
  const liked = isLiked(listing.id);

  const openDetail = () => router.push(href);

  return (
    <div
      className={cn(
        "flex min-h-[412px] flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md lg:min-h-[448px]",
        DORMSPACE_LISTING_CARD_WIDTH,
      )}
    >
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-[#F3F0EA] lg:h-52">
        {img ? (
          <Image src={img} alt="" fill className="object-cover" sizes="240px" priority={false} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" aria-hidden />
        )}

        <button
          type="button"
          onClick={openDetail}
          className="absolute inset-0 z-[6] cursor-pointer bg-transparent"
          aria-label="Open dormspace details"
        />

        {urls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRoomIdx((i) => (i - 1 + urls.length) % urls.length);
              }}
              className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRoomIdx((i) => (i + 1) % urls.length);
              }}
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/25 to-transparent" />

        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1">
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm backdrop-blur-sm">
            {dormspaceRoomTypeLabel(listing.room_type)}
          </span>
        </div>

        {mayEngage && !hideHeart ? (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void toggleLike(listing.id, {
                  signInNext: href,
                  landlordUserId: listing.landlord_user_id,
                });
              }}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full border bg-white/80 p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                liked ? "border-red-200 bg-white" : "border-gray-200",
              )}
              aria-label={liked ? "Remove from liked" : "Add to liked"}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  liked ? "fill-red-500 text-red-500" : "fill-none text-red-400",
                )}
              />
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-5rem)] flex-col items-start gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-[#2C2C2C] shadow-sm ring-1 ring-black/5">
            {listedLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0 border-t border-[#2C2C2C]/10 bg-white px-3 py-2">
        <div className="min-h-[28px] shrink-0 overflow-hidden">
          <p className="truncate text-base font-semibold tracking-tight text-[#D4A843]">
            {formatDormspacePrice(listing.monthly_price)}
          </p>
        </div>
        <div className="h-[48px] shrink-0 overflow-hidden">
          <button
            type="button"
            onClick={openDetail}
            className="line-clamp-2 text-left text-sm font-semibold text-[#2C2C2C] hover:underline"
          >
            {listing.title}
          </button>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p className="truncate text-[11px] text-[#6B6B6B]">
            {dormspaceRoomTypeLabel(listing.room_type)} · {dormspaceGenderLabel(listing.gender_preference)}
          </p>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p className="flex items-start gap-1 text-[11px] text-[#6B6B6B]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E8E]" aria-hidden />
            <span className="min-w-0 flex-1 truncate leading-snug">{dormspaceLocationLine(listing)}</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex min-h-[56px] max-h-[76px] shrink-0 flex-col justify-center overflow-hidden bg-white px-3 py-1.5">
        <div className="flex min-h-[40px] flex-1 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-1 ring-[#6B9E6E]/20">
            <BadgeCheck className="size-4 text-[#D4A843]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[#2C2C2C]/85">{listing.landlord_name}</p>
            <p className="truncate text-[10px] text-gray-400">
              {listing.status === "approved" ? "Verified landlord" : "Landlord · pending review"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
