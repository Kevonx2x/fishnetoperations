"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DormspaceHomeSectionHeader } from "@/components/dormspaces/dormspace-home-section-header";
import type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";
import { DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS } from "@/lib/dormspace-featured-neighborhoods";
import {
  countListingsInPopularArea,
  type DormspacePopularArea,
} from "@/lib/dormspace-popular-areas";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

/** Desktop featured row order (matches product spec). */
const DESKTOP_NEIGHBORHOOD_ORDER = [
  "Manila",
  "Baguio",
  "BGC",
  "Makati CBD",
  "Ortigas Center",
  "Alabang",
] as const;

type Props = {
  listings: DormspaceWithPhotos[];
  activeNeighborhood: string;
  onSelectNeighborhood: (partial: Partial<DormspaceBrowseFilters>) => void;
  onClearNeighborhood: () => void;
};

function formatNeighborhoodListingCount(count: number): string {
  if (count <= 0) return "Listings coming soon";
  if (count >= 120) return "120+ listings";
  return `${count} listing${count === 1 ? "" : "s"}`;
}

function NeighborhoodCardImage({ src, priority }: { src: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60 transition-opacity duration-500",
          loaded && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <Image
        src={src}
        alt=""
        fill
        className={cn(
          "z-[2] object-cover transition-[opacity,transform] duration-500 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        )}
        sizes="240px"
        priority={priority}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

export function DormspaceFeaturedNeighborhoodsSection({
  listings,
  activeNeighborhood,
  onSelectNeighborhood,
  onClearNeighborhood,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const neighborhoods = useMemo(() => {
    const byLabel = new Map(
      DORMSPACE_MOBILE_FEATURED_NEIGHBORHOODS.map((area) => [area.label, area]),
    );
    return DESKTOP_NEIGHBORHOOD_ORDER.map((label) => byLabel.get(label)).filter(
      (area): area is DormspacePopularArea => area != null,
    );
  }, []);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const area of neighborhoods) {
      next[area.label] = countListingsInPopularArea(listings, area);
    }
    return next;
  }, [listings, neighborhoods]);

  const filterActive = Boolean(activeLabel || activeNeighborhood);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.min(360, el.clientWidth * 0.85);
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  const handleAreaClick = (area: DormspacePopularArea) => {
    const isActive = activeLabel === area.label || activeNeighborhood === area.label;
    if (isActive) {
      setActiveLabel(null);
      onClearNeighborhood();
      return;
    }
    setActiveLabel(area.label);
    onSelectNeighborhood({
      neighborhood: area.label,
      universityId: "",
      city: "",
    });
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section className="bg-[#FAF8F4] py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <DormspaceHomeSectionHeader title="Featured neighborhoods" />
          {filterActive ? (
            <button
              type="button"
              onClick={() => {
                setActiveLabel(null);
                onClearNeighborhood();
              }}
              className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#404040] ring-1 ring-black/10 hover:bg-neutral-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="relative -mx-4 mt-8">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2.5 shadow-md lg:flex"
            aria-label="Scroll neighborhoods left"
          >
            <ChevronLeft className="size-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2.5 shadow-md lg:flex"
            aria-label="Scroll neighborhoods right"
          >
            <ChevronRight className="size-5 text-[#2C2C2C]" />
          </button>

          <div
            ref={scrollRef}
            className="overflow-x-auto px-4 pb-2 scrollbar-hide lg:px-12"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
          >
            <div className="flex w-max flex-nowrap gap-4 lg:gap-5">
              {neighborhoods.map((area, index) => {
                const count = counts[area.label] ?? 0;
                const active = activeLabel === area.label || activeNeighborhood === area.label;
                return (
                  <Link
                    key={area.label}
                    href={`/dormspaces?neighborhood=${encodeURIComponent(area.label)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      handleAreaClick(area);
                    }}
                    className={cn(
                      "group relative flex w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-md transition hover:scale-[1.02] lg:w-[220px]",
                      active
                        ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/35"
                        : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40",
                    )}
                    style={{
                      opacity: filterActive && !active ? 0.45 : 1,
                      transition: "opacity 200ms ease",
                    }}
                  >
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
                      <NeighborhoodCardImage src={area.imageUrl} priority={index < 2} />
                      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[#1a1a1a]/95 via-[#2C2C2C]/35 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 z-[5] p-3 lg:p-4">
                        <p className="text-base font-semibold text-white drop-shadow-sm lg:text-lg">
                          {area.label}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-white/90 lg:text-sm">
                          {formatNeighborhoodListingCount(count)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
