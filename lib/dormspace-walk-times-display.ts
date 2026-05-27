import type { DormspaceWalkTimeRow } from "@/lib/dormspaces";

/** Listings within this walk time count toward university.listing_count and browse filters. */
export const UNIVERSITY_LISTING_WALK_MAX_SECONDS = 30 * 60;

export function walkMinutesLabel(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function closestWalkTimes(
  walkTimes: DormspaceWalkTimeRow[] | null | undefined,
  limit = 2,
): DormspaceWalkTimeRow[] {
  if (!walkTimes?.length) return [];
  return [...walkTimes]
    .filter((row) => row.universities?.short_name)
    .sort((a, b) => a.walk_duration_seconds - b.walk_duration_seconds)
    .slice(0, limit);
}
