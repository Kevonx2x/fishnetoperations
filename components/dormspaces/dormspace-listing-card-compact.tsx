"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { DormspaceLikeButton } from "@/components/dormspaces/dormspace-like-button";
import {
  activeDormspaceAmenities,
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

function isNewListing(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

/** Homepage-style listing card, shorter — for dormspace browse carousels. */
export function DormspaceListingCardCompact({ listing }: { listing: DormspaceWithPhotos }) {
  const img = dormspacePrimaryPhotoUrl(listing.dormspace_photos ?? null);
  const amenities = activeDormspaceAmenities(listing).slice(0, 3);
  const href = `/dormspaces/${listing.id}`;
  const showNew = isNewListing(listing.created_at);

  return (
    <div className="flex w-[200px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md sm:w-[216px]">
      <Link href={href} className="relative block h-[132px] w-full shrink-0 overflow-hidden bg-[#F3F0EA] sm:h-[140px]">
        {img ? (
          <Image src={img} alt="" fill className="object-cover" sizes="216px" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" aria-hidden />
        )}
        <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-[#2C2C2C] shadow-sm backdrop-blur-sm">
          {dormspaceRoomTypeLabel(listing.room_type)}
        </span>
        {showNew ? (
          <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-[#2C2C2C] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col border-t border-[#2C2C2C]/8 px-3 py-2.5">
        <p className="truncate text-base font-bold tracking-tight text-[#D4A843]">
          {formatDormspacePrice(listing.monthly_price)}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[#2C2C2C]">{listing.title}</p>
        <p className="mt-1 flex items-start gap-1 text-[11px] text-[#6B6B6B]">
          <MapPin className="mt-0.5 size-3 shrink-0 text-[#8E8E8E]" aria-hidden />
          <span className="line-clamp-1">{dormspaceLocationLine(listing)}</span>
        </p>
        {amenities.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {amenities.map((a) => (
              <span
                key={a.key}
                className="rounded-full bg-[#F3F0EA] px-2 py-0.5 text-[10px] font-semibold text-[#525252] ring-1 ring-[#2C2C2C]/6"
              >
                {a.label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Link
            href={href}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-[#2C2C2C]/12 text-xs font-bold text-[#2C2C2C] transition hover:border-[#6B9E6E]/40 hover:bg-[#FAF8F4]"
          >
            View details
          </Link>
          <DormspaceLikeButton dormspaceId={listing.id} signInNext={href} />
        </div>
      </div>
    </div>
  );
}
