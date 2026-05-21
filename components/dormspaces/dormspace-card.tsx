"use client";

import Image from "next/image";
import Link from "next/link";
import { AirVent, Droplets, Shield, UtensilsCrossed, Wifi, WashingMachine, Zap } from "lucide-react";

import { DormspaceLikeButton } from "@/components/dormspaces/dormspace-like-button";
import { DormspaceVerificationBadge } from "@/components/dormspaces/dormspace-verification-badge";
import {
  activeDormspaceAmenities,
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

function AmenityIcon({ label }: { label: string }) {
  const cls = "size-3.5 shrink-0 text-[#6B9E6E]";
  const l = label.toLowerCase();
  if (l.includes("wifi")) return <Wifi className={cls} aria-hidden />;
  if (l.includes("aircon")) return <AirVent className={cls} aria-hidden />;
  if (l.includes("kitchen")) return <UtensilsCrossed className={cls} aria-hidden />;
  if (l.includes("laundry")) return <WashingMachine className={cls} aria-hidden />;
  if (l.includes("water")) return <Droplets className={cls} aria-hidden />;
  if (l.includes("electric")) return <Zap className={cls} aria-hidden />;
  if (l.includes("security")) return <Shield className={cls} aria-hidden />;
  return null;
}

export function DormspaceCard({ listing }: { listing: DormspaceWithPhotos }) {
  const img = dormspacePrimaryPhotoUrl(listing.dormspace_photos ?? null);
  const amenities = activeDormspaceAmenities(listing).slice(0, 4);
  const href = `/dormspaces/${listing.id}`;

  return (
    <div className="relative flex h-full min-h-[380px] w-full flex-col overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_16px_rgba(0,0,0,0.08)] transition hover:border-[#C4C4C4] hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)]">
      <Link href={href} className="flex h-full min-h-0 flex-1 flex-col">
        <div className="relative h-44 w-full shrink-0 bg-[#F3F0EA] lg:h-48">
          {img ? (
            <Image src={img} alt="" fill className="object-cover" sizes="(min-width: 768px) 33vw, 100vw" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" aria-hidden />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
            {dormspaceRoomTypeLabel(listing.room_type)}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-[#D4A843]">{formatDormspacePrice(listing.monthly_price)}</p>
            <DormspaceVerificationBadge status={listing.status} />
          </div>
          <h3 className="mt-1 line-clamp-2 font-serif text-base font-semibold leading-snug text-[#2C2C2C]">
            {listing.title}
          </h3>
          <p className="mt-1 text-sm font-medium text-[#484848]">{dormspaceLocationLine(listing)}</p>
          {amenities.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {amenities.map((a) => (
                <span
                  key={a.key}
                  className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3d5a40]"
                  title={a.label}
                >
                  <AmenityIcon label={a.label} />
                  {a.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <DormspaceLikeButton dormspaceId={listing.id} signInNext={href} className="rounded-full shadow-sm" />
      </div>
    </div>
  );
}
