"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import {
  countListingsInPopularArea,
  DORMSPACE_POPULAR_AREAS,
  type DormspacePopularArea,
} from "@/lib/dormspace-popular-areas";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

type Props = {
  listings: DormspaceWithPhotos[];
  activeCity: string;
  onSelectArea: (filters: Partial<DormspaceBrowseFilters>, areaLabel: string) => void;
  onClearArea: () => void;
};

function FeaturedLocationStripImage({
  src,
  priority,
  eager,
}: {
  src: string;
  priority?: boolean;
  eager?: boolean;
}) {
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
        sizes="(min-width: 1024px) 160px, 130px"
        priority={priority}
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

export function DormspacePopularAreasSection({
  listings,
  activeCity,
  onSelectArea,
  onClearArea,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const area of DORMSPACE_POPULAR_AREAS) {
      next[area.label] = countListingsInPopularArea(listings, area);
    }
    return next;
  }, [listings]);

  const filterActive = Boolean(activeLabel || activeCity);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.min(320, el.clientWidth * 0.85);
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  const handleAreaClick = (area: DormspacePopularArea) => {
    const isActive =
      activeLabel === area.label ||
      Boolean(
        activeCity &&
          (area.city?.toLowerCase() === activeCity.toLowerCase() ||
            area.label.toLowerCase() === activeCity.toLowerCase()),
      );
    if (isActive) {
      setActiveLabel(null);
      onClearArea();
      return;
    }
    setActiveLabel(area.label);
    onSelectArea(
      { city: area.city ?? area.label, roomType: "", gender: "", minPrice: "", maxPrice: "" },
      area.label,
    );
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section
      id="featured-locations"
      className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4] py-8 sm:py-10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
              Featured Locations
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#484848]">Tap a city to filter listings</p>
          </div>
          {filterActive ? (
            <button
              type="button"
              onClick={() => {
                setActiveLabel(null);
                onClearArea();
              }}
              className="mx-auto mt-2 inline-flex w-fit items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#404040] ring-1 ring-black/10 hover:bg-neutral-50 sm:mx-0 sm:mt-0"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="relative -mx-4 mt-6">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <div
            ref={scrollRef}
            className="min-w-0 overflow-x-auto overflow-y-hidden px-1 pb-2 scrollbar-hide md:px-10"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
          >
            <div className="flex w-max flex-nowrap justify-start gap-3 sm:gap-4">
              {DORMSPACE_POPULAR_AREAS.map((area, i) => {
                const count = counts[area.label] ?? 0;
                const active =
                  activeLabel === area.label ||
                  Boolean(
                    activeCity &&
                      (area.city?.toLowerCase() === activeCity.toLowerCase() ||
                        area.label.toLowerCase() === activeCity.toLowerCase()),
                  );
                return (
                  <button
                    key={area.label}
                    type="button"
                    onClick={() => handleAreaClick(area)}
                    className={cn(
                      "group relative flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-md transition hover:scale-[1.02] lg:w-[160px]",
                      active
                        ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/35"
                        : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40",
                    )}
                    style={{
                      opacity: filterActive && !active ? 0.4 : 1,
                      transition: "opacity 200ms ease",
                    }}
                  >
                    <div className="relative h-[110px] w-full shrink-0 overflow-hidden lg:h-[130px]">
                      <FeaturedLocationStripImage src={area.imageUrl} priority={i < 2} eager={i < 2} />
                      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[#1a1a1a]/95 via-[#2C2C2C]/35 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 z-[5] flex flex-col items-center justify-center p-2 text-center lg:p-2.5">
                        <p className="text-xs font-semibold text-white drop-shadow-sm lg:text-base">
                          {area.label}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold text-white/90 lg:text-[11px]">
                          {count} {count === 1 ? "dormspace" : "dormspaces"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
