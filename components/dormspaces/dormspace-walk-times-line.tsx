"use client";

import { Car } from "lucide-react";

import {
  closestWalkTimes,
  formatReachTimeDisplay,
} from "@/lib/dormspace-walk-times-display";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

export function DormspaceWalkTimesLine({
  listing,
  className,
}: {
  listing: DormspaceWithPhotos;
  className?: string;
}) {
  const closest = closestWalkTimes(listing.dormspace_walk_times);
  if (closest.length === 0) return null;

  return (
    <p className={cn("text-[12px] leading-snug", className)}>
      {closest.map((row, index) => {
        const reach = formatReachTimeDisplay(
          row.walk_duration_seconds,
          row.walk_distance_meters,
        );
        return (
          <span key={row.university_id}>
            {index > 0 ? <span className="text-[#888888]"> · </span> : null}
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#6B9E6E]">
              {reach.mode === "drive" ? (
                <Car className="size-3 shrink-0" aria-hidden />
              ) : null}
              <span>{reach.label}</span>
            </span>
            <span className="text-[#888888]"> to </span>
            <span className="font-semibold text-[#2C2C2C]">
              {row.universities?.short_name}
            </span>
          </span>
        );
      })}
    </p>
  );
}
