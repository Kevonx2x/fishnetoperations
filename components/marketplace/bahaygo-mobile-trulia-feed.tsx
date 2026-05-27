"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BAHAYGO_FEED_SPACING } from "@/lib/bahaygo-design-tokens";
import {
  buildTruliaMobileFeedSections,
  truliaFeedListingCount,
  type TruliaFeedSection,
  type TruliaFeedTab,
} from "@/lib/bahaygo-mobile/trulia-home-feed";
import { HOMEPAGE_MOBILE_CAROUSEL_TRACK } from "@/lib/homepage-listing-card-layout";
import type { DbProperty } from "@/lib/marketplace-property";
import { BahayGoMobilePeekListingCard } from "@/components/marketplace/bahaygo-mobile-peek-listing-card";
import type { PropertyEngagement } from "@/hooks/use-property-engagement";

export type TruliaFeedListingCardProps = {
  property: DbProperty;
  roomUrls: string[];
  roomIdx: number;
  onRoomPrev: () => void;
  onRoomNext: () => void;
  cardWidthClass: string;
  listingImageLoadEager?: boolean;
  listingImagePriority?: boolean;
};

export type BahayGoMobileTruliaFeedProps = {
  mode: "buy" | "rent";
  listings: DbProperty[];
  engagement: PropertyEngagement;
  renderListingCard: (props: TruliaFeedListingCardProps) => React.ReactNode;
  getRoomUrls: (property: DbProperty) => string[];
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

function TruliaTabBar({
  tabs,
  activeId,
  onChange,
}: {
  tabs: TruliaFeedTab[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="overflow-visible px-1 pt-1.5 pb-2" role="tablist">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-xs font-semibold shadow-[0_2px_8px_rgba(44,44,44,0.06)] ring-1 transition",
                active
                  ? "bg-[#3d5240] text-white ring-[#3d5240]"
                  : "bg-white text-[#2C2C2C] ring-black/[0.08]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TruliaHorizontalCarousel({
  tab,
  mode,
  engagement,
}: {
  tab: TruliaFeedTab;
  mode: "buy" | "rent";
  engagement: PropertyEngagement;
}) {
  if (tab.listings.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-medium text-[#717171]">
        No listings in this category yet.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto overflow-y-visible py-1 pb-0.5 scrollbar-hide snap-x snap-mandatory",
        HOMEPAGE_MOBILE_CAROUSEL_TRACK,
      )}
    >
      <div className="flex w-max flex-nowrap gap-2.5">
        {tab.listings.map((property) => (
          <BahayGoMobilePeekListingCard
            key={`${tab.id}-${property.id}`}
            property={property}
            mode={mode}
            engagement={engagement}
          />
        ))}
      </div>
    </div>
  );
}

function TruliaTabbedCarouselSection({
  section,
  mode,
  engagement,
}: {
  section: Extract<TruliaFeedSection, { kind: "property_type_tabs" | "tourist_location_tabs" }>;
  mode: "buy" | "rent";
  engagement: PropertyEngagement;
}) {
  const [activeTabId, setActiveTabId] = useState(section.tabs[0]?.id ?? "");
  const activeTab = section.tabs.find((t) => t.id === activeTabId) ?? section.tabs[0];

  if (!activeTab) return null;

  return (
    <section aria-label={section.title}>
      <h3 className="font-serif text-[18px] font-semibold leading-tight text-[#2C2C2C]">
        {section.title}
      </h3>
      <div className="mt-3">
        <TruliaTabBar tabs={section.tabs} activeId={activeTab.id} onChange={setActiveTabId} />
      </div>
      <div className="mt-1">
        <TruliaHorizontalCarousel tab={activeTab} mode={mode} engagement={engagement} />
      </div>
    </section>
  );
}

function TruliaVerticalBlock({
  listings,
  renderListingCard,
  getRoomUrls,
  cardRoomIdx,
  setCardRoomIdx,
  imagePriorityStart = 0,
}: {
  listings: DbProperty[];
  renderListingCard: BahayGoMobileTruliaFeedProps["renderListingCard"];
  getRoomUrls: BahayGoMobileTruliaFeedProps["getRoomUrls"];
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  imagePriorityStart?: number;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ gap: BAHAYGO_FEED_SPACING.sectionGapMobile }}
    >
      {listings.map((property, idx) => {
        const urls = getRoomUrls(property);
        const globalIdx = imagePriorityStart + idx;
        return (
          <div key={property.id} className="flex flex-col gap-2.5">
            {renderListingCard({
              property,
              roomUrls: urls,
              roomIdx: cardRoomIdx[property.id] ?? 0,
              onRoomPrev: () =>
                setCardRoomIdx((s) => ({
                  ...s,
                  [property.id]:
                    (urls.length + (s[property.id] ?? 0) - 1) % Math.max(1, urls.length),
                })),
              onRoomNext: () =>
                setCardRoomIdx((s) => ({
                  ...s,
                  [property.id]: ((s[property.id] ?? 0) + 1) % Math.max(1, urls.length),
                })),
              cardWidthClass: "w-full shrink-0",
              listingImageLoadEager: globalIdx < 4,
              listingImagePriority: globalIdx < 2,
            })}
            <Link
              href={`/properties/${encodeURIComponent(property.id)}`}
              className="inline-flex w-full items-center justify-center rounded-full border-2 border-[#6B9E6E] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B9E6E] shadow-sm transition hover:bg-[#6B9E6E]/5"
            >
              Check availability
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function BahayGoMobileTruliaFeed({
  mode,
  listings,
  engagement,
  renderListingCard,
  getRoomUrls,
  cardRoomIdx,
  setCardRoomIdx,
}: BahayGoMobileTruliaFeedProps) {
  const sections = useMemo(
    () => buildTruliaMobileFeedSections({ pool: listings, mode }),
    [listings, mode],
  );

  const uniqueCount = useMemo(() => truliaFeedListingCount(sections), [sections]);

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center shadow-sm">
        <p className="font-serif text-lg font-semibold text-[#2C2C2C]">No homes to show yet</p>
        <p className="mt-2 text-sm font-medium text-[#717171]">
          New verified listings are added regularly — check back soon.
        </p>
      </div>
    );
  }

  let verticalImageCursor = 0;

  return (
    <div className="min-w-0 w-full">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[18px] font-semibold leading-tight text-[#2C2C2C]">
          {mode === "buy" ? "Homes for sale" : "Homes for rent"}
        </h2>
        <span className="shrink-0 text-[13px] font-semibold text-[#888888]">
          {uniqueCount} {uniqueCount === 1 ? "home" : "homes"}
        </span>
      </div>

      <div
        className="mt-3 flex flex-col"
        style={{ gap: BAHAYGO_FEED_SPACING.sectionGapMobile }}
      >
        {sections.map((section, sectionIdx) => {
          if (section.kind === "vertical") {
            const block = (
              <TruliaVerticalBlock
                listings={section.listings}
                renderListingCard={renderListingCard}
                getRoomUrls={getRoomUrls}
                cardRoomIdx={cardRoomIdx}
                setCardRoomIdx={setCardRoomIdx}
                imagePriorityStart={verticalImageCursor}
              />
            );
            verticalImageCursor += section.listings.length;
            return <div key={`vertical-${sectionIdx}`}>{block}</div>;
          }

          return (
            <TruliaTabbedCarouselSection
              key={`${section.kind}-${sectionIdx}`}
              section={section}
              mode={mode}
              engagement={engagement}
            />
          );
        })}
      </div>
    </div>
  );
}
