"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Heart,
  Home,
  Images,
  MapPin,
  Maximize2,
  Pin as LucidePin,
  Wifi,
} from "lucide-react";
import { GalleryNavButton, RowScrollNavButton } from "@/components/ui/gallery-nav-button";
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
  is_presale?: boolean;
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
  onOpenLightbox: (index?: number) => void;
  engagement: PropertyEngagement;
  agentEngagementLocked: boolean;
  hideListingClientActions: boolean;
  availabilityBanner: AvailabilityBanner;
  listingAgent: MarketplaceAgent | null;
  isListingAgentUser: boolean;
  onCheckAvailability: () => void;
  onMessageAgent?: () => void;
  messageBusy?: boolean;
  authLoading?: boolean;
  locationSection: React.ReactNode;
  presaleSection?: React.ReactNode;
  agentAsideSection?: React.ReactNode;
};

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

function propertyTypeLabel(type?: string | null): string {
  const t = String(type ?? "").trim();
  if (!t) return "Property";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function bedsLabel(beds?: number): string {
  if (beds == null) return "—";
  if (beds === 0) return "Studio";
  return `${beds} ${beds === 1 ? "Bedroom" : "Bedrooms"}`;
}

function bathsLabel(baths?: number): string {
  if (baths == null) return "—";
  return `${baths} ${baths === 1 ? "Bathroom" : "Bathrooms"}`;
}

export function BahayGoPropertyPageDesktop({
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
  isListingAgentUser,
  onCheckAvailability,
  onMessageAgent,
  messageBusy,
  authLoading,
  locationSection,
  presaleSection,
  agentAsideSection,
}: Props) {
  const glimpseRef = useRef<HTMLDivElement>(null);
  const displayTitle = (property.name?.trim() || property.location).trim();
  const highlights = buildBahayGoPropertyHighlights(property);
  const floorArea = formatPropertyFloorAreaDisplay(property.sqft);
  const hasMultiplePhotos = allPhotos.length > 1;
  const priceLabel = formatDockPrice(property);
  const pricePrefix = dockPricePrefix(property);
  const tagline = property.description?.split(/[.!?]/)[0]?.trim();
  const descriptionBody = property.description?.trim() ?? "";
  const showEngagement = engagement.showEngagementCounts(property.id);
  const likeCount = engagement.likeCount(property.id);
  const saveCount = engagement.saveCount(property.id);

  const scrollGlimpse = useCallback((dir: "prev" | "next") => {
    const el = glimpseRef.current;
    if (!el) return;
    const amount = Math.max(280, el.clientWidth * 0.75);
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "smooth" });
  }, []);

  const specItems = [
    { icon: BedDouble, label: bedsLabel(property.beds) },
    { icon: Bath, label: bathsLabel(property.baths) },
    ...(floorArea !== "—" ? [{ icon: Maximize2, label: floorArea }] : []),
    { icon: Home, label: propertyTypeLabel(property.property_type) },
    { icon: Wifi, label: "Fast Wi‑Fi" },
  ];

  const highlightIcons = {
    home: Home,
    map: MapPin,
    calendar: CalendarDays,
  };

  const secondaryPhotos =
    allPhotos.length > 1
      ? [1, 2]
          .map((offset) => allPhotos[(heroIndex + offset) % allPhotos.length])
          .filter((src, i, arr) => src && arr.indexOf(src) === i)
      : [];

  const cardDescription = tagline || descriptionBody;

  return (
    <div className="hidden md:block">
      <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
        {/* Contained gallery + overlay cards */}
        <section className="relative mb-32 lg:mb-36">
          <div className="relative overflow-visible rounded-2xl">
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl bg-neutral-100",
                allPhotos.length > 1 ? "grid h-[380px] grid-cols-1 gap-1 md:h-[440px] md:grid-cols-[1fr_220px] lg:h-[480px] lg:grid-cols-[1fr_260px]" : "h-[380px] lg:h-[440px]"
              )}
            >
              {/* Main photo */}
              <div className="relative min-h-[280px]">
                <button
                  type="button"
                  className="absolute inset-0 z-0"
                  onClick={() => onOpenLightbox(heroIndex)}
                  aria-label="View property photos"
                >
                  <Image
                    src={heroDisplaySrc || fallbackHeroSrc}
                    alt={displayTitle}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 70vw, 900px"
                  />
                </button>

                {hasMultiplePhotos && (
                  <>
                    <GalleryNavButton
                      direction="prev"
                      size="lg"
                      className="left-3 z-20"
                      iconClassName="h-7 w-7"
                      disabled={heroIndex <= 0}
                      aria-label="Previous photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrevPhoto();
                      }}
                    />
                    <GalleryNavButton
                      direction="next"
                      size="lg"
                      className="right-3 z-20 md:right-3"
                      iconClassName="h-7 w-7"
                      disabled={heroIndex >= allPhotos.length - 1}
                      aria-label="Next photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNextPhoto();
                      }}
                    />
                  </>
                )}
              </div>

              {/* Side photos — Trulia-style stack */}
              {allPhotos.length > 1 && (
                <div className="hidden min-h-0 grid-rows-2 gap-1 md:grid">
                  {secondaryPhotos.slice(0, 2).map((src, i) => {
                    const photoIndex = allPhotos.indexOf(src);
                    return (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        className="relative min-h-0 overflow-hidden"
                        onClick={() => {
                          if (photoIndex >= 0) onSelectPhoto?.(photoIndex);
                          onOpenLightbox(photoIndex >= 0 ? photoIndex : heroIndex);
                        }}
                        aria-label={`View photo ${photoIndex + 1}`}
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="260px"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Save / pin — top right of gallery */}
              {!agentEngagementLocked && (
                <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void engagement.toggleLike(property.id)}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        engagement.isLiked(property.id) ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"
                      )}
                    />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void engagement.togglePin(property.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm"
                    aria-label={engagement.isPinned(property.id) ? "Unpin" : "Pin"}
                  >
                    <LucidePin
                      className={cn(
                        "h-4 w-4",
                        engagement.isPinned(property.id) ? "fill-[#2C2C2C] text-[#2C2C2C]" : "text-[#2C2C2C]"
                      )}
                    />
                  </button>
                </div>
              )}

              {/* Photo count */}
              {allPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenLightbox(heroIndex)}
                  className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                >
                  <Images className="h-3.5 w-3.5" aria-hidden />
                  {allPhotos.length}
                </button>
              )}
            </div>

            {/* Overlay cards — bottom edge of photo, extending slightly below */}
            <div className="pointer-events-none absolute bottom-0 left-4 z-30 w-full max-w-[min(calc(100%-2rem),480px)] translate-y-[58%] md:left-5 md:translate-y-[62%]">
              <div className="pointer-events-auto relative">
                {/* Price card */}
                <div className="absolute -right-2 top-0 z-40 translate-x-2 -translate-y-1/2 rounded-2xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] md:-right-4 md:translate-x-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    {pricePrefix}
                  </p>
                  <p className="font-serif text-2xl font-bold leading-tight text-[#2C2C2C]">{priceLabel}</p>
                  {property.status === "both" && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Rent {formatPropertyPriceDisplay(property.rent_price, "for_rent")}
                    </p>
                  )}
                </div>

                {/* Main property card */}
                <div className="rounded-2xl bg-[#FAF8F4] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.05] md:p-7">
                  {availabilityBanner && (
                    <div
                      className={cn(
                        "mb-4 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                        availabilityBanner.tone === "gold"
                          ? "bg-white/80 text-neutral-800"
                          : "bg-neutral-200/80 text-neutral-700"
                      )}
                    >
                      {availabilityBanner.message}
                    </div>
                  )}

                  <h1 className="font-serif text-2xl font-bold leading-tight text-[#2C2C2C] md:text-[1.75rem] lg:text-3xl">
                    {displayTitle}
                  </h1>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                    <MapPin className="h-4 w-4 shrink-0 text-[#888888]" strokeWidth={2} />
                    {property.location}
                  </p>

                  {cardDescription && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                      {cardDescription}
                      {tagline && descriptionBody.length > tagline.length ? "…" : ""}
                    </p>
                  )}

                  <div className="mt-5 border-t border-neutral-300/50 pt-5">
                    <div className="grid grid-cols-3 gap-3">
                      {specItems.slice(0, 3).map(({ icon: Icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                          <Icon className="h-5 w-5 text-[#2C2C2C]" strokeWidth={1.75} />
                          <span className="text-[10px] font-semibold leading-tight text-neutral-600">{label}</span>
                        </div>
                      ))}
                    </div>
                    {specItems.length > 3 && (
                      <div className="mx-auto mt-3 grid max-w-[220px] grid-cols-2 gap-3">
                        {specItems.slice(3).map(({ icon: Icon, label }) => (
                          <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                            <Icon className="h-5 w-5 text-[#2C2C2C]" strokeWidth={1.75} />
                            <span className="text-[10px] font-semibold leading-tight text-neutral-600">{label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!hideListingClientActions && !isListingAgentUser && !property.is_presale && (
                    <button
                      type="button"
                      onClick={onCheckAvailability}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C2C2C] px-5 py-3.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-black"
                    >
                      Check availability
                      <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  )}

                  {isListingAgentUser && (
                    <Link
                      href={`/dashboard/agent?tab=listings&editProperty=${encodeURIComponent(property.id)}`}
                      className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#2C2C2C] px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-black"
                    >
                      Edit listing
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-20">
        {/* Property highlights — compact panel on the right */}
        <section className="-mt-10 flex justify-end lg:-mt-14">
          <div className="ml-auto w-full max-w-[min(100%,520px)] rounded-2xl border border-neutral-200/70 bg-white px-6 py-7 shadow-[0_4px_24px_rgba(0,0,0,0.05)] lg:px-8 lg:py-8">
            <div className="grid grid-cols-3 gap-5 lg:gap-6">
              {highlights.map((item) => {
                const Icon = highlightIcons[item.icon];
                return (
                  <div key={item.title} className="flex min-w-0 flex-col items-center gap-2.5 text-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-[#FAF8F4]">
                      <Icon className="h-5 w-5 text-[#2C2C2C]" strokeWidth={1.75} />
                    </div>
                    <p className="text-[13px] font-bold leading-snug text-[#2C2C2C]">{item.title}</p>
                    <p className="text-[11px] leading-snug text-neutral-500">{item.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* A glimpse of your stay */}
        {allPhotos.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold text-[#2C2C2C] lg:text-3xl">
                A glimpse of your stay
              </h2>
              <button
                type="button"
                onClick={() => onOpenLightbox(heroIndex)}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#2C2C2C] hover:underline"
              >
                View all photos
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="relative">
              <div
                ref={glimpseRef}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
              >
                {allPhotos.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => {
                      onSelectPhoto?.(i);
                      onOpenLightbox(i);
                    }}
                    className={cn(
                      "relative h-56 w-[min(32vw,320px)] shrink-0 snap-start overflow-hidden rounded-2xl lg:h-64",
                      i === heroIndex && "ring-2 ring-[#2C2C2C] ring-offset-2"
                    )}
                  >
                    <Image
                      src={src}
                      alt={`${displayTitle} photo ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="320px"
                    />
                  </button>
                ))}
              </div>
              {allPhotos.length > 3 && (
                <>
                  <RowScrollNavButton
                    direction="prev"
                    className="absolute left-0 top-1/2 z-10 -translate-y-1/2 bg-white/90 shadow-md"
                    onClick={() => scrollGlimpse("prev")}
                    aria-label="Scroll photos left"
                  />
                  <RowScrollNavButton
                    direction="next"
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 bg-white/90 shadow-md"
                    onClick={() => scrollGlimpse("next")}
                    aria-label="Scroll photos right"
                  />
                </>
              )}
            </div>
          </section>
        )}

        {/* Client interest */}
        {!agentEngagementLocked && (showEngagement || likeCount > 0 || saveCount > 0) && (
          <section>
            <h2 className="font-serif text-2xl font-semibold text-[#2C2C2C] lg:text-3xl">Loved by clients</h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-start justify-center rounded-2xl border border-neutral-200 bg-white p-6">
                <p className="font-serif text-5xl font-bold text-[#2C2C2C]">
                  {Math.max(likeCount, saveCount, 1)}
                </p>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Heart
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < Math.min(5, Math.max(likeCount, saveCount)) ? "fill-[#2C2C2C] text-[#2C2C2C]" : "text-neutral-300"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  {saveCount > 0 ? `${saveCount} saved` : null}
                  {saveCount > 0 && likeCount > 0 ? " · " : null}
                  {likeCount > 0 ? `${likeCount} liked` : null}
                  {saveCount === 0 && likeCount === 0 ? "Client interest" : null}
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-neutral-200 bg-white p-5"
                  >
                    <p className="text-sm font-bold text-[#2C2C2C]">{item.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About — full description if truncated in card */}
        {descriptionBody && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-8">
            <h2 className="font-serif text-2xl font-semibold text-[#2C2C2C]">About this property</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
              {descriptionBody}
            </p>
          </section>
        )}

        {/* Agent + actions */}
        {!isListingAgentUser && listingAgent && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {listingAgent.image ? (
                  <Image
                    src={listingAgent.image}
                    alt={listingAgent.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold text-neutral-600">
                    {listingAgent.name.charAt(0)}
                  </div>
                )}
                <div>
                  <Link
                    href={`/agents/${encodeURIComponent(listingAgent.id)}`}
                    className="font-serif text-xl font-semibold text-[#2C2C2C] hover:underline"
                  >
                    {listingAgent.name}
                  </Link>
                  <p className="text-sm text-neutral-600">
                    {listingAgent.company || listingAgent.agencyName}
                  </p>
                </div>
              </div>
              {!hideListingClientActions && (
                <div className="flex flex-wrap gap-3">
                  {onMessageAgent && (
                    <button
                      type="button"
                      onClick={onMessageAgent}
                      disabled={messageBusy || authLoading}
                      className="rounded-xl border border-[#2C2C2C] px-5 py-3 text-sm font-semibold text-[#2C2C2C] disabled:opacity-50"
                    >
                      {messageBusy ? "Opening…" : "Message agent"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onCheckAvailability}
                    className="rounded-xl bg-[#2C2C2C] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-black"
                  >
                    Check availability
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {presaleSection}
        {!isListingAgentUser && agentAsideSection}

        <div className="border-t border-neutral-200 pt-12">{locationSection}</div>
        </div>
      </div>
    </div>
  );
}
