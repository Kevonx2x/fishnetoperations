"use client";

import { useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Car, ChevronLeft, ChevronRight } from "lucide-react";

import { DormspaceHomeSectionHeader } from "@/components/dormspaces/dormspace-home-section-header";
import type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";
import { formatReachTimeDisplay } from "@/lib/dormspace-walk-times-display";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import {
  formatUniversityListingCount,
  universityInitials,
  type UniversityRow,
} from "@/lib/universities";

type Props = {
  universities: UniversityRow[];
  listings: DormspaceWithPhotos[];
  onSelectUniversity: (partial: Partial<DormspaceBrowseFilters>) => void;
};

function fastestWalkToUniversity(
  listings: DormspaceWithPhotos[],
  universityId: string,
): { walkSeconds: number; walkMeters: number } | null {
  let fastest: { walkSeconds: number; walkMeters: number } | null = null;
  for (const listing of listings) {
    for (const walkTime of listing.dormspace_walk_times ?? []) {
      if (walkTime.university_id !== universityId) continue;
      if (
        fastest == null ||
        walkTime.walk_duration_seconds < fastest.walkSeconds
      ) {
        fastest = {
          walkSeconds: walkTime.walk_duration_seconds,
          walkMeters: walkTime.walk_distance_meters,
        };
      }
    }
  }
  return fastest;
}

function UniversityWalkLabel({
  university,
  listings,
}: {
  university: UniversityRow;
  listings: DormspaceWithPhotos[];
}) {
  const fastest = fastestWalkToUniversity(listings, university.id);
  if (fastest != null) {
    const reach = formatReachTimeDisplay(fastest.walkSeconds, fastest.walkMeters);
    return (
      <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#6B9E6E] lg:text-sm">
        {reach.mode === "drive" ? (
          <Car className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        <span>{reach.label}</span>
      </p>
    );
  }

  return (
    <p className="mt-1 text-xs font-medium text-[#888888] lg:text-sm">
      {formatUniversityListingCount(university.listing_count)}
    </p>
  );
}

function UniversityAvatar({ university }: { university: UniversityRow }) {
  const initials = universityInitials(university.short_name);

  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-[#E8F0E9] ring-2 ring-[#6B9E6E]/15 lg:size-24">
      {university.image_url ? (
        <Image src={university.image_url} alt="" fill className="object-cover" sizes="96px" />
      ) : (
        <span className="flex size-full items-center justify-center text-xl font-bold text-[#6B9E6E]">
          {initials}
        </span>
      )}
    </div>
  );
}

export function DormspaceBrowseBySchoolSection({
  universities,
  listings,
  onSelectUniversity,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sortedUniversities = useMemo(
    () => [...universities].sort((a, b) => a.display_order - b.display_order),
    [universities],
  );

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.min(480, el.clientWidth * 0.8);
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  if (sortedUniversities.length === 0) return null;

  return (
    <section className="bg-[#F3F7F4] py-12 md:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <DormspaceHomeSectionHeader
          title="Browse by school"
          subtitle="Find dorms near major Manila universities"
        />

        <div className="relative -mx-4 mt-5 md:mt-6">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2.5 shadow-md lg:flex"
            aria-label="Scroll universities left"
          >
            <ChevronLeft className="size-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2.5 shadow-md lg:flex"
            aria-label="Scroll universities right"
          >
            <ChevronRight className="size-5 text-[#2C2C2C]" />
          </button>

          <div
            ref={scrollRef}
            className="overflow-x-auto px-4 pb-2 scrollbar-hide lg:px-12"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex w-max flex-nowrap gap-6 lg:gap-8">
              {sortedUniversities.map((university) => (
                <Link
                  key={university.id}
                  href={`/dormspaces?university=${university.id}`}
                  onClick={() => {
                    onSelectUniversity({
                      universityId: university.id,
                      neighborhood: "",
                      city: "",
                    });
                  }}
                  className="flex w-[92px] shrink-0 flex-col items-center text-center transition hover:opacity-90 lg:w-[104px]"
                >
                  <UniversityAvatar university={university} />
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-tight text-[#2C2C2C]">
                    {university.short_name}
                  </p>
                  <UniversityWalkLabel university={university} listings={listings} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
