"use client";

import { closestWalkTimes, walkMinutesLabel } from "@/lib/dormspace-walk-times-display";
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
      {closest.map((row, index) => (
        <span key={row.university_id}>
          {index > 0 ? <span className="text-[#888888]"> · </span> : null}
          <span className="font-semibold text-[#6B9E6E]">
            {walkMinutesLabel(row.walk_duration_seconds)}
          </span>
          <span className="text-[#888888]"> walk to </span>
          <span className="font-semibold text-[#2C2C2C]">{row.universities?.short_name}</span>
        </span>
      ))}
    </p>
  );
}
