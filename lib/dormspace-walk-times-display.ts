import type { DormspaceWalkTimeRow } from "@/lib/dormspaces";

/** Listings within this walk time count toward university.listing_count and browse filters. */
export const UNIVERSITY_LISTING_WALK_MAX_SECONDS = 30 * 60;

/** Beyond this, show an estimated drive time instead of an unrealistic walk label. */
export const WALK_DISPLAY_MAX_MINUTES = 30;

export function walkMinutesLabel(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function estimateDriveMinutes(
  walkSeconds: number,
  walkMeters?: number | null,
): number {
  if (walkMeters != null && walkMeters > 0) {
    // Metro Manila urban average ~24 km/h ≈ 400 m/min
    return Math.max(5, Math.round(walkMeters / 400));
  }

  const walkMin = Math.max(1, Math.round(walkSeconds / 60));
  // Walking ~5 km/h vs driving ~25 km/h
  return Math.max(5, Math.round(walkMin / 5));
}

export type ReachTimeDisplay = {
  mode: "walk" | "drive";
  label: string;
};

export function formatReachTimeDisplay(
  walkSeconds: number,
  walkMeters?: number | null,
): ReachTimeDisplay {
  const walkMin = Math.max(1, Math.round(walkSeconds / 60));
  if (walkMin <= WALK_DISPLAY_MAX_MINUTES) {
    return { mode: "walk", label: `${walkMin} min walk` };
  }

  return {
    mode: "drive",
    label: `${estimateDriveMinutes(walkSeconds, walkMeters)} min`,
  };
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
