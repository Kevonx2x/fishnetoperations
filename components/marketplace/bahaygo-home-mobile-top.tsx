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

import {
  BahayGoMobilePeekListingCard,
  propertyLocationLine,
} from "@/components/marketplace/bahaygo-mobile-peek-listing-card";
import { formatBrowseNearLine } from "@/lib/browse-location-label";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  defaultHomepageFiltersState,
  type FiltersState,
  type HomePropertyKind,
} from "@/lib/homepage-marketplace-filters";
import { HOMEPAGE_MOBILE_CAROUSEL_INSET, HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH } from "@/lib/homepage-listing-card-layout";
import {
  HomepageMobilePeekRowSkeleton,
  HomepageMobileTrendingSkeleton,
} from "@/components/marketplace/homepage-load-shell";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { DbProperty } from "@/lib/marketplace-property";
import { firstRawPropertyPhotoUrl } from "@/lib/marketplace-property";
import { propertyPhotoHeroUrl, propertyPhotoMobileHeroUrl, isPreOptimizedPropertyPhotoUrl } from "@/lib/cloudinary-property-photo-url";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";
import {
  pickMobileCarouselListings,
  propertyListingLocationKey,
} from "@/lib/homepage-listing-dedupe";
import { cn } from "@/lib/utils";

const PAGE_X = "px-4";
const CAROUSEL_SCROLL =
  "flex overflow-x-auto gap-2.5 pb-0.5 scrollbar-hide snap-x snap-mandatory";
const TRENDING_CARD_W = HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH;

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
  compact = false,
}: {
  id: QuickCategoryId;
  label: string;
  icon: typeof Building2;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex min-w-0 flex-1 flex-col items-center", compact ? "gap-1" : "gap-1.5")}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-white shadow-[0_3px_10px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition active:scale-[0.97]",
          compact ? "size-[44px] rounded-xl" : "size-[52px] rounded-2xl",
          active ? "ring-[#6B9E6E]/50 ring-2" : "ring-black/[0.06]",
        )}
      >
        <Icon
          className={cn(compact ? "size-[18px]" : "size-[22px]", active ? "text-[#3d5240]" : "text-[#6B9E6E]")}
          strokeWidth={2}
          aria-hidden
        />
      </span>
      <span
        className={cn(
          "line-clamp-2 w-full text-center font-semibold leading-tight",
          compact ? "text-[9px]" : "text-[10px]",
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
  return formatBrowseNearLine(place);
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
  return <BahayGoMobilePeekListingCard property={property} mode={mode} engagement={engagement} />;
}

function TrendingHeroCard({
  property,
  mode,
  heroSrc,
  engagement,
  priorityImage = false,
}: {
  property: DbProperty;
  mode: "buy" | "rent" | "all";
  heroSrc: string;
  engagement: PropertyEngagement;
  priorityImage?: boolean;
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
          priorityImage && isPreOptimizedPropertyPhotoUrl(heroSrc) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroSrc}
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              sizes="88vw"
            />
          ) : (
            <Image
              src={heroSrc}
              alt=""
              fill
              className="object-cover"
              sizes="88vw"
              unoptimized={isPreOptimizedPropertyPhotoUrl(heroSrc)}
              priority={priorityImage}
              fetchPriority={priorityImage ? "high" : undefined}
              loading={priorityImage ? "eager" : "lazy"}
            />
          )
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

export type BahayGoHomeMobileStickySearchProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  recentSearches: string[];
  onRecentSearchPick: (q: string) => void;
  onOpenFilters: () => void;
  filters: FiltersState;
  neighborhoodLabel: string | null;
  onLocationChipPress: () => void;
  compact?: boolean;
};

export function BahayGoHomeMobileStickySearch({
  search,
  onSearchChange,
  onSearchSubmit,
  recentSearches,
  onRecentSearchPick,
  onOpenFilters,
  filters,
  neighborhoodLabel,
  onLocationChipPress,
  compact = false,
}: BahayGoHomeMobileStickySearchProps) {
  return (
    <div className={cn(compact ? "space-y-1 py-1" : "space-y-2 py-2", PAGE_X)}>
      <div
        id="bahaygo-hero-search"
        className={cn(
          compact ? "scroll-mt-[7.5rem]" : "scroll-mt-[10.75rem]",
          "flex items-center gap-1.5 border border-[#2C2C2C]/8 bg-white",
          compact
            ? "h-9 rounded-lg px-2 shadow-[0_4px_14px_rgba(44,44,44,0.07)]"
            : "rounded-2xl px-3 py-2 shadow-[0_8px_28px_rgba(44,44,44,0.1)]",
        )}
      >
        <Search className={cn("shrink-0 text-[#888888]", compact ? "size-3.5" : "size-[18px]")} strokeWidth={2} aria-hidden />
        <PhLocationInput
          value={search}
          onChange={onSearchChange}
          onSubmitSearch={onSearchSubmit}
          recentSearches={recentSearches}
          onRecentSearchPick={onRecentSearchPick}
          placeholder="Where do you want to live?"
          aria-label="Search location"
          className="min-w-0 flex-1"
          inputClassName={cn(
            "w-full border-0 bg-transparent p-0 font-medium leading-tight text-[#2C2C2C] shadow-none placeholder:text-[#888888] focus-visible:ring-0",
            compact ? "text-[13px]" : "text-[14px]",
          )}
        />
        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md text-[#2C2C2C]/70",
            compact ? "size-8" : "size-9 rounded-xl",
          )}
          aria-label="Filters"
        >
          <SlidersHorizontal className={compact ? "size-4" : "size-[18px]"} strokeWidth={2} />
        </button>
      </div>

      <div
        className={cn(
          "flex min-w-0 items-center gap-1",
          compact ? "min-h-6 text-[11px]" : "text-[13px]",
        )}
      >
        <MapPin className={cn("shrink-0 text-[#6B9E6E]", compact ? "size-2.5" : "size-3.5")} aria-hidden />
        <span className="min-w-0 truncate font-semibold text-[#2C2C2C]">
          {locationLineLabel(filters, neighborhoodLabel, search)}
        </span>
        <button
          type="button"
          onClick={onLocationChipPress}
          className={cn(
            "ml-auto inline-flex shrink-0 items-center font-semibold text-[#6B9E6E]",
            compact ? "min-h-6 text-[11px]" : "text-[13px]",
          )}
        >
          Change
          <ChevronRight className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export type BahayGoHomeMobileTopProps = {
  mode: "buy" | "rent" | "all";
  search: string;
  onSearchChange: (value: string) => void;
  onBuyRentChange: (target: "buy" | "rent") => void;
  filters: FiltersState;
  onFiltersChange: (updater: (prev: FiltersState) => FiltersState) => void;
  featuredProperty: DbProperty | null;
  featuredIsAdminFeatured: boolean;
  properties: DbProperty[];
  engagement: PropertyEngagement;
  onScrollToListings: () => void;
  compactMobileHome?: boolean;
  listingsLoading?: boolean;
};

export function BahayGoHomeMobileTop({
  mode,
  search,
  onSearchChange,
  onBuyRentChange,
  filters,
  onFiltersChange,
  featuredProperty,
  featuredIsAdminFeatured: _featuredIsAdminFeatured,
  properties,
  engagement,
  onScrollToListings,
  compactMobileHome = false,
  listingsLoading = false,
}: BahayGoHomeMobileTopProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<HTMLDivElement | null>(null);

  const heroSlides = useMemo(() => {
    const ordered: DbProperty[] = [];
    if (featuredProperty) ordered.push(featuredProperty);
    for (const p of properties) {
      if (p.id !== featuredProperty?.id) ordered.push(p);
    }
    return pickMobileCarouselListings(ordered, { limit: 5 });
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

  const newThisWeek = useMemo(() => {
    const excludeIds = new Set(heroSlides.map((p) => p.id));
    const excludeLocationKeys = new Set(heroSlides.map((p) => propertyListingLocationKey(p)));
    const sorted = [...properties].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return pickMobileCarouselListings(sorted, { limit: 8, excludeIds, excludeLocationKeys });
  }, [heroSlides, properties]);

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
      <div className={cn("relative overflow-x-clip bg-[#FAF8F4]", compactMobileHome ? "pb-1" : "pb-2")}>
        <section className={cn("relative", compactMobileHome ? "space-y-1.5 pt-0.5" : "space-y-2.5 pt-2", PAGE_X)}>
          <div className="flex justify-center gap-1.5">
            <FilterChip
              active={mode === "rent"}
              onClick={() => onBuyRentChange("rent")}
              className={cn(
                "min-w-[6.5rem] justify-center px-5",
                compactMobileHome && "py-1 text-[11px]",
              )}
            >
              Rent
            </FilterChip>
            <FilterChip
              active={mode === "buy"}
              onClick={() => onBuyRentChange("buy")}
              className={cn(
                "min-w-[6.5rem] justify-center px-5",
                compactMobileHome && "py-1 text-[11px]",
              )}
            >
              Buy
            </FilterChip>
          </div>

          <div className={cn("flex gap-1", compactMobileHome ? "pt-0" : "gap-1.5 pt-0.5")}>
            {QUICK_CATEGORIES.map(({ id, label, icon }) => (
              <QuickCategoryButton
                key={id}
                id={id}
                label={label}
                icon={icon}
                compact={compactMobileHome}
                active={isQuickCategoryActive(id, filters, search)}
                onClick={() => handleQuickCategory(id)}
              />
            ))}
          </div>
        </section>

        {listingsLoading ? (
          <>
            <HomepageMobileTrendingSkeleton />
            <HomepageMobilePeekRowSkeleton />
          </>
        ) : heroSlides.length > 0 ? (
          <section className={cn(compactMobileHome ? "mt-1" : "mt-2")}>
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
              className={cn(CAROUSEL_SCROLL, HOMEPAGE_MOBILE_CAROUSEL_INSET, compactMobileHome ? "mt-1.5 gap-2" : "mt-2 gap-2.5")}
            >
              {heroSlides.map((p, i) => {
                const raw = firstRawPropertyPhotoUrl(p);
                const src = raw
                  ? i === 0
                    ? propertyPhotoMobileHeroUrl(raw)
                    : propertyPhotoHeroUrl(raw)
                  : "";
                return (
                  <div key={p.id} data-trending-slide>
                    <TrendingHeroCard
                      property={p}
                      mode={mode}
                      heroSrc={src}
                      engagement={engagement}
                      priorityImage={i === 0}
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

        {!listingsLoading && newThisWeek.length > 0 ? (
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
