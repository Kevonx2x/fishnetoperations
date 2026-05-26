"use client";

import Image from "next/image";
import {
  ChevronRight,
  Footprints,
  Heart,
  Lock,
  MapPin,
  PawPrint,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import type { DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import {
  DORMSPACE_HOME_DEMO_CAMPUSES,
  DORMSPACE_HOME_DEMO_NEW,
  DORMSPACE_HOME_DEMO_RECOMMENDED,
  formatDemoPrice,
  type DormspaceHomeDemoListing,
} from "@/lib/dormspace-homepage-demo";
import { cn } from "@/lib/utils";

type Props = {
  locationQuery: string;
  onLocationChange: (value: string) => void;
  onSearch: () => void;
  onBrowseFilter: (partial: Partial<DormspaceBrowseFilters>) => void;
  onScrollToListings: () => void;
};

const PAGE_X = "px-5";
const SECTION = "mt-5";
/** ~2.5 cards visible: (viewport − side padding − gaps) ÷ 2.5 */
const PEEK_CARD_W = "w-[calc((100vw-2rem-1rem)/2.5)]";
const FOUR_UP = "grid grid-cols-4 gap-1.5";
const CAROUSEL_SCROLL =
  "mt-2.5 flex overflow-x-auto px-4 pb-0.5 scrollbar-hide snap-x snap-mandatory scroll-pl-4 scroll-pr-4";

const FEATURE_HIGHLIGHTS = [
  { icon: ShieldCheck, title: "Verified", sub: "ID checked" },
  { icon: Wifi, title: "Fast WiFi", sub: "45 Mbps avg" },
  { icon: Footprints, title: "Walk", sub: "6 min DLSU" },
  { icon: Lock, title: "Safe", sub: "Verified" },
] as const;

const BROWSE_MATTERS = [
  { icon: Wallet, title: "Cheapest", sub: "Near you", filter: { maxPrice: "8000" } as Partial<DormspaceBrowseFilters> },
  { icon: Users, title: "Female Only", sub: "Safe spaces", filter: { gender: "female" } as Partial<DormspaceBrowseFilters> },
  { icon: Wifi, title: "Best WiFi", sub: "For study", filter: { roomType: "" } as Partial<DormspaceBrowseFilters> },
  { icon: PawPrint, title: "Pet Friendly", sub: "Bring your pet", filter: {} as Partial<DormspaceBrowseFilters> },
] as const;

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4">
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
  );
}

function FourUpTile({
  icon: Icon,
  title,
  sub,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  const className =
    "flex min-w-0 flex-col items-center rounded-xl bg-[#F7F9F6] px-0.5 py-2 text-center ring-1 ring-[#2C2C2C]/[0.04]";

  const body = (
    <>
      <Icon className="size-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.25} aria-hidden />
      <p className="mt-1 line-clamp-2 text-[8px] font-bold leading-[1.1] text-[#2C2C2C]">{title}</p>
      <p className="mt-0.5 line-clamp-1 text-[7px] font-semibold leading-none text-[#888888]">{sub}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "transition active:scale-[0.98]")}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

function NewThisWeekCard({ listing }: { listing: DormspaceHomeDemoListing }) {
  const details = `${listing.beds} bed • ${listing.baths} bath • ${listing.sqm} sqm`;

  return (
    <article
      className={cn(
        PEEK_CARD_W,
        "shrink-0 snap-start overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(44,44,44,0.06)] ring-1 ring-black/[0.04]",
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-[#F3F0EA]">
        <Image src={listing.imageUrl} alt="" fill className="object-cover" sizes="40vw" />
        {listing.badge === "NEW" ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-[#6B9E6E] px-1 py-0.5 text-[8px] font-bold uppercase text-white">
            NEW
          </span>
        ) : null}
        <button
          type="button"
          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.06]"
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

function RecommendedRowCard({ listing }: { listing: DormspaceHomeDemoListing }) {
  const details = `${listing.beds} bed • ${listing.baths} bath • ${listing.sqm} sqm`;

  return (
    <article className="relative flex gap-3 rounded-2xl bg-white p-2.5 shadow-[0_2px_12px_rgba(44,44,44,0.07)] ring-1 ring-black/[0.04]">
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
        className="absolute right-2.5 top-2.5 text-[#888888]"
        aria-label="Save listing"
      >
        <Heart className="size-[18px]" strokeWidth={2} />
      </button>
    </article>
  );
}

export function DormspacePublicHomeMobile({
  locationQuery,
  onLocationChange,
  onSearch,
  onBrowseFilter,
  onScrollToListings,
}: Props) {
  return (
    <div className="pb-6 md:hidden">
      {/* Search */}
      <section className={cn(PAGE_X, "pt-2")}>
        <div className="flex h-12 items-center gap-2.5 rounded-2xl border border-[#2C2C2C]/10 bg-white px-3.5 shadow-[0_2px_14px_rgba(44,44,44,0.06)]">
          <Search className="size-[18px] shrink-0 text-[#888888]" strokeWidth={2.25} aria-hidden />
          <input
            type="search"
            value={locationQuery}
            onChange={(e) => onLocationChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder="Where do you want to live?"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[#2C2C2C] placeholder:text-[#888888] focus:outline-none"
            aria-label="Search location"
          />
          <button
            type="button"
            onClick={onScrollToListings}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C]/60"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="size-[18px]" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1 text-[13px]">
          <MapPin className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="font-semibold text-[#2C2C2C]">Near DLSU, Taft Ave.</span>
          <button type="button" className="ml-auto inline-flex items-center text-[13px] font-semibold text-[#6B9E6E]">
            Change
            <ChevronRight className="size-3" aria-hidden />
          </button>
        </div>
      </section>

      {/* Verified / feature row — 4 across */}
      <section className={cn(SECTION, PAGE_X)}>
        <div className={FOUR_UP}>
          {FEATURE_HIGHLIGHTS.map(({ icon, title, sub }) => (
            <FourUpTile key={title} icon={icon} title={title} sub={sub} />
          ))}
        </div>
      </section>

      {/* New this week */}
      <section className={SECTION}>
        <SectionHeader title="New this week" actionLabel="See all" onAction={onScrollToListings} />
        <div className={cn(CAROUSEL_SCROLL, "gap-2")}>
          {DORMSPACE_HOME_DEMO_NEW.map((listing) => (
            <NewThisWeekCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Browse by what matters — icon left, text right */}
      <section className={cn(SECTION, PAGE_X)}>
        <h2 className="font-serif text-[18px] font-semibold leading-tight tracking-tight text-[#2C2C2C]">
          Browse by what matters
        </h2>
        <div className={cn("mt-2.5", FOUR_UP)}>
          {BROWSE_MATTERS.map(({ icon, title, sub, filter }) => (
            <FourUpTile
              key={title}
              icon={icon}
              title={title}
              sub={sub}
              onClick={() => {
                onBrowseFilter(filter);
                onScrollToListings();
              }}
            />
          ))}
        </div>
      </section>

      {/* Near your campus */}
      <section className={SECTION}>
        <SectionHeader title="Near your campus" actionLabel="See all" onAction={onScrollToListings} />
        <div className={cn(CAROUSEL_SCROLL, "gap-2.5")}>
          {DORMSPACE_HOME_DEMO_CAMPUSES.map((campus) => (
            <button
              key={campus.id}
              type="button"
              onClick={() => {
                onBrowseFilter({ city: "Manila" });
                onScrollToListings();
              }}
              className="w-[148px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_12px_rgba(44,44,44,0.07)] ring-1 ring-black/[0.04]"
            >
              <div className="relative aspect-[4/3] w-full bg-[#F3F0EA]">
                <Image src={campus.imageUrl} alt="" fill className="object-cover" sizes="148px" />
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                  {campus.walkMinutes} min walk
                </span>
              </div>
              <div className="px-2.5 pb-2.5 pt-2">
                <p className="text-[13px] font-bold leading-tight text-[#2C2C2C]">{campus.name}</p>
                <p className="mt-0.5 text-[10px] font-medium text-[#888888]">{campus.listingCount}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recommended for you */}
      <section className={SECTION}>
        <SectionHeader title="Recommended for you" actionLabel="See all" onAction={onScrollToListings} />
        <div className={cn("mt-2.5 flex flex-col gap-2.5", PAGE_X)}>
          {DORMSPACE_HOME_DEMO_RECOMMENDED.map((listing) => (
            <RecommendedRowCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>
    </div>
  );
}
