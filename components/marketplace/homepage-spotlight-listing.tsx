"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Maximize2,
  Star,
} from "lucide-react";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { formatAgentScore } from "@/lib/format-agent-score";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import {
  isPreOptimizedPropertyPhotoUrl,
  propertyPhotoDisplayUrl,
  propertyPhotoHeroUrl,
} from "@/lib/cloudinary-property-photo-url";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { propertyCanonicalCity } from "@/lib/normalize-city";
import { cn } from "@/lib/utils";

const SPOTLIGHT_THUMB_COUNT = 4;

function SpotlightHeroImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!src) {
    return <div className="absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]" aria-hidden />;
  }
  const skipNextOptimizer = isPreOptimizedPropertyPhotoUrl(src);
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/80 transition-opacity duration-500",
          loaded && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized={skipNextOptimizer}
        className={cn("z-[2] object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        sizes="(max-width: 1024px) 100vw, 58vw"
        priority
        onLoadingComplete={() => setLoaded(true)}
      />
    </>
  );
}

function spotlightCopy(isAdminFeatured: boolean, locationLabel: string | null) {
  if (locationLabel) {
    return {
      title: `Spotlight in ${locationLabel}`,
      subtitle: isAdminFeatured
        ? "Hand-picked by BahayGo for this area"
        : "A standout verified listing here",
    };
  }
  return {
    title: "Spotlight listing",
    subtitle: isAdminFeatured
      ? "Hand-picked by the BahayGo team"
      : "One verified listing worth a closer look",
  };
}

function isRecentlyListed(createdAtIso: string): boolean {
  const ms = Date.now() - new Date(createdAtIso).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms < 14 * 24 * 60 * 60 * 1000;
}

function agentsFromProperty(property: DbProperty): MarketplaceAgent[] {
  const nested = (property.property_agents ?? [])
    .map((x) => (x as { agent?: unknown }).agent)
    .filter(Boolean)
    .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
  const dedup = new Map(nested.map((a) => [a.id, a]));
  return [...dedup.values()];
}

export function HomepageSpotlightListing({
  property,
  isAdminFeatured,
  locationLabel,
  connectedAgents,
}: {
  property: DbProperty;
  isAdminFeatured: boolean;
  locationLabel: string | null;
  connectedAgents?: MarketplaceAgent[];
}) {
  const copy = spotlightCopy(isAdminFeatured, locationLabel);
  const title = property.name ?? property.location;
  const isDual =
    property.status === "both" || property.listing_type === "both";
  const areaLabel = propertyCanonicalCity(property) || property.location;
  const showJustUpdated = isRecentlyListed(property.created_at);

  const photoUrls = useMemo(() => {
    const raw = roomUrlsFor(property);
    return raw.map((u) => propertyPhotoHeroUrl(u));
  }, [property]);

  const thumbUrls = useMemo(() => {
    const raw = roomUrlsFor(property);
    return raw.map((u) => propertyPhotoDisplayUrl(u));
  }, [property]);

  const [roomIdx, setRoomIdx] = useState(0);
  const activeSrc = photoUrls[roomIdx] ?? photoUrls[0] ?? "";
  const hasThumbOverflow = thumbUrls.length > SPOTLIGHT_THUMB_COUNT;
  const visibleThumbs = hasThumbOverflow
    ? thumbUrls.slice(0, SPOTLIGHT_THUMB_COUNT - 1)
    : thumbUrls;
  const overflowPhotoCount = hasThumbOverflow
    ? thumbUrls.length - (SPOTLIGHT_THUMB_COUNT - 1)
    : 0;

  const agents = useMemo(() => {
    if (connectedAgents?.length) return connectedAgents;
    return agentsFromProperty(property);
  }, [connectedAgents, property]);

  const primaryAgent = agents[0] ?? null;
  const propertyHref = `/properties/${encodeURIComponent(property.id)}`;

  const goPrev = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (photoUrls.length <= 1) return;
    setRoomIdx((i) => (i - 1 + photoUrls.length) % photoUrls.length);
  };

  const goNext = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (photoUrls.length <= 1) return;
    setRoomIdx((i) => (i + 1) % photoUrls.length);
  };

  return (
    <section className="mt-6 lg:mt-10" aria-labelledby="spotlight-listing-heading">
      <div className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="spotlight-listing-heading"
            className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl"
          >
            {copy.title}
          </h2>
          <Star className="h-4 w-4 shrink-0 fill-[#D4A843] text-[#D4A843]" aria-hidden />
        </div>
        <p className="mt-1 text-sm font-medium text-[#2C2C2C]/55">{copy.subtitle}</p>
      </div>

      <article className="overflow-hidden rounded-3xl border border-[#2C2C2C]/10 bg-white shadow-sm ring-1 ring-black/[0.03]">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="relative aspect-[16/10] bg-[#FAF8F4] lg:aspect-auto lg:min-h-[320px]">
            <SpotlightHeroImage src={activeSrc} alt={title} />

            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
              Verified
            </span>

            {isAdminFeatured ? (
              <span className="absolute right-3 top-3 z-10 rounded-full bg-[#D4A843] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Featured
              </span>
            ) : null}

            {photoUrls.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#2C2C2C] shadow-md ring-1 ring-black/5 transition hover:bg-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#2C2C2C] shadow-md ring-1 ring-black/5 transition hover:bg-white"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : null}

            {visibleThumbs.length > 0 ? (
              <div className="absolute inset-x-3 bottom-3 z-10 flex gap-2">
                {visibleThumbs.map((src, i) => {
                  const isActive = i === roomIdx;
                  return (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRoomIdx(i);
                      }}
                      className={cn(
                        "relative h-12 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-14 sm:w-[4.25rem]",
                        isActive ? "ring-white" : "ring-white/40 hover:ring-white/70",
                      )}
                      aria-label={`Show photo ${i + 1}`}
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        unoptimized={isPreOptimizedPropertyPhotoUrl(src)}
                        className="object-cover"
                        sizes="68px"
                      />
                    </button>
                  );
                })}
                {hasThumbOverflow ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ring-white/40 transition hover:ring-white/70 sm:h-14 sm:w-[4.25rem]"
                    aria-label={`${overflowPhotoCount} more photos`}
                  >
                    <Image
                      src={thumbUrls[SPOTLIGHT_THUMB_COUNT - 1]!}
                      alt=""
                      fill
                      unoptimized={isPreOptimizedPropertyPhotoUrl(thumbUrls[SPOTLIGHT_THUMB_COUNT - 1]!)}
                      className="object-cover"
                      sizes="68px"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">
                      +{overflowPhotoCount}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-center p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#6B9E6E]">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{areaLabel}</span>
              </p>
              {showJustUpdated ? (
                <span className="shrink-0 rounded-full bg-[#E8F3E9] px-3 py-1 text-xs font-semibold text-[#4a7a4d]">
                  Just updated
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 font-serif text-xl font-semibold leading-snug tracking-tight text-[#2C2C2C] sm:text-2xl">
              {title}
              {property.sqft ? (
                <span className="font-normal text-[#2C2C2C]/70"> — {property.sqft}</span>
              ) : null}
            </h3>

            {isDual ? (
              <div className="mt-3 space-y-0.5">
                <p className="text-lg font-semibold text-[#D4A843] sm:text-xl">
                  Sale {formatPropertyPriceDisplay(property.price, "for_sale")}
                </p>
                <p className="text-base font-semibold text-[#2C2C2C]/85">
                  Rent {formatPropertyPriceDisplay(property.rent_price, "for_rent")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-lg font-semibold text-[#D4A843] sm:text-xl">
                {formatPropertyPriceDisplay(
                  property.status === "for_rent" || property.status === "rented"
                    ? (property.rent_price ?? property.price)
                    : property.price,
                  property.status === "for_rent" || property.status === "rented"
                    ? "for_rent"
                    : property.status,
                )}
              </p>
            )}

            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-[#2C2C2C]/60">
              <li className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 shrink-0 text-[#2C2C2C]/40" aria-hidden />
                {property.beds ? `${property.beds} beds` : "Studio"}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Bath className="h-4 w-4 shrink-0 text-[#2C2C2C]/40" aria-hidden />
                {property.baths} baths
              </li>
              {property.sqft ? (
                <li className="inline-flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4 shrink-0 text-[#2C2C2C]/40" aria-hidden />
                  {property.sqft}
                </li>
              ) : null}
            </ul>

            {primaryAgent ? (
              <div className="mt-5 flex items-center gap-3 border-t border-[#2C2C2C]/8 pt-5">
                <Link
                  href={`/agents/${encodeURIComponent(primaryAgent.id)}`}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
                >
                  <AgentAvatarFill
                    name={primaryAgent.name}
                    imageUrl={primaryAgent.image}
                    sizes="44px"
                    textClassName="text-xs"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link
                      href={`/agents/${encodeURIComponent(primaryAgent.id)}`}
                      className="font-semibold text-[#2C2C2C] hover:underline"
                    >
                      {primaryAgent.name}
                    </Link>
                    {primaryAgent.verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B9E6E]">
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Verified Agent
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-[#2C2C2C]/55">
                    <Star className="h-3.5 w-3.5 shrink-0 fill-[#D4A843] text-[#D4A843]" aria-hidden />
                    <span className="font-semibold text-[#2C2C2C]">{formatAgentScore(primaryAgent.score)}</span>
                    {primaryAgent.closings > 0 ? (
                      <span className="text-[#2C2C2C]/45">({primaryAgent.closings})</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : null}

            <Link
              href={propertyHref}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#6B9E6E] bg-transparent px-6 py-3 text-sm font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/8 sm:w-auto"
            >
              View listing
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
