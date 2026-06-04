"use client";

import { useMemo } from "react";
import { Car } from "lucide-react";

import { formatReachTimeDisplay } from "@/lib/dormspace-walk-times-display";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import type { GeoPoint } from "@/lib/geo-point";
import { isValidGeoPoint } from "@/lib/geo-point";
import { formatStraightLineDistanceWithPlace } from "@/lib/points-of-interest-distance";
import { formatUniversityListingCount, type UniversityRow } from "@/lib/universities";

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

type Props = {
  university: UniversityRow;
  listings: DormspaceWithPhotos[];
  /** Active browse search origin — straight-line distance to each school (no API). */
  searchOrigin: GeoPoint | null;
  searchPlaceLabel?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * Browse-by-school card subtitle: approximate distance from search when anchored,
 * otherwise fastest cached walk across listings or listing count.
 */
export function DormspaceUniversityBrowseSubtitle({
  university,
  listings,
  searchOrigin,
  searchPlaceLabel,
  className,
  compact = false,
}: Props) {
  const approxLabel = useMemo(() => {
    if (!isValidGeoPoint(searchOrigin)) return null;
    return formatStraightLineDistanceWithPlace(
      searchOrigin,
      { latitude: university.latitude, longitude: university.longitude },
      searchPlaceLabel,
    );
  }, [searchOrigin, searchPlaceLabel, university.latitude, university.longitude]);

  if (approxLabel) {
    return (
      <p
        className={
          className ??
          (compact
            ? "mt-0.5 text-[11px] font-semibold text-[#6B9E6E]"
            : "mt-1 text-xs font-semibold text-[#6B9E6E] lg:text-sm")
        }
      >
        {approxLabel}
      </p>
    );
  }

  const fastest = fastestWalkToUniversity(listings, university.id);
  if (fastest != null) {
    const reach = formatReachTimeDisplay(fastest.walkSeconds, fastest.walkMeters);
    return (
      <p
        className={
          className ??
          (compact
            ? "mt-0.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#6B9E6E]"
            : "mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#6B9E6E] lg:text-sm")
        }
      >
        {reach.mode === "drive" ? (
          <Car className={compact ? "size-3 shrink-0" : "size-3.5 shrink-0"} aria-hidden />
        ) : null}
        <span>{reach.label}</span>
      </p>
    );
  }

  return (
    <p
      className={
        className ??
        (compact
          ? "mt-0.5 text-[11px] font-medium text-[#888888]"
          : "mt-1 text-xs font-medium text-[#888888] lg:text-sm")
      }
    >
      {formatUniversityListingCount(university.listing_count)}
    </p>
  );
}
