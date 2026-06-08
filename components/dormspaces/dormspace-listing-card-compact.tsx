"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bed, Heart, MapPin, Shield, User, Users, Wallet } from "lucide-react";
import { GalleryNavButton } from "@/components/ui/gallery-nav-button";

import { useAuth } from "@/contexts/auth-context";
import { useDormspaceEngagement } from "@/hooks/use-dormspace-engagement";
import { isOwnDormspaceListing } from "@/lib/dormspace-engagement";
import {
  DORMSPACE_DESKTOP_CARD_BODY_CLASS,
  DORMSPACE_DESKTOP_CARD_HEIGHT_CLASS,
  DORMSPACE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS,
  DORMSPACE_LISTING_CARD_WIDTH,
} from "@/lib/dormspace-listing-card-layout";
import { listingListedCompactLabel } from "@/lib/listing-listed-time";
import {
  dormspaceCardBedDisplay,
  dormspaceCardDepositAmount,
  dormspaceCardFromPrice,
  dormspaceCardGenderTag,
  isDormspaceFullyBooked,
} from "@/lib/dormspace-gender-beds";
import {
  dormspaceLocationLine,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

const dormCardListedPillClass =
  "inline-flex w-fit shrink-0 items-center rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium leading-tight text-[#2C2C2C] shadow-sm ring-1 ring-black/5";

function formatCardPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(Math.round(amount));
}

function dormspaceCardGenderBadgeClass(tag: string): string {
  if (tag === "MALE ONLY" || tag === "FEMALE ONLY") {
    return "border-black/[0.06] bg-[#F5F5F5] text-[#484848]";
  }
  return "border-[#6B9E6E]/25 bg-[#E8F0E9] text-[#3D6B40]";
}

function DormspaceCardGenderBadge({ tag }: { tag: string }) {
  const Icon = tag === "MIXED" ? Users : User;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide md:text-[8px]",
        dormspaceCardGenderBadgeClass(tag),
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {tag}
    </span>
  );
}

function dormspaceCardAvailableBedBoxClass(gender: "male" | "female" | "mixed"): string {
  switch (gender) {
    case "male":
    case "female":
      return "bg-[#F5F5F5] ring-black/[0.04]";
    case "mixed":
      return "bg-[#E8F0E9] ring-black/[0.04]";
  }
}

function DormspaceCardBedBox({
  label,
  available,
  gender,
}: {
  label: string;
  available: boolean;
  gender: "male" | "female";
}) {
  const isFull = !available;

  return (
    <div
      className={cn(
        "flex min-h-[2.125rem] min-w-0 flex-1 basis-0 gap-1.5 rounded-lg px-2 py-1.5 ring-1",
        isFull
          ? "items-start bg-[#F3F3F3] ring-black/[0.04]"
          : cn("items-center", dormspaceCardAvailableBedBoxClass(gender)),
      )}
    >
      <Bed
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isFull ? "text-[#BBBBBB]" : "text-[#2C2C2C]",
          isFull && "mt-0.5",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-bold leading-tight",
            isFull ? "text-[#888888]" : "text-[#2C2C2C]",
          )}
        >
          {label}
        </p>
        {isFull ? <p className="text-[9px] font-normal leading-tight text-[#999999]">No slots</p> : null}
      </div>
    </div>
  );
}

function DormspaceCardPriceCell({
  icon: Icon,
  amount,
  caption,
  empty,
}: {
  icon: typeof Wallet;
  amount: string | null;
  caption: string;
  empty?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" strokeWidth={1.75} aria-hidden />
      {empty || !amount ? (
        <span className="text-[11px] font-bold leading-none text-[#AAAAAA]">—</span>
      ) : (
        <>
          <span className="max-w-full truncate text-[11px] font-bold leading-none text-[#2C2C2C]">{amount}</span>
          <span className="max-w-full truncate text-[9px] font-medium leading-none text-[#888888]">{caption}</span>
        </>
      )}
    </div>
  );
}

/** Dormspacers browse card — photo overlays + premium stacked body under the image. */
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
  const genderTag = dormspaceCardGenderTag(listing);
  const bedDisplay = dormspaceCardBedDisplay(listing);
  const fullyBooked = isDormspaceFullyBooked(listing);
  const pricePerBed = dormspaceCardFromPrice(listing);
  const depositAmount = dormspaceCardDepositAmount(listing);

  return (
    <div
      className={cn(
        "relative flex touch-manipulation flex-col bg-white max-md:h-auto max-md:snap-start max-md:overflow-hidden max-md:rounded-2xl max-md:shadow-[0_4px_16px_rgba(44,44,44,0.08)] max-md:ring-1 max-md:ring-black/[0.05] max-md:transition max-md:active:scale-[0.99]",
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
          "relative w-full shrink-0 overflow-hidden bg-[#F3F0EA] max-md:aspect-[5/4] max-md:rounded-t-2xl md:aspect-auto md:rounded-none",
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-20 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />

        <div className="absolute left-2 top-2 z-20 md:left-2.5 md:top-2.5">
          <span className={dormCardListedPillClass}>{listedLabel}</span>
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
                "inline-flex flex-row items-center gap-1 rounded-full border bg-white/95 p-1 shadow-md transition hover:bg-[#FAF8F4] max-md:border-0 md:border-gray-200 md:p-1.5",
                liked ? "border-red-200" : "",
              )}
              aria-label={liked ? "Remove from liked" : "Add to liked"}
            >
              <Heart
                className={cn(
                  "h-4 w-4 shrink-0 md:h-3.5 md:w-3.5",
                  liked ? "fill-red-500 text-red-500" : "fill-none text-red-400",
                )}
              />
            </button>
          </div>
        ) : null}

        {locationLine ? (
          <div className="absolute bottom-2 left-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 md:bottom-2.5 md:left-2.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-white drop-shadow-sm" aria-hidden />
            <span className="min-w-0 truncate text-xs font-medium text-white drop-shadow-sm">{locationLine}</span>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "border-t border-[#2C2C2C]/8 bg-white max-md:rounded-b-2xl max-md:border-0 max-md:px-2.5 max-md:pb-2.5 max-md:pt-2",
          "md:border-t md:border-[#2C2C2C]/10 md:px-2 md:pb-2 md:pt-1.5",
          DORMSPACE_DESKTOP_CARD_BODY_CLASS,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-1.5">
          <Link
            href={href}
            prefetch
            className="line-clamp-2 min-w-0 flex-1 text-left text-[12px] font-bold leading-snug text-[#2C2C2C] hover:underline max-md:pointer-events-none md:text-[13px]"
          >
            {listing.title}
          </Link>
          <DormspaceCardGenderBadge tag={genderTag} />
        </div>

        <div className="mt-1.5 flex min-h-0 flex-1 flex-col border-t border-[#E5E5E5] pt-2">
          <div className="shrink-0 space-y-1.5">
            {bedDisplay.mode === "dual" ? (
              <div className="flex gap-1.5">
                <DormspaceCardBedBox {...bedDisplay.columns[0]} />
                <DormspaceCardBedBox {...bedDisplay.columns[1]} />
              </div>
            ) : bedDisplay.mode === "single" ? (
              <DormspaceCardBedBox {...bedDisplay.column} />
            ) : (
              <div className="rounded-lg bg-[#F3F3F3] px-2 py-1.5 ring-1 ring-black/[0.04]">
                <div className="flex min-w-0 items-start gap-1.5">
                  <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#BBBBBB]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#2C2C2C]">Fully booked</p>
                    <p className="text-[9px] leading-snug text-[#717171]">
                      Join the waitlist to get notified when a slot opens.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto shrink-0 pt-2">
            <div className="mx-2 border-t border-[#E5E5E5]" aria-hidden />
            <div className="mt-3">
              <div className="grid grid-cols-2 divide-x divide-[#D8DED8]">
                <div className="flex justify-center px-1.5">
                  <DormspaceCardPriceCell
                    icon={Wallet}
                    amount={fullyBooked || pricePerBed == null ? null : `₱${formatCardPeso(pricePerBed)}`}
                    caption="/ bed"
                    empty={fullyBooked || pricePerBed == null}
                  />
                </div>
                <div className="flex justify-center px-1.5">
                  <DormspaceCardPriceCell
                    icon={Shield}
                    amount={fullyBooked || depositAmount == null ? null : `₱${formatCardPeso(depositAmount)}`}
                    caption="Deposit"
                    empty={fullyBooked || depositAmount == null}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
