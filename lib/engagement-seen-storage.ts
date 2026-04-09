/** localStorage keys for agent listing engagement pulse (likes / pins). */

export function engagementSeenKey(propertyId: string, kind: "likes" | "pins"): string {
  return `seen_engagement_${propertyId}_${kind}`;
}

export function readSeenEngagementCount(propertyId: string, kind: "likes" | "pins"): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(engagementSeenKey(propertyId, kind));
  const n = parseInt(v ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function writeSeenEngagementCount(propertyId: string, kind: "likes" | "pins", count: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(engagementSeenKey(propertyId, kind), String(count));
}

/** Pulse only when current count is greater than last stored (after last “seen” flip). */
export function shouldPulseEngagement(propertyId: string, kind: "likes" | "pins", count: number): boolean {
  return count > readSeenEngagementCount(propertyId, kind);
}
