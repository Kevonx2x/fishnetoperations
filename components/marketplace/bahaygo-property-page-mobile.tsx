"use client";

/** BahayGo mobile property detail layout (Phase 1 — approved; do not redesign without explicit ask). */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  Maximize2,
  Wifi,
} from "lucide-react";
import { GalleryNavButton } from "@/components/ui/gallery-nav-button";
import { buildBahayGoPropertyHighlights } from "@/lib/bahaygo-property-highlights";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { formatPropertyFloorAreaDisplay } from "@/lib/format-property-floor-area";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { cn } from "@/lib/utils";

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  rent_price?: string | null;
  status: "for_sale" | "for_rent" | "sold" | "rented" | "both";
  listing_type?: "sale" | "rent" | "both" | null;
  sqft: string;
  beds: number;
  baths: number;
  property_type: string | null;
  description: string | null;
};

type AvailabilityBanner = {
  tone: "gold" | "gray";
  message: string;
} | null;

type Props = {
  property: PropertyRow;
  allPhotos: string[];
  heroIndex: number;
  heroDisplaySrc: string;
  fallbackHeroSrc: string;
  onPrevPhoto: () => void;
  onNextPhoto: () => void;
  onSelectPhoto?: (index: number) => void;
  onOpenLightbox: () => void;
  engagement: PropertyEngagement;
  agentEngagementLocked: boolean;
  hideListingClientActions: boolean;
  availabilityBanner: AvailabilityBanner;
  listingAgent: MarketplaceAgent | null;
  connectedAgents: MarketplaceAgent[];
  isListingAgentUser: boolean;
  onCheckAvailability: () => void;
  onMessageAgent?: () => void;
  messageBusy?: boolean;
  authLoading?: boolean;
  locationSection: React.ReactNode;
  presaleSection?: React.ReactNode;
  agentAsideSection?: React.ReactNode;
};

const SWIPE_THRESHOLD = 72;

function propertyTypeLabel(type?: string | null): string {
  const t = String(type ?? "").trim();
  if (!t) return "Property";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function bedsLabel(beds?: number): string {
  if (beds == null) return "—";
  if (beds === 0) return "Studio";
  return `${beds} ${beds === 1 ? "Bed" : "Beds"}`;
}

function bathsLabel(baths?: number): string {
  if (baths == null) return "—";
  return `${baths} ${baths === 1 ? "Bath" : "Baths"}`;
}

function formatDockPrice(property: PropertyRow): string {
  if (property.status === "both") {
    return formatPropertyPriceDisplay(property.price, "for_sale");
  }
  if (property.status === "for_rent" || property.listing_type === "rent") {
    return formatPropertyPriceDisplay(property.rent_price ?? property.price, "for_rent");
  }
  return formatPropertyPriceDisplay(property.price, property.status);
}

function dockPricePrefix(property: PropertyRow): string {
  if (property.status === "for_rent" || property.listing_type === "rent") return "Rent from";
  return "From";
}

export function BahayGoPropertyPageMobile({
  property,
  allPhotos,
  heroIndex,
  heroDisplaySrc,
  fallbackHeroSrc,
  onPrevPhoto,
  onNextPhoto,
  onSelectPhoto,
  onOpenLightbox,
  engagement,
  agentEngagementLocked,
  hideListingClientActions,
  availabilityBanner,
  listingAgent,
  connectedAgents,
  isListingAgentUser,
  onCheckAvailability,
  onMessageAgent,
  messageBusy,
  authLoading,
  locationSection,
  presaleSection,
  agentAsideSection,
}: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [touchLocked, setTouchLocked] = useState<"x" | "y" | null>(null);
  const highlights = buildBahayGoPropertyHighlights(property);
  const floorArea = formatPropertyFloorAreaDisplay(property.sqft);
  const hasMultiplePhotos = allPhotos.length > 1;
  const displayTitle = (property.name?.trim() || property.location).trim();
  const tagline = property.description?.split(/[.!?]/)[0]?.trim();
  const descriptionBody = property.description?.trim() ?? "";
  const priceLabel = formatDockPrice(property);
  const pricePrefix = dockPricePrefix(property);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    setTouchLocked(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || touchLocked) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStart.current.x);
    const dy = Math.abs(t.clientY - touchStart.current.y);
    if (dx > 8 || dy > 8) {
      setTouchLocked(dx > dy ? "x" : "y");
    }
  }, [touchLocked]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || touchLocked === "y") {
        touchStart.current = null;
        setTouchLocked(null);
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        if (dx > 0) onPrevPhoto();
        else onNextPhoto();
      }
      touchStart.current = null;
      setTouchLocked(null);
    },
    [onNextPhoto, onPrevPhoto, touchLocked]
  );

  const specItems = [
    { icon: BedDouble, label: bedsLabel(property.beds) },
    { icon: Bath, label: bathsLabel(property.baths) },
    ...(floorArea ? [{ icon: Maximize2, label: floorArea }] : []),
    { icon: Home, label: propertyTypeLabel(property.property_type) },
    { icon: Wifi, label: "Fast Wi‑Fi" },
  ];

  const highlightIcons = {
    home: Home,
    map: MapPin,
    calendar: CalendarDays,
  };

  return (
    <div className="relative -mx-4">
      {/* Full-bleed immersive hero */}
      <section
        className="relative h-[min(78vh,820px)] w-full overflow-hidden"
        onTouchStart={hasMultiplePhotos ? handleTouchStart : undefined}
        onTouchMove={hasMultiplePhotos ? handleTouchMove : undefined}
        onTouchEnd={hasMultiplePhotos ? handleTouchEnd : undefined}
      >
        <button
          type="button"
          className="absolute inset-0 z-0"
          onClick={onOpenLightbox}
          aria-label="View property photos"
        >
          <Image
            src={heroDisplaySrc || fallbackHeroSrc}
            alt={displayTitle}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </button>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />

        {/* Save */}
        {!agentEngagementLocked && (
          <div className="absolute right-4 top-4 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={() => void engagement.toggleLike(property.id)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm"
              aria-label={engagement.isLiked(property.id) ? "Unlike property" : "Save property"}
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  engagement.isLiked(property.id)
                    ? "fill-[#3d5240] text-[#3d5240]"
                    : "text-[#2C2C2C]"
                )}
              />
            </button>
          </div>
        )}

        {/* Photo counter */}
        {hasMultiplePhotos && (
          <div className="absolute right-4 top-[4.25rem] z-20 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {heroIndex + 1} / {allPhotos.length}
          </div>
        )}

        {/* Nav arrows — white chevrons, no circle (matches homepage) */}
        {hasMultiplePhotos && (
          <>
            <GalleryNavButton
              direction="prev"
              size="lg"
              className="left-2 z-20"
              iconClassName="h-6 w-6"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                onPrevPhoto();
              }}
            />
            <GalleryNavButton
              direction="next"
              size="lg"
              className="right-2 z-20"
              iconClassName="h-6 w-6"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                onNextPhoto();
              }}
            />
          </>
        )}

        {/* Pagination dots */}
        {hasMultiplePhotos && (
          <div className="absolute bottom-[5.5rem] left-0 right-0 z-20 flex justify-center gap-1.5">
            {allPhotos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectPhoto?.(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === heroIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                )}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Floating price + CTA dock */}
        {!hideListingClientActions && (
          <div className="absolute inset-x-4 bottom-4 z-30">
            <div className="flex items-stretch overflow-hidden rounded-2xl bg-[#FAF8F4]/96 shadow-xl ring-1 ring-black/5 backdrop-blur-md">
              <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888888]">
                  {pricePrefix}
                </p>
                <p className="font-serif text-lg font-bold leading-tight text-[#2C2C2C]">{priceLabel}</p>
              </div>
              <button
                type="button"
                onClick={onCheckAvailability}
                className="flex shrink-0 items-center gap-1 bg-[#3d5240] px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white"
              >
                Check availability
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Scroll body on cream */}
      <div className="space-y-10 px-4 pb-6 pt-8">
        {availabilityBanner && (
          <div
            className={cn(
              "rounded-xl px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide",
              availabilityBanner.tone === "gold"
                ? "bg-[#FFF9F0] text-[#8B6914] ring-1 ring-[#D4A843]/30"
                : "bg-[#F0F0F0] text-[#666666]"
            )}
          >
            {availabilityBanner.message}
          </div>
        )}

        <header className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888888]">Property</p>
          <h1 className="font-serif text-3xl font-bold leading-tight text-[#2C2C2C]">
            {displayTitle}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-[#555555]">
            <MapPin className="h-4 w-4 shrink-0 text-[#3d5240]" strokeWidth={2} />
            {property.location}
          </p>
          {tagline && (
            <p className="font-serif text-base italic leading-relaxed text-[#666666]">{tagline}.</p>
          )}
        </header>

        {/* Spec icon row */}
        <div className="grid grid-cols-5 gap-1 border-y border-[#E8E4DC] py-5">
          {specItems.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 px-0.5 text-center">
              <Icon className="h-5 w-5 text-[#3d5240]" strokeWidth={1.75} />
              <span className="text-[10px] font-medium leading-tight text-[#555555]">{label}</span>
            </div>
          ))}
        </div>

        {/* Made for you — icon columns */}
        <section className="text-center">
          <h2 className="font-serif text-2xl font-semibold italic text-[#2C2C2C]">Made for you</h2>
          <p className="mt-1 text-sm text-[#888888]">Everything you need for a comfortable stay</p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {highlights.map((item) => {
              const Icon = highlightIcons[item.icon];
              return (
                <div key={item.title} className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#E8E4DC]">
                    <Icon className="h-5 w-5 text-[#3d5240]" strokeWidth={1.75} />
                  </div>
                  <p className="text-xs font-bold text-[#2C2C2C]">{item.title}</p>
                  <p className="text-[10px] leading-snug text-[#888888]">{item.subtitle}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* A glimpse of your stay — large carousel */}
        {allPhotos.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">A glimpse of your stay</h2>
              <button
                type="button"
                onClick={onOpenLightbox}
                className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#3d5240]"
              >
                View all
              </button>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
              {allPhotos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelectPhoto?.(i);
                    onOpenLightbox();
                  }}
                  className={cn(
                    "relative h-44 w-[68vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-2xl",
                    i === heroIndex && "ring-2 ring-[#D4A843] ring-offset-2 ring-offset-[#FAF8F4]"
                  )}
                >
                  <Image
                    src={src}
                    alt={`${displayTitle} photo ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="68vw"
                  />
                </button>
              ))}
            </div>
            {hasMultiplePhotos && (
              <div className="mt-4 flex justify-center gap-1.5">
                {allPhotos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectPhoto?.(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === heroIndex ? "w-5 bg-[#3d5240]" : "w-1.5 bg-[#D4A843]/40"
                    )}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* About */}
        {descriptionBody && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E8E4DC]/80">
            <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">About this property</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#555555]">
              {descriptionBody}
            </p>
          </section>
        )}

        {locationSection}

        {/* Listing agent */}
        {!isListingAgentUser && listingAgent && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E8E4DC]/80">
            <h2 className="font-serif text-lg font-semibold text-[#2C2C2C]">Listing agent</h2>
            <div className="mt-4 flex items-center gap-3">
              {listingAgent.image ? (
                <Image
                  src={listingAgent.image}
                  alt={listingAgent.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8E4DC] text-sm font-bold text-[#555555]">
                  {listingAgent.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/agents/${encodeURIComponent(listingAgent.id)}`}
                  className="font-semibold text-[#2C2C2C] hover:underline"
                >
                  {listingAgent.name}
                </Link>
                {(listingAgent.company || listingAgent.agencyName) && (
                  <p className="text-sm text-[#888888]">
                    {listingAgent.company || listingAgent.agencyName}
                  </p>
                )}
              </div>
            </div>
            {!hideListingClientActions && onMessageAgent && (
              <button
                type="button"
                onClick={onMessageAgent}
                disabled={messageBusy || authLoading}
                className="mt-4 w-full rounded-xl border border-[#3d5240] py-3 text-sm font-semibold text-[#3d5240] disabled:opacity-50"
              >
                {messageBusy ? "Opening…" : "Message agent"}
              </button>
            )}
          </section>
        )}

        {agentAsideSection}
        {presaleSection}
      </div>
    </div>
  );
}
