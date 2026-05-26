"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  PawPrint,
  Search,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  TrainFront,
} from "lucide-react";

import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  defaultHomepageFiltersState,
  type FiltersState,
  type HomePropertyKind,
} from "@/lib/homepage-marketplace-filters";
import { HOMEPAGE_MOBILE_CAROUSEL_INSET } from "@/lib/homepage-listing-card-layout";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { DbProperty } from "@/lib/marketplace-property";
import { firstRawPropertyPhotoUrl, roomUrlsFor } from "@/lib/marketplace-property";
import { propertyPhotoHeroUrl } from "@/lib/cloudinary-property-photo-url";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";
import { cn } from "@/lib/utils";

const PAGE_X = "px-4";
const CAROUSEL_SCROLL =
  "flex overflow-x-auto gap-2.5 pb-0.5 scrollbar-hide snap-x snap-mandatory";
const PEEK_CARD_W = "w-[calc((100vw-2rem-1rem)/2.5)]";
/** ~88% viewport width so the next slide peeks like the reference mock. */
const TRENDING_CARD_W = "w-[calc((100vw-2rem-0.625rem)/1.22)]";

type QuickCategoryId = "condo" | "house" | "mrt" | "pet" | "furnished" | "new";

const QUICK_CATEGORIES: {
  id: QuickCategoryId;
  label: string;
  icon: typeof Building2;
}[] = [
  { id: "condo", label: "Condo", icon: Building2 },
  { id: "house", label: "House", icon: Home },
  { id: "mrt", label: "Near MRT", icon: TrainFront },
  { id: "pet", label: "Pet Friendly", icon: PawPrint },
  { id: "furnished", label: "Furnished", icon: Sofa },
  { id: "new", label: "New", icon: Sparkles },
];

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

function isQuickCategoryActive(
  id: QuickCategoryId,
  filters: FiltersState,
  search: string,
): boolean {
  switch (id) {
    case "condo":
      return filters.homePropertyKind === "condo";
    case "house":
      return filters.homePropertyKind === "house";
    case "mrt":
      return search.trim().toLowerCase() === "mrt";
    case "pet":
      return filters.amenities.includes("pet");
    case "furnished":
      return filters.furnishing === "furnished";
    case "new":
      return false;
    default:
      return false;
  }
}

function QuickCategoryButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: QuickCategoryId;
  label: string;
  icon: typeof Building2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          "flex size-[52px] items-center justify-center rounded-2xl bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] ring-1 transition active:scale-[0.97]",
          active ? "ring-[#6B9E6E]/50 ring-2" : "ring-black/[0.06]",
        )}
      >
        <Icon className={cn("size-[22px]", active ? "text-[#3d5240]" : "text-[#6B9E6E]")} strokeWidth={2} aria-hidden />
      </span>
      <span
        className={cn(
          "line-clamp-2 w-full text-center text-[10px] font-semibold leading-tight",
          active ? "text-[#3d5240]" : "text-[#2C2C2C]",
        )}
      >
        {label}
      </span>
    </button>
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
    <Link
      href={href}
      className={cn(
        PEEK_CARD_W,
        "block shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(44,44,44,0.1)] ring-1 ring-black/[0.04] transition active:scale-[0.99]",
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
        <h3 className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-[#2C2C2C]">
          {property.name?.trim() || property.location}
        </h3>
        <p className="mt-0.5 text-[9px] font-medium text-[#888888]">
          {property.beds} bed · {property.baths} bath · {property.sqft} sqft
        </p>
        <p className="mt-0.5 line-clamp-1 text-[9px] font-medium text-[#888888]">
          {propertyLocationLine(property)}
        </p>
      </div>
    </Link>
  );
}

function TrendingHeroCard({
  property,
  mode,
  heroSrc,
  engagement,
}: {
  property: DbProperty;
  mode: "buy" | "rent" | "all";
  heroSrc: string;
  engagement: PropertyEngagement;
}) {
  const href = `/properties/${encodeURIComponent(property.id)}`;
  const liked = engagement.isLiked(property.id);
  const priceLabel =
    mode === "rent" || property.listing_type === "rent"
      ? formatPropertyPriceDisplay(property.rent_price, "for_rent")
      : formatPropertyPriceDisplay(property.price, property.status);

  return (
    <Link
      href={href}
      className={cn(
        TRENDING_CARD_W,
        "relative block shrink-0 snap-start overflow-hidden rounded-2xl shadow-[0_12px_36px_rgba(44,44,44,0.16)] ring-1 ring-black/[0.06] transition active:scale-[0.99]",
      )}
    >
      <div className="relative aspect-[5/3] w-full bg-[#1a1a1a]">
        {heroSrc ? (
          <Image src={heroSrc} alt="" fill className="object-cover" sizes="88vw" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2C2C2C] to-[#4a4a4a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/95 via-[#1a1a1a]/30 to-transparent" />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void engagement.toggleLike(property.id);
          }}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/[0.08]"
          aria-label={liked ? "Unlike" : "Save"}
        >
          <Heart
            className={cn("size-4", liked ? "fill-red-500 text-red-500" : "text-[#2C2C2C]")}
            strokeWidth={2}
          />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-white">
            {property.name?.trim() || property.location}
          </h3>
          <p className="mt-0.5 text-sm font-bold text-white">{priceLabel}</p>
          <p className="mt-0.5 text-[10px] font-medium text-white/85">
            {property.beds} bed · {property.baths} bath · {property.sqft} sqft
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-white/75">{propertyLocationLine(property)}</p>
        </div>
      </div>
    </Link>
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
  featuredIsAdminFeatured: _featuredIsAdminFeatured,
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

  const handleQuickCategory = (id: QuickCategoryId) => {
    const active = isQuickCategoryActive(id, filters, search);
    const keepLocation = filters.locationLabel;

    if (id === "new") {
      onFiltersChange(() => ({ ...defaultHomepageFiltersState(), locationLabel: keepLocation }));
      onSearchChange("");
      onScrollToListings();
      return;
    }

    if (id === "mrt") {
      if (active) {
        onSearchChange("");
      } else {
        onFiltersChange(() => ({ ...defaultHomepageFiltersState(), locationLabel: keepLocation }));
        onSearchChange("MRT");
      }
      onScrollToListings();
      return;
    }

    onFiltersChange((s) => {
      const cleared: FiltersState = {
        ...defaultHomepageFiltersState(),
        locationLabel: keepLocation,
        minPrice: s.minPrice,
        maxPrice: s.maxPrice,
      };

      if (active) return cleared;

      const next = { ...cleared };
      if (id === "condo") {
        next.homePropertyKind = "condo" as HomePropertyKind;
      } else if (id === "house") {
        next.homePropertyKind = "house" as HomePropertyKind;
      } else if (id === "pet") {
        next.amenities = ["pet"];
      } else if (id === "furnished") {
        next.furnishing = "furnished";
      }
      return next;
    });
    if (search.trim().toLowerCase() === "mrt") onSearchChange("");
    onScrollToListings();
  };

  return (
    <div className="md:hidden overflow-x-clip">
      <div className="relative overflow-x-clip bg-[#FAF8F4] pb-2">
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

          <div className="flex justify-center gap-2">
            <FilterChip
              active={mode === "rent"}
              onClick={() => onBuyRentChange("rent")}
              className="min-w-[7.25rem] justify-center px-6"
            >
              Rent
            </FilterChip>
            <FilterChip
              active={mode === "buy"}
              onClick={() => onBuyRentChange("buy")}
              className="min-w-[7.25rem] justify-center px-6"
            >
              Buy
            </FilterChip>
          </div>

          <div className="flex gap-1.5 pt-0.5">
            {QUICK_CATEGORIES.map(({ id, label, icon }) => (
              <QuickCategoryButton
                key={id}
                id={id}
                label={label}
                icon={icon}
                active={isQuickCategoryActive(id, filters, search)}
                onClick={() => handleQuickCategory(id)}
              />
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
            <div
              ref={heroScrollRef}
              className={cn(CAROUSEL_SCROLL, HOMEPAGE_MOBILE_CAROUSEL_INSET, "mt-2 gap-2.5")}
            >
              {heroSlides.map((p, i) => {
                const raw = firstRawPropertyPhotoUrl(p);
                const src = raw ? propertyPhotoHeroUrl(raw) : "";
                return (
                  <div key={p.id} data-trending-slide>
                    <TrendingHeroCard
                      property={p}
                      mode={mode}
                      heroSrc={src}
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
            <div className={cn(CAROUSEL_SCROLL, HOMEPAGE_MOBILE_CAROUSEL_INSET, "mt-2 gap-2.5")}>
              {newThisWeek.map((p) => (
                <MobileNewCard key={p.id} property={p} mode={mode} engagement={engagement} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
