"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  MapPin,
  Sparkles,
  Wifi,
} from "lucide-react";

import { DormspaceBrowse, type DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import { DormspaceBrowseBySchoolSection } from "@/components/dormspaces/dormspace-browse-by-school-section";
import { DormspaceCommunityCta } from "@/components/dormspaces/dormspace-community-cta";
import { DormspaceFeaturedNeighborhoodsSection } from "@/components/dormspaces/dormspace-featured-neighborhoods-section";
import { DormspaceHomepageFaqSection } from "@/components/dormspaces/dormspace-homepage-faq-section";
import { DormspaceNewThisWeekSection } from "@/components/dormspaces/dormspace-new-this-week-section";
import { DormspacePublicHomeMobile, DormspaceMobileStickySearch } from "@/components/dormspaces/dormspace-public-home-mobile";
import { MobileFixedSearchShell } from "@/components/marketplace/mobile-fixed-search-shell";
import { MOBILE_DORMSPACE_STICKY_CHROME_SCROLL_MARGIN } from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";
import { HomepageArticlesSection } from "@/components/marketplace/homepage-articles-section";
import { DormspaceRecommendedSection } from "@/components/dormspaces/dormspace-recommended-section";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  EMPTY_DORMSPACE_BROWSE_FILTERS,
} from "@/lib/dormspace-browse-filters";
import {
  DORMSPACE_HERO_IMAGE,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import type { UniversityRow } from "@/lib/universities";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";
import { cn } from "@/lib/utils";
import { useDormspaceFeaturedNeighborhoods } from "@/hooks/use-dormspace-featured-neighborhoods";

const FIELD =
  "rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

const POLAROID_A =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=200&h=240&fit=crop";
const POLAROID_B =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=240&fit=crop";

function parseCityFromLocation(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const parts = t.split(",").map((p) => p.trim());
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : t;
}

export function DormspacePublicHome({
  listings,
  universities,
  initialFeaturedNeighborhoods,
  initialUniversityId = "",
  initialNeighborhood = "",
}: {
  listings: DormspaceWithPhotos[];
  universities: UniversityRow[];
  initialFeaturedNeighborhoods: DormspacePopularArea[];
  initialUniversityId?: string;
  initialNeighborhood?: string;
}) {
  const { data: featuredNeighborhoods = initialFeaturedNeighborhoods } =
    useDormspaceFeaturedNeighborhoods(initialFeaturedNeighborhoods);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#listings") return;
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!initialUniversityId && !initialNeighborhood) return;
    setFilters({
      ...EMPTY_DORMSPACE_BROWSE_FILTERS,
      universityId: initialUniversityId,
      neighborhood: initialNeighborhood,
    });
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [initialUniversityId, initialNeighborhood]);

  const [locationQuery, setLocationQuery] = useState("");
  const [roomType, setRoomType] = useState<"" | DormspaceRoomType>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [filters, setFilters] = useState<DormspaceBrowseFilters>(EMPTY_DORMSPACE_BROWSE_FILTERS);

  const applySearch = () => {
    const city = parseCityFromLocation(locationQuery);
    setFilters({
      ...EMPTY_DORMSPACE_BROWSE_FILTERS,
      city,
      roomType,
      minPrice,
      maxPrice,
    });
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToListings = () => {
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyMobileBrowseFilter = (partial: Partial<DormspaceBrowseFilters>) => {
    setFilters((f) => ({ ...f, ...partial }));
    if (partial.city) setLocationQuery(partial.city);
  };

  const dormspaceLocationLabel = locationQuery.trim()
    ? `Near ${locationQuery.trim()}`
    : filters.city.trim()
      ? `Near ${filters.city.trim()}`
      : "Near DLSU, Taft Ave.";

  return (
    <>
      <MobileFixedSearchShell>
        <DormspaceMobileStickySearch
          locationQuery={locationQuery}
          onLocationChange={setLocationQuery}
          onSearch={applySearch}
          onScrollToListings={scrollToListings}
          locationLabel={dormspaceLocationLabel}
        />
      </MobileFixedSearchShell>

      <DormspacePublicHomeMobile
        universities={universities}
        listings={listings}
        neighborhoods={featuredNeighborhoods}
        onBrowseFilter={applyMobileBrowseFilter}
        onScrollToListings={scrollToListings}
      />

      <div className="hidden md:contents">
      <section className="relative overflow-hidden bg-[#FAF8F4]">
        <div className="pointer-events-none absolute -right-24 top-8 size-64 rounded-full bg-[#D4A843]/12 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-16 bottom-0 size-48 rounded-full bg-[#6B9E6E]/10 blur-3xl" aria-hidden />

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:pt-8 lg:pb-4">
          <div className="order-2 lg:order-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#D4A843]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#8a6d32]">
              <Sparkles className="size-3.5" aria-hidden />
              Student housing, verified
            </p>
            <h1 className="mt-3 font-serif text-[1.75rem] font-bold leading-[1.12] tracking-tight text-[#2C2C2C] sm:mt-4 sm:text-4xl md:text-[2.65rem]">
              Find your space.
              <br />
              Live your{" "}
              <span className="text-[#C49A2E]">campus life.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-[#484848] md:text-lg">
              Verified dorms and rooms near your school. Safe, affordable, and student-approved across Metro
              Manila.
            </p>

            <div className="mt-5 rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-[0_4px_20px_rgba(44,44,44,0.08)] sm:mt-6 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                <div className="min-w-0 flex-1">
                  <PhLocationInput
                    value={locationQuery}
                    onChange={setLocationQuery}
                    onSubmitSearch={applySearch}
                    placeholder="Find your space near campus"
                    inputClassName="w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium"
                    aria-label="Location"
                  />
                </div>
                <select
                  className={`${FIELD} min-w-[140px] lg:max-w-[180px]`}
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value as "" | DormspaceRoomType)}
                  aria-label="Room type"
                >
                  <option value="">Any room type</option>
                  {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applySearch}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E] px-8 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] lg:h-auto lg:min-h-[44px]"
                >
                  Search
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowMoreFilters((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#6B9E6E] hover:underline"
              >
                More filters
                <ChevronDown
                  className={`size-3.5 transition ${showMoreFilters ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>

              {showMoreFilters ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                    Min ₱/mo
                    <input
                      className={FIELD}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                    Max ₱/mo
                    <input
                      className={FIELD}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative order-1 lg:order-2 lg:min-h-[400px]">
            <div className="relative mx-auto aspect-[16/10] max-h-[200px] w-full max-w-sm overflow-hidden rounded-2xl shadow-[0_8px_28px_rgba(44,44,44,0.12)] sm:max-h-[220px] lg:mx-0 lg:aspect-[4/5] lg:h-[400px] lg:max-h-none lg:max-w-none lg:rounded-3xl lg:shadow-[0_16px_40px_rgba(44,44,44,0.14)]">
              <Image
                src={DORMSPACE_HERO_IMAGE}
                alt=""
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e22]/50 via-transparent to-transparent" />

              <div className="absolute left-3 top-3 z-10 max-w-[9.5rem] rounded-xl bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm lg:left-4 lg:top-4 lg:max-w-[11rem] lg:rounded-2xl lg:px-3 lg:py-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold text-[#2C2C2C] lg:text-[11px]">
                  <MapPin className="size-3 text-[#6B9E6E] lg:size-3.5" aria-hidden />
                  Near campus
                </p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#888888] lg:text-[10px]">
                  Walking distance to schools
                </p>
              </div>
              <div className="absolute bottom-3 right-3 z-10 hidden max-w-[9rem] rounded-xl bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm sm:block lg:bottom-20 lg:max-w-[10rem] lg:rounded-2xl">
                <p className="flex items-center gap-1 text-[10px] font-bold text-[#2C2C2C] lg:text-[11px]">
                  <Wifi className="size-3 text-[#6B9E6E] lg:size-3.5" aria-hidden />
                  Wi-Fi included
                </p>
                <p className="mt-0.5 text-[9px] font-semibold text-[#888888] lg:text-[10px]">Study-ready speeds</p>
              </div>
              <div className="absolute bottom-3 left-3 z-10 rounded-xl bg-[#D4A843]/95 px-2.5 py-1.5 shadow-md lg:bottom-4 lg:left-4 lg:rounded-2xl lg:px-3 lg:py-2">
                <p className="text-[10px] font-bold text-[#2C2C2C] lg:text-[11px]">Move-in ready</p>
                <p className="text-[9px] font-semibold text-[#484848] lg:text-[10px]">Verified landlords</p>
              </div>
            </div>

            <div
              className="absolute -left-2 top-8 z-20 hidden w-[88px] rotate-[-8deg] overflow-hidden rounded-lg border-[3px] border-white bg-white p-1 shadow-xl sm:block lg:-left-6"
              aria-hidden
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                <Image src={POLAROID_A} alt="" fill className="object-cover" sizes="88px" />
              </div>
            </div>
            <div
              className="absolute -right-1 bottom-16 z-20 hidden w-[80px] rotate-[6deg] overflow-hidden rounded-lg border-[3px] border-white bg-white p-1 shadow-xl sm:block lg:-right-4"
              aria-hidden
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                <Image src={POLAROID_B} alt="" fill className="object-cover" sizes="80px" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <DormspaceNewThisWeekSection listings={listings} />

      <DormspaceBrowseBySchoolSection
        universities={universities}
        listings={listings}
        onSelectUniversity={(partial) => {
          setFilters((f) => ({ ...f, ...partial }));
        }}
      />

      <DormspaceFeaturedNeighborhoodsSection
        listings={listings}
        neighborhoods={featuredNeighborhoods}
        activeNeighborhood={filters.neighborhood}
        onSelectNeighborhood={(partial) => {
          setFilters((f) => ({ ...f, ...partial }));
        }}
        onClearNeighborhood={() => {
          setFilters(EMPTY_DORMSPACE_BROWSE_FILTERS);
        }}
      />

      <DormspaceRecommendedSection listings={listings} />

      <div className="hidden md:block">
        <hr className="mx-auto mt-2 w-3/4 border-t border-[#2C2C2C]/10" />
        <DormspaceCommunityCta />
        <DormspaceHomepageFaqSection className="mt-4" />
        <HomepageArticlesSection className="mt-2 pb-8" showViewAllLink={false} />
      </div>

      </div>

      <div id="listings" className={cn("md:scroll-mt-24", MOBILE_DORMSPACE_STICKY_CHROME_SCROLL_MARGIN)}>
        <div className="border-t border-black/[0.06] bg-[#FAF8F4] px-5 py-4 md:hidden">
          <h2 className="font-serif text-[18px] font-semibold leading-tight tracking-tight text-[#2C2C2C]">
            All listings
          </h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#888888]">Verified bedspaces near you</p>
        </div>
        <DormspaceBrowse
          listings={listings}
          featuredNeighborhoods={featuredNeighborhoods}
          filters={filters}
          onFiltersChange={(next) => {
            setFilters(next);
          }}
          syncLocationToHero={setLocationQuery}
        />
      </div>
    </>
  );
}

