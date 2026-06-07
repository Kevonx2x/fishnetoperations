"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { RowScrollNavButton } from "@/components/ui/gallery-nav-button";

import { DormspaceHomeSectionHeader } from "@/components/dormspaces/dormspace-home-section-header";
import { DormspaceListingCardCompact } from "@/components/dormspaces/dormspace-listing-card-compact";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";

function scrollRow(ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") {
  const el = ref.current;
  if (!el) return;
  const step = Math.min(640, el.clientWidth * 0.85);
  el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
}

export function DormspaceNewThisWeekSection({ listings }: { listings: DormspaceWithPhotos[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const newest = useMemo(
    () =>
      [...listings]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12),
    [listings],
  );

  const scroll = useCallback((dir: "prev" | "next") => {
    scrollRow(scrollRef, dir);
  }, []);

  if (newest.length === 0) return null;

  return (
    <section className="bg-[#FAF8F4] py-12 md:pb-8 md:pt-5 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <DormspaceHomeSectionHeader title="New this week" />

        <div className="-mx-4 mt-5 flex items-stretch gap-1 md:mt-6 lg:gap-2">
          <RowScrollNavButton
            direction="prev"
            className="hidden lg:flex"
            onClick={() => scroll("prev")}
            aria-label="Scroll left"
          />
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-x-auto overflow-y-visible px-1 pb-4 scrollbar-hide lg:px-2"
          >
            <div className="flex w-max flex-nowrap items-stretch gap-4">
              {newest.map((listing) => (
                <DormspaceListingCardCompact key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
          <RowScrollNavButton
            direction="next"
            className="hidden lg:flex"
            onClick={() => scroll("next")}
            aria-label="Scroll right"
          />
        </div>

        <div className="mt-4 text-center lg:hidden">
          <Link
            href="#listings"
            className="text-sm font-semibold text-[#6B9E6E] hover:underline"
          >
            See all listings
          </Link>
        </div>
      </div>
    </section>
  );
}
