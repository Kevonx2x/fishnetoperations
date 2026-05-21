"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-5">
      <div className="min-w-0">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
          Recommended for you
        </h2>
        <p className="mt-1 text-sm font-semibold text-[#484848]">New dormspaces across Metro Manila</p>
      </div>

      {recommended.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-12 text-center">
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
        <div className="-mx-4 mt-4 flex items-stretch gap-1 md:gap-2">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-[#2C2C2C]" />
          </button>
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide">
            <div className="flex w-max flex-nowrap gap-3">
              {recommended.map((listing) => (
                <DormspaceListingCardCompact key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 pr-2 shadow-sm hover:bg-neutral-50 md:flex md:pr-2"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4 text-[#2C2C2C]" />
          </button>
        </div>
      )}
    </section>
  );
}
