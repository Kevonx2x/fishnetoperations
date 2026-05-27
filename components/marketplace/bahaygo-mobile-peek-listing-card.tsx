"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";
import { cn } from "@/lib/utils";

/** ~2.5 peek cards per row — matches BahayGo mobile "New This Week" carousel. */
export const HOMEPAGE_MOBILE_PEEK_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-1rem)/2.5)] shrink-0 snap-start";

export function propertyLocationLine(property: DbProperty): string {
  const city = property.city?.trim() || property.neighborhood?.trim();
  const loc = property.location?.trim();
  if (city && loc) return `${city} · ${loc}`;
  return city || loc || "Metro Manila";
}

export function BahayGoMobilePeekListingCard({
  property,
  mode,
  engagement,
  className,
}: {
  property: DbProperty;
  mode: "buy" | "rent" | "all";
  engagement: PropertyEngagement;
  className?: string;
}) {
  const img = roomUrlsFor(property)[0] ?? property.image_url ?? "";
  const href = `/properties/${encodeURIComponent(property.id)}`;
  const liked = engagement.isLiked(property.id);
  const priceLabel =
    mode === "rent" || property.listing_type === "rent"
      ? formatPropertyPriceDisplay(property.rent_price, "for_rent")
      : formatPropertyPriceDisplay(property.price, property.status);
  const bedsLabel = property.beds === 0 ? "Studio" : `${property.beds} bed`;

  return (
    <Link
      href={href}
      className={cn(
        HOMEPAGE_MOBILE_PEEK_LISTING_CARD_WIDTH,
        "block overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(44,44,44,0.1)] ring-1 ring-black/[0.04] transition active:scale-[0.99]",
        className,
      )}
    >
      <div className="relative aspect-[5/4] w-full bg-[#F3F0EA]">
        {img ? <ListingCardPhoto src={img} alt="" sizes="40vw" eager /> : null}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void engagement.toggleLike(property.id);
          }}
          className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/[0.06]"
          aria-label={liked ? "Unlike" : "Save"}
        >
          <Heart
            className={cn("size-3.5", liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]/80")}
            strokeWidth={2}
          />
        </button>
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="text-[13px] font-bold leading-none text-[#C49A2E]">{priceLabel}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2rem] text-[12px] font-semibold leading-tight text-[#2C2C2C]">
          {property.name?.trim() || property.location}
        </h3>
        <p className="mt-0.5 text-[9px] font-medium text-[#888888]">
          {bedsLabel} · {property.baths} bath · {property.sqft} sqft
        </p>
        <p className="mt-0.5 line-clamp-1 text-[9px] font-medium text-[#888888]">
          {propertyLocationLine(property)}
        </p>
      </div>
    </Link>
  );
}
