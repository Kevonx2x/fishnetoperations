"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

import { DormspaceComingSoonCard } from "@/components/dormspaces/dormspace-coming-soon-card";
import { DormspaceListingCardCompact } from "@/components/dormspaces/dormspace-listing-card-compact";
import {
  DORMSPACE_LISTING_CARD_WIDTH,
  DORMSPACE_ROW_MIN_CARDS,
} from "@/lib/dormspace-browse-rows";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

function scrollRow(ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") {
  const el = ref.current;
  if (!el) return;
  const step = Math.min(560, el.clientWidth * 0.9);
  el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
}

export function DormspaceRowCarousel({
  rowKey,
  title,
  subtitle,
  items,
  featured,
  titleHref,
}: {
  rowKey: string;
  title: string;
  subtitle: string;
  items: DormspaceWithPhotos[];
  featured?: boolean;
  titleHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const list = items.slice(0, 12);
  const fillerCount =
    list.length === 0
      ? DORMSPACE_ROW_MIN_CARDS
      : list.length < DORMSPACE_ROW_MIN_CARDS
        ? DORMSPACE_ROW_MIN_CARDS - list.length
        : 0;

  const scroll = (dir: "prev" | "next") => scrollRow(scrollRef, dir);

  const featuredClasses = featured
    ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3 pb-1"
    : "";

  const track = (
    <div
      ref={scrollRef}
      className="min-w-0 flex-1 touch-pan-x overflow-x-auto px-1 pb-2 scrollbar-hide snap-x snap-proximity"
      style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
    >
      <div className="flex w-max flex-nowrap items-start gap-3">
        {list.map((listing) => (
          <DormspaceListingCardCompact key={`${rowKey}-${listing.id}`} listing={listing} />
        ))}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <DormspaceComingSoonCard key={`ph-${rowKey}-${i}`} cardWidthClass={DORMSPACE_LISTING_CARD_WIDTH} />
        ))}
      </div>
    </div>
  );

  return (
    <section className={cn(featuredClasses)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {featured ? <Star className="h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden /> : null}
            {titleHref ? (
              <Link
                href={titleHref}
                className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] hover:underline sm:text-3xl"
              >
                {title}
              </Link>
            ) : (
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
                {title}
              </h2>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-[#484848]">{subtitle}</p>
        </div>
      </div>

      <div className="-mx-4 flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
          aria-label={`Scroll ${title} left`}
        >
          <ChevronLeft className="h-4 w-4 text-[#2C2C2C]" />
        </button>
        {track}
        <button
          type="button"
          onClick={() => scroll("next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 pr-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label={`Scroll ${title} right`}
        >
          <ChevronRight className="h-4 w-4 text-[#2C2C2C]" />
        </button>
      </div>
    </section>
  );
}
