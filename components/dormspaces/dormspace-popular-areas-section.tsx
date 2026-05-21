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

type Props = {
  listings: DormspaceWithPhotos[];
  activeCity: string;
  onSelectArea: (filters: Partial<DormspaceBrowseFilters>, areaLabel: string) => void;
  onClearArea: () => void;
};

function AreaCardImage({ src, priority }: { src: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      className="object-cover"
      sizes="160px"
      priority={priority}
    />
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

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 176;
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  const handleAreaClick = (area: DormspacePopularArea) => {
    const isActive = activeLabel === area.label || activeCity === area.city;
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
    <section className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4] py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
              Popular areas
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#484848]">Tap an area to browse dormspaces nearby</p>
          </div>
          <button
            type="button"
            onClick={() => {
              document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-sm font-bold text-[#6B9E6E] hover:underline"
          >
            View all areas →
          </button>
        </div>

        <div className="relative -mx-2 mt-6">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide md:px-10"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {DORMSPACE_POPULAR_AREAS.map((area, i) => {
              const count = counts[area.label] ?? 0;
              const active =
                activeLabel === area.label ||
                (activeCity && area.city && activeCity.toLowerCase() === area.city.toLowerCase());
              return (
                <button
                  key={area.label}
                  type="button"
                  onClick={() => handleAreaClick(area)}
                  className={`group relative flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-md transition hover:scale-[1.02] lg:w-[160px] ${
                    active
                      ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/35"
                      : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40"
                  }`}
                >
                  <div className="relative h-[110px] w-full shrink-0 overflow-hidden lg:h-[130px]">
                    <AreaCardImage src={area.imageUrl} priority={i < 2} />
                    <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[#1a1a1a]/95 via-[#2C2C2C]/35 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 z-[5] p-2 lg:p-2.5">
                      <p className="text-xs font-semibold text-white drop-shadow-sm lg:text-base">{area.label}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-white/90 lg:text-[11px]">
                        {count}+ dormspaces
                      </p>
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 z-[6] flex size-7 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-sm transition group-hover:bg-white/35">
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
