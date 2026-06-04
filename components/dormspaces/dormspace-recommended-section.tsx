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
  const step = Math.min(560, el.clientWidth * 0.9);
  el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
}

export function DormspaceRecommendedSection({ listings }: { listings: DormspaceWithPhotos[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const recommended = useMemo(() => {
    const approved = listings.filter((l) => l.status === "approved");
    const source = approved.length > 0 ? approved : listings;
    return source.slice(0, 12);
  }, [listings]);

  const scroll = useCallback((dir: "prev" | "next") => {
    scrollRow(scrollRef, dir);
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-5 md:py-8 lg:py-10">
      <DormspaceHomeSectionHeader
        title="Recommended for you"
        subtitle="Hand-picked bedspaces and shared rooms for students & young pros"
      />

      {recommended.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-12 text-center md:mt-6">
          <p className="font-serif text-xl font-semibold text-[#2C2C2C]">Be the first to list a dormspace</p>
          <p className="mt-2 text-sm font-medium text-[#484848]">
            New verified bedspaces will appear here as landlords join.
          </p>
          <Link
            href="/dormspaces/welcome"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white"
          >
            List your dormspace
          </Link>
        </div>
      ) : (
        <div className="-mx-4 mt-5 flex items-stretch gap-1 md:mt-6 lg:gap-2">
          <RowScrollNavButton direction="prev" onClick={() => scroll("prev")} aria-label="Scroll left" />
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide">
            <div className="flex w-max flex-nowrap gap-3">
              {recommended.map((listing) => (
                <DormspaceListingCardCompact key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
          <RowScrollNavButton direction="next" onClick={() => scroll("next")} aria-label="Scroll right" />
        </div>
      )}
    </section>
  );
}
