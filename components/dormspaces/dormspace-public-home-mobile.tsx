"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

import {

  ChevronRight,

  Heart,

  MapPin,

  Search,

  SlidersHorizontal,

} from "lucide-react";



import {
  MOBILE_DORMSPACE_CAROUSEL_TRACK,
  MOBILE_HORIZONTAL_SCROLL_STYLE,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";
import type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";

import {

  DORMSPACE_HOME_DEMO_NEW,

  DORMSPACE_HOME_DEMO_RECOMMENDED,

  formatDemoPrice,

  type DormspaceHomeDemoListing,

} from "@/lib/dormspace-homepage-demo";

import { countListingsInPopularArea } from "@/lib/dormspace-popular-areas";

import type { DormspaceWithPhotos } from "@/lib/dormspaces";

import {

  formatUniversityListingCount,

  universityInitials,

  type UniversityRow,

} from "@/lib/universities";

import { formatBrowseNearLine } from "@/lib/browse-location-label";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import { cn } from "@/lib/utils";



type Props = {

  universities: UniversityRow[];

  listings: DormspaceWithPhotos[];

  neighborhoods: DormspacePopularArea[];

  onBrowseFilter: (partial: Partial<DormspaceBrowseFilters>) => void;

  onScrollToListings: () => void;

  compactMobileHome?: boolean;

};



export type DormspaceMobileStickySearchProps = {

  locationQuery: string;

  onLocationChange: (value: string) => void;

  onSearch: () => void;

  onScrollToListings: () => void;

  onLocationChipPress: () => void;

  locationLabel?: string;

  compact?: boolean;

};



export function DormspaceMobileStickySearch({

  locationQuery,

  onLocationChange,

  onSearch,

  onScrollToListings,

  onLocationChipPress,

  locationLabel = "Near DLSU, Taft Ave.",

  compact = false,

}: DormspaceMobileStickySearchProps) {

  return (

    <section className={cn(PAGE_X, compact ? "space-y-1 py-1" : "space-y-2 py-2")}>

      <div

        id="dormspace-hero-search"

        className={cn(

          "flex items-center gap-1.5 border border-[#2C2C2C]/10 bg-white",

          compact

            ? "h-9 rounded-lg px-2 shadow-[0_4px_14px_rgba(44,44,44,0.07)]"

            : "h-12 rounded-2xl px-3.5 shadow-[0_2px_14px_rgba(44,44,44,0.06)]",

        )}

      >

        <Search className={cn("shrink-0 text-[#888888]", compact ? "size-3.5" : "size-[18px]")} strokeWidth={2.25} aria-hidden />

        <PhLocationInput

          value={locationQuery}

          onChange={onLocationChange}

          onSubmitSearch={onSearch}

          placeholder="Find your space near campus"

          aria-label="Search location"

          className="min-w-0 flex-1"

          inputClassName={cn(

            "w-full border-0 bg-transparent p-0 font-medium leading-tight text-[#2C2C2C] shadow-none placeholder:text-[#888888] focus-visible:ring-0",

            compact ? "text-[13px]" : "text-[14px]",

          )}

        />

        <button

          type="button"

          onClick={onScrollToListings}

          className={cn(

            "flex shrink-0 items-center justify-center rounded-md text-[#2C2C2C]/60",

            compact ? "size-8" : "size-8",

          )}

          aria-label="Open filters"

        >

          <SlidersHorizontal className={compact ? "size-4" : "size-[18px]"} strokeWidth={2} />

        </button>

      </div>



      <div className={cn("flex min-w-0 items-center gap-1", compact ? "min-h-6 text-[11px]" : "text-[13px]")}>

        <MapPin className={cn("shrink-0 text-[#6B9E6E]", compact ? "size-2.5" : "size-3.5")} aria-hidden />

        <span className="min-w-0 truncate font-semibold text-[#2C2C2C]">{locationLabel}</span>

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

    </section>

  );

}



const PAGE_X = "px-5";

const SECTION = "mt-5";

const PEEK_CARD_W = "w-[calc((100vw-2rem-1rem)/2.5)]";

const UNIVERSITY_SCROLL = cn(MOBILE_DORMSPACE_CAROUSEL_TRACK, "gap-4 pb-1");



function SectionHeader({

  title,

  subtitle,

  actionLabel,

  onAction,

}: {

  title: string;

  subtitle?: string;

  actionLabel?: string;

  onAction?: () => void;

}) {

  return (

    <div className="px-4">

      <div className="flex items-baseline justify-between gap-3">

        <h2 className="font-serif text-[18px] font-semibold leading-tight tracking-tight text-[#2C2C2C]">

          {title}

        </h2>

        {actionLabel && onAction ? (

          <button

            type="button"

            onClick={onAction}

            className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#888888]"

          >

            {actionLabel}

            <ChevronRight className="size-3.5" aria-hidden />

          </button>

        ) : null}

      </div>

      {subtitle ? (

        <p className="mt-1 text-[12px] font-medium text-[#888888]">{subtitle}</p>

      ) : null}

    </div>

  );

}



function formatNeighborhoodListingCount(count: number): string {

  if (count <= 0) return "Listings coming soon";

  if (count >= 120) return "120+ listings";

  return `${count} listing${count === 1 ? "" : "s"}`;

}



function UniversityAvatar({ university }: { university: UniversityRow }) {

  const initials = universityInitials(university.short_name);



  return (

    <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-[#E8F0E9] ring-1 ring-[#6B9E6E]/20">

      {university.image_url ? (

        <Image

          src={university.image_url}

          alt=""

          fill

          className="object-cover"

          sizes="80px"

        />

      ) : (

        <span className="flex size-full items-center justify-center text-[18px] font-bold text-[#6B9E6E]">

          {initials}

        </span>

      )}

    </div>

  );

}



function demoListingHref(
  detailHref: string | undefined,
  fallbackListingId: string | undefined,
): { href: string; scrollToListings: boolean } {
  if (detailHref) return { href: detailHref, scrollToListings: false };
  if (fallbackListingId) return { href: `/dormspaces/${fallbackListingId}`, scrollToListings: false };
  return { href: "#listings", scrollToListings: true };
}

function NewThisWeekCard({
  listing,
  detailHref,
  fallbackListingId,
  onScrollToListings,
}: {
  listing: DormspaceHomeDemoListing;
  detailHref?: string;
  fallbackListingId?: string;
  onScrollToListings: () => void;
}) {
  const details = `${listing.beds} bed • ${listing.baths} bath • ${listing.sqm} sqm`;
  const { href, scrollToListings } = demoListingHref(detailHref, fallbackListingId);

  return (
    <article
      className={cn(
        PEEK_CARD_W,
        "relative shrink-0 touch-manipulation snap-start overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(44,44,44,0.06)] ring-1 ring-black/[0.04] transition active:scale-[0.99]",
      )}
    >
      <Link
        href={href}
        prefetch={!scrollToListings}
        scroll={scrollToListings}
        onClick={scrollToListings ? onScrollToListings : undefined}
        className="absolute inset-0 z-[10] rounded-xl"
        aria-label={`View ${listing.title}`}
      />
      <div className="relative aspect-[4/3] w-full bg-[#F3F0EA]">

        <Image src={listing.imageUrl} alt="" fill className="object-cover" sizes="40vw" />

        {listing.badge === "NEW" ? (

          <span className="absolute left-1.5 top-1.5 rounded bg-[#6B9E6E] px-1 py-0.5 text-[8px] font-bold uppercase text-white">

            NEW

          </span>

        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.06]"
          aria-label="Save listing"
        >
          <Heart className="size-3 text-[#2C2C2C]/80" strokeWidth={2} />
        </button>
      </div>
      <div className="px-2 pb-2 pt-1.5">
        <h3 className="line-clamp-2 font-serif text-[12px] font-semibold leading-tight text-[#2C2C2C]">
          {listing.title}
        </h3>

        <p className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium text-[#888888]">

          <MapPin className="size-2.5 shrink-0 text-[#6B9E6E]" aria-hidden />

          <span className="truncate">{listing.location}</span>

        </p>

        <p className="mt-0.5 text-[12px] font-bold leading-none text-[#6B9E6E]">{formatDemoPrice(listing.price)}</p>

        <p className="mt-0.5 text-[8px] font-medium text-[#888888]">{details}</p>

      </div>

    </article>

  );

}



function RecommendedRowCard({
  listing,
  detailHref,
  fallbackListingId,
  onScrollToListings,
}: {
  listing: DormspaceHomeDemoListing;
  detailHref?: string;
  fallbackListingId?: string;
  onScrollToListings: () => void;
}) {
  const details = `${listing.beds} bed • ${listing.baths} bath • ${listing.sqm} sqm`;
  const { href, scrollToListings } = demoListingHref(detailHref, fallbackListingId);

  return (
    <article className="relative flex touch-manipulation gap-3 rounded-2xl bg-white p-2.5 shadow-[0_2px_12px_rgba(44,44,44,0.07)] ring-1 ring-black/[0.04] transition active:scale-[0.99]">
      <Link
        href={href}
        prefetch={!scrollToListings}
        scroll={scrollToListings}
        onClick={scrollToListings ? onScrollToListings : undefined}
        className="absolute inset-0 z-[10] rounded-2xl"
        aria-label={`View ${listing.title}`}
      />
      <div className="relative h-[92px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-[#F3F0EA]">

        <Image src={listing.imageUrl} alt="" fill className="object-cover" sizes="112px" />

        {listing.badge === "HOT" ? (

          <span className="absolute left-1.5 top-1.5 rounded bg-[#E07A3A] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">

            HOT

          </span>

        ) : null}

      </div>

      <div className="flex min-w-0 flex-1 flex-col pr-7">

        <h3 className="font-serif text-[14px] font-semibold leading-snug text-[#2C2C2C]">{listing.title}</h3>

        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#888888]">

          <MapPin className="size-3 shrink-0 text-[#6B9E6E]" aria-hidden />

          <span className="truncate">{listing.location}</span>

        </p>

        <div className="mt-auto pt-1.5">

          <p className="text-[14px] font-bold leading-none text-[#6B9E6E]">{formatDemoPrice(listing.price)}</p>

          <p className="mt-0.5 text-[10px] font-medium text-[#888888]">{details}</p>

        </div>

      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute right-2.5 top-2.5 z-20 text-[#888888]"
        aria-label="Save listing"
      >
        <Heart className="size-[18px]" strokeWidth={2} />
      </button>
    </article>
  );
}



export function DormspacePublicHomeMobile({

  universities,

  listings,

  neighborhoods,

  onBrowseFilter,

  onScrollToListings,

  compactMobileHome = false,

}: Props) {
  const newestListingIds = useMemo(
    () =>
      [...listings]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, DORMSPACE_HOME_DEMO_NEW.length)
        .map((row) => row.id),
    [listings],
  );

  const recommendedListingIds = useMemo(() => {
    const approved = listings.filter((row) => row.status === "approved");
    const source = approved.length > 0 ? approved : listings;
    return source.slice(0, DORMSPACE_HOME_DEMO_RECOMMENDED.length).map((row) => row.id);
  }, [listings]);

  return (
    <div className={cn("min-w-0 pb-6 md:hidden", compactMobileHome ? "pt-0" : "pt-1")}>
      <section className={SECTION}>
        <SectionHeader title="New this week" actionLabel="See all" onAction={onScrollToListings} />
        <div className={cn(MOBILE_DORMSPACE_CAROUSEL_TRACK, "gap-2")} style={MOBILE_HORIZONTAL_SCROLL_STYLE}>
          {DORMSPACE_HOME_DEMO_NEW.map((listing, index) => (
            <NewThisWeekCard
              key={listing.id}
              listing={listing}
              detailHref={listing.detailHref}
              fallbackListingId={newestListingIds[index]}
              onScrollToListings={onScrollToListings}
            />
          ))}
        </div>
      </section>



      {universities.length > 0 ? (

        <section className={SECTION}>

          <SectionHeader

            title="Browse by school"

            subtitle="Find dorms near major Manila universities"

          />

          <div className={UNIVERSITY_SCROLL} style={MOBILE_HORIZONTAL_SCROLL_STYLE}>

            {universities.map((university) => (

              <Link

                key={university.id}

                href={`/dormspaces?university=${university.id}`}

                onClick={() => {

                  onBrowseFilter({ universityId: university.id, neighborhood: "", city: "" });

                  onScrollToListings();

                }}

                className="flex w-[88px] shrink-0 snap-start flex-col items-center text-center"

              >

                <UniversityAvatar university={university} />

                <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-tight text-[#2C2C2C]">

                  {university.short_name}

                </p>

                <p className="mt-0.5 text-[11px] font-medium text-[#888888]">

                  {formatUniversityListingCount(university.listing_count)}

                </p>

              </Link>

            ))}

          </div>

        </section>

      ) : null}



      <section className={SECTION}>

        <SectionHeader title="Featured neighborhoods" actionLabel="See all" onAction={onScrollToListings} />

        <div className={cn(MOBILE_DORMSPACE_CAROUSEL_TRACK, "gap-2.5")} style={MOBILE_HORIZONTAL_SCROLL_STYLE}>

          {neighborhoods.map((area) => {

            const listingCount = countListingsInPopularArea(listings, area);

            return (

              <Link

                key={area.label}

                href={`/dormspaces?neighborhood=${encodeURIComponent(area.label)}`}

                onClick={() => {

                  onBrowseFilter({ neighborhood: area.label, universityId: "", city: "" });

                  onScrollToListings();

                }}

                className="w-[148px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_12px_rgba(44,44,44,0.07)] ring-1 ring-black/[0.04]"

              >

                <div className="relative aspect-[4/3] w-full bg-[#F3F0EA]">

                  <Image src={area.imageUrl} alt="" fill className="object-cover" sizes="148px" />

                </div>

                <div className="px-2.5 pb-2.5 pt-2">

                  <p className="text-[13px] font-bold leading-tight text-[#2C2C2C]">{area.label}</p>

                  <p className="mt-0.5 text-[10px] font-medium text-[#888888]">

                    {formatNeighborhoodListingCount(listingCount)}

                  </p>

                </div>

              </Link>

            );

          })}

        </div>

      </section>



      <section className={SECTION}>

        <SectionHeader title="Recommended for you" actionLabel="See all" onAction={onScrollToListings} />

        <div className={cn("mt-2.5 flex flex-col gap-2.5", PAGE_X)}>

          {DORMSPACE_HOME_DEMO_RECOMMENDED.map((listing, index) => (
            <RecommendedRowCard
              key={listing.id}
              listing={listing}
              detailHref={listing.detailHref}
              fallbackListingId={recommendedListingIds[index]}
              onScrollToListings={onScrollToListings}
            />
          ))}

        </div>

      </section>

    </div>

  );

}


