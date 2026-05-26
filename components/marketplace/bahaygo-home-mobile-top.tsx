"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Flame,
  Footprints,
  Heart,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";

import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  defaultHomepageFiltersState,
  formatHomepageFilterPrice,
  type FiltersState,
  type HomePropertyKind,
} from "@/lib/homepage-marketplace-filters";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { DbProperty } from "@/lib/marketplace-property";
import { firstRawPropertyPhotoUrl, roomUrlsFor } from "@/lib/marketplace-property";
import { propertyPhotoHeroUrl } from "@/lib/cloudinary-property-photo-url";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";
import { cn } from "@/lib/utils";

const PAGE_X = "px-4";
const CAROUSEL_SCROLL =
  "flex overflow-x-auto gap-2.5 pb-0.5 scrollbar-hide snap-x snap-mandatory scroll-pl-4 scroll-pr-4";
const PEEK_CARD_W = "w-[calc((100vw-2rem-1rem)/2.5)]";
/** ~88% viewport width so the next slide peeks like the reference mock. */
const TRENDING_CARD_W = "w-[calc((100vw-2rem-0.625rem)/1.22)]";

const LIFESTYLE_COLLECTIONS = [
  {
    id: "minimal",
    title: "Minimal & Modern",
    count: "128 listings",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=480&h=360&fit=crop",
  },
  {
    id: "city-views",
    title: "City Views",
    count: "94 listings",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=480&h=360&fit=crop",
  },
  {
    id: "luxury",
    title: "Luxury Living",
    count: "56 listings",
    imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=480&h=360&fit=crop",
  },
  {
    id: "cozy",
    title: "Cozy Homes",
    count: "72 listings",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=480&h=360&fit=crop",
  },
] as const;

const VALUE_CARDS = [
  { icon: ShieldCheck, title: "Verified Listings", sub: "Checked" },
  { icon: Wifi, title: "Fast & Stable WiFi", sub: "Reliable" },
  { icon: Footprints, title: "Walkable to Campus", sub: "Convenient" },
  { icon: Shield, title: "No Broker Spam", sub: "Guaranteed" },
] as const;

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: ReactNode;
  onSeeAll?: () => void;
}) {
  return (
    <div className={cn("flex items-baseline justify-between", PAGE_X)}>
      <h2 className="font-serif text-[18px] font-semibold leading-tight text-[#2C2C2C]">{title}</h2>
      {onSeeAll ? (
        <button type="button" onClick={onSeeAll} className="text-[13px] font-semibold text-[#888888]">
          See all
          <ChevronRight className="inline size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-semibold shadow-[0_2px_8px_rgba(44,44,44,0.06)] ring-1 transition",
        active
          ? "bg-[#3d5240] text-white ring-[#3d5240]"
          : "bg-white text-[#2C2C2C] ring-black/[0.08]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function priceChipLabel(filters: FiltersState, mode: "buy" | "rent" | "all"): string {
  const defaultMax = 350_000_000;
  if (filters.minPrice === 0 && filters.maxPrice === defaultMax) {
    return mode === "rent" ? "₱15k – ₱40k" : "Any price";
  }
  return `${formatHomepageFilterPrice(filters.minPrice)} – ${formatHomepageFilterPrice(filters.maxPrice)}`;
}

function locationLineLabel(
  filters: FiltersState,
  neighborhoodLabel: string | null,
  search: string,
): string {
  const place = filters.locationLabel || neighborhoodLabel || search.trim();
  if (place) return `Near ${place}`;
  return "Near Metro Manila";
}

function propertyLocationLine(property: DbProperty): string {
  const city = property.city?.trim() || property.neighborhood?.trim();
  const loc = property.location?.trim();
  if (city && loc) return `${city} · ${loc}`;
  return city || loc || "Metro Manila";
}

function MobileNewCard({
  property,
  mode,
  engagement,
}: {
  property: DbProperty;
  mode: "buy" | "rent" | "all";
  engagement: PropertyEngagement;
}) {
  const img = roomUrlsFor(property)[0] ?? property.image_url ?? "";
  const href = `/properties/${encodeURIComponent(property.id)}`;
  const liked = engagement.isLiked(property.id);
  const priceLabel =
    mode === "rent" || property.listing_type === "rent"
      ? formatPropertyPriceDisplay(property.rent_price, "for_rent")
      : formatPropertyPriceDisplay(property.price, property.status);

  return (
    <article
      className={cn(
        PEEK_CARD_W,
        "shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(44,44,44,0.1)] ring-1 ring-black/[0.04]",
      )}
    >
      <div className="relative aspect-[5/4] w-full bg-[#F3F0EA]">
        {img ? <ListingCardPhoto src={img} alt="" sizes="40vw" eager /> : null}
        <span className="absolute left-2 top-2 rounded bg-[#6B9E6E] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
          NEW
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            void engagement.toggleLike(property.id);
          }}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/[0.06]"
          aria-label={liked ? "Unlike" : "Save"}
        >
          <Heart
            className={cn("size-3.5", liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]/80")}
            strokeWidth={2}
          />
        </button>
      </div>
      <Link href={href} className="block px-2.5 pb-2.5 pt-2">
        <p className="text-[13px] font-bold leading-none text-[#C49A2E]">{priceLabel}</p>
        <h3 className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-[#2C2C2C]">
          {property.name?.trim() || property.location}
        </h3>
        <p className="mt-0.5 text-[9px] font-medium text-[#888888]">
          {property.beds} bed · {property.baths} bath · {property.sqft} sqft
        </p>
        <p className="mt-0.5 line-clamp-1 text-[9px] font-medium text-[#888888]">
          {propertyLocationLine(property)}
        </p>
      </Link>
    </article>
  );
}

function TrendingHeroCard({
  property,
  mode,
  heroSrc,
  showTrendingBadge,
  engagement,
}: {
  property: DbProperty;
  mode: "buy" | "rent" | "all";
  heroSrc: string;
  showTrendingBadge: boolean;
  engagement: PropertyEngagement;
}) {
  const href = `/properties/${encodeURIComponent(property.id)}`;
  const liked = engagement.isLiked(property.id);
  const priceLabel =
    mode === "rent" || property.listing_type === "rent"
      ? formatPropertyPriceDisplay(property.rent_price, "for_rent")
      : formatPropertyPriceDisplay(property.price, property.status);

  return (
    <article
      className={cn(
        TRENDING_CARD_W,
        "relative shrink-0 snap-start overflow-hidden rounded-2xl shadow-[0_12px_36px_rgba(44,44,44,0.16)] ring-1 ring-black/[0.06]",
      )}
    >
      <div className="relative aspect-[5/3] w-full bg-[#1a1a1a]">
        {heroSrc ? (
          <Image src={heroSrc} alt="" fill className="object-cover" sizes="88vw" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2C2C2C] to-[#4a4a4a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/95 via-[#1a1a1a]/30 to-transparent" />

        {showTrendingBadge ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-[#1f1f1f]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <Flame className="size-3 text-[#E07A3A]" aria-hidden />
            Trending
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => void engagement.toggleLike(property.id)}
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/[0.08]"
          aria-label={liked ? "Unlike" : "Save"}
        >
          <Heart
            className={cn("size-4", liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]")}
            strokeWidth={2}
          />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-white">
                {property.name?.trim() || property.location}
              </h3>
              <p className="mt-0.5 text-sm font-bold text-white">{priceLabel}</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/85">
                {property.beds} bed · {property.baths} bath · {property.sqft} sqft
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-white/75">{propertyLocationLine(property)}</p>
            </div>
            <Link
              href={href}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-white px-3 text-[11px] font-bold text-[#2C2C2C] shadow-md"
            >
              View Details
              <ChevronRight className="ml-0.5 size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export type BahayGoHomeMobileTopProps = {
  mode: "buy" | "rent" | "all";
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  recentSearches: string[];
  onRecentSearchPick: (q: string) => void;
  onBuyRentChange: (target: "buy" | "rent") => void;
  filters: FiltersState;
  onFiltersChange: (updater: (prev: FiltersState) => FiltersState) => void;
  onOpenFilters: () => void;
  neighborhoodLabel: string | null;
  featuredProperty: DbProperty | null;
  featuredIsAdminFeatured: boolean;
  properties: DbProperty[];
  engagement: PropertyEngagement;
  onScrollToListings: () => void;
  onLocationChipPress: () => void;
};

export function BahayGoHomeMobileTop({
  mode,
  search,
  onSearchChange,
  onSearchSubmit,
  recentSearches,
  onRecentSearchPick,
  onBuyRentChange,
  filters,
  onFiltersChange,
  onOpenFilters,
  neighborhoodLabel,
  featuredProperty,
  featuredIsAdminFeatured,
  properties,
  engagement,
  onScrollToListings,
  onLocationChipPress,
}: BahayGoHomeMobileTopProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<HTMLDivElement | null>(null);

  const heroSlides = useMemo(() => {
    const out: DbProperty[] = [];
    if (featuredProperty) out.push(featuredProperty);
    for (const p of properties) {
      if (out.length >= 5) break;
      if (p.id !== featuredProperty?.id) out.push(p);
    }
    return out;
  }, [featuredProperty, properties]);

  useEffect(() => {
    const node = heroScrollRef.current;
    if (!node) return;
    const onScroll = () => {
      const children = node.querySelectorAll<HTMLElement>("[data-trending-slide]");
      if (!children.length) return;
      const left = node.scrollLeft;
      let best = 0;
      let bestDist = Infinity;
      children.forEach((el, i) => {
        const dist = Math.abs(el.offsetLeft - left);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setHeroIndex(best);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [heroSlides.length]);

  const newThisWeek = useMemo(
    () =>
      [...properties]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [properties],
  );

  const condoActive = filters.homePropertyKind === "condo";

  return (
    <div className="md:hidden">
      <div className="relative overflow-hidden bg-[#FAF8F4] pb-2">
        <section className={cn("relative space-y-2.5 pt-2", PAGE_X)}>
          <div
            id="bahaygo-hero-search"
            className="scroll-mt-20 rounded-2xl border border-[#2C2C2C]/8 bg-white px-3 py-2 shadow-[0_8px_28px_rgba(44,44,44,0.1)]"
          >
            <div className="flex items-center gap-2">
              <Search className="size-[18px] shrink-0 text-[#888888]" strokeWidth={2} aria-hidden />
              <PhLocationInput
                value={search}
                onChange={onSearchChange}
                onSubmitSearch={onSearchSubmit}
                recentSearches={recentSearches}
                onRecentSearchPick={onRecentSearchPick}
                placeholder="Where do you want to live?"
                aria-label="Search location"
                className="min-w-0 flex-1"
                inputClassName="w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#2C2C2C] shadow-none placeholder:text-[#888888] focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={onOpenFilters}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[#2C2C2C]/70"
                aria-label="Filters"
              >
                <SlidersHorizontal className="size-[18px]" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[13px]">
            <MapPin className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
            <span className="font-semibold text-[#2C2C2C]">
              {locationLineLabel(filters, neighborhoodLabel, search)}
            </span>
            <button
              type="button"
              onClick={onLocationChipPress}
              className="ml-auto inline-flex items-center text-[13px] font-semibold text-[#6B9E6E]"
            >
              Change
              <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <FilterChip active={mode === "rent"} onClick={() => onBuyRentChange("rent")}>
              Rent
            </FilterChip>
            <FilterChip active={mode === "buy"} onClick={() => onBuyRentChange("buy")}>
              Buy
            </FilterChip>
            <FilterChip
              active={condoActive}
              onClick={() => {
                onFiltersChange((s) => ({
                  ...s,
                  homePropertyKind: condoActive ? "any" : ("condo" as HomePropertyKind),
                  propertyType: "any",
                }));
                onScrollToListings();
              }}
            >
              <Building2 className="size-3.5 text-[#6B9E6E]" aria-hidden />
              Condo
            </FilterChip>
            <FilterChip onClick={onOpenFilters}>{priceChipLabel(filters, mode)}</FilterChip>
            <FilterChip onClick={onOpenFilters}>… More</FilterChip>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {VALUE_CARDS.map(({ icon: Icon, title, sub }) => (
              <div
                key={title}
                className="flex flex-col items-center rounded-xl bg-white px-1 py-2 text-center shadow-[0_2px_10px_rgba(44,44,44,0.06)] ring-1 ring-black/[0.05]"
              >
                <Icon className="size-4 text-[#6B9E6E]" strokeWidth={2} aria-hidden />
                <p className="mt-1 line-clamp-2 text-[8px] font-bold leading-[1.1] text-[#2C2C2C]">{title}</p>
                <p className="line-clamp-1 text-[7px] font-semibold text-[#888888]">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {heroSlides.length > 0 ? (
          <section className="mt-2">
            <SectionHeader
              title={
                <>
                  Trending Near You <span aria-hidden>🔥</span>
                </>
              }
              onSeeAll={onScrollToListings}
            />
            <div ref={heroScrollRef} className={cn(CAROUSEL_SCROLL, "mt-2 gap-2.5 pl-4 pr-4")}>
              {heroSlides.map((p, i) => {
                const raw = firstRawPropertyPhotoUrl(p);
                const src = raw ? propertyPhotoHeroUrl(raw) : "";
                return (
                  <div key={p.id} data-trending-slide>
                    <TrendingHeroCard
                      property={p}
                      mode={mode}
                      heroSrc={src}
                      showTrendingBadge={featuredIsAdminFeatured && i === 0}
                      engagement={engagement}
                    />
                  </div>
                );
              })}
            </div>
            {heroSlides.length > 1 ? (
              <div className="mt-2 flex justify-center gap-1.5">
                {heroSlides.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const el = heroScrollRef.current?.querySelectorAll<HTMLElement>("[data-trending-slide]")[i];
                      el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
                      setHeroIndex(i);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === heroIndex ? "w-5 bg-[#6B9E6E]" : "w-1.5 bg-[#2C2C2C]/20",
                    )}
                    aria-label={`Show listing ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {newThisWeek.length > 0 ? (
          <section className="mt-2.5">
            <SectionHeader title="New This Week" onSeeAll={onScrollToListings} />
            <div className={cn(CAROUSEL_SCROLL, "mt-2 gap-2.5 pl-4 pr-4")}>
              {newThisWeek.map((p) => (
                <MobileNewCard key={p.id} property={p} mode={mode} engagement={engagement} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-2.5 pb-2">
          <SectionHeader title="Explore by Lifestyle" onSeeAll={onScrollToListings} />
          <div className={cn("mt-2 grid grid-cols-4 gap-2", PAGE_X)}>
            {LIFESTYLE_COLLECTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onFiltersChange(() => defaultHomepageFiltersState());
                  onScrollToListings();
                }}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl text-left shadow-[0_6px_18px_rgba(44,44,44,0.12)] ring-1 ring-black/[0.05]"
              >
                <Image src={c.imageUrl} alt="" fill className="object-cover" sizes="25vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/85 via-[#1a1a1a]/15 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                  <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white">{c.title}</p>
                  <p className="mt-0.5 text-[7px] font-medium text-white/80">{c.count}</p>
                </div>
                <span className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-white/95 shadow-sm">
                  <ChevronRight className="size-2.5 text-[#2C2C2C]" aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
