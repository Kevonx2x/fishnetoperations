import { isPropertyListingRemoved } from "@/lib/property-soft-delete";

export type PropertyAvailabilityState = "available" | "reserved" | "closed" | "removed";

export function normalizePropertyAvailabilityState(
  v: string | null | undefined,
): PropertyAvailabilityState {
  if (v === "reserved" || v === "closed" || v === "removed") return v;
  return "available";
}

/** Homepage, search, public agent profile listings tab: only these rows. */
export function propertyIsPublicMarketplaceVisible(row: {
  deleted_at?: string | null;
  availability_state?: string | null;
}): boolean {
  if (isPropertyListingRemoved(row)) return false;
  return normalizePropertyAvailabilityState(row.availability_state) === "available";
}

/**
 * Saved / pinned / liked / pipeline / marketplace card: grayed-out when the listing
 * is soft-deleted or not in `available` availability (reserved, closed, removed).
 */
export function propertyEngagementLooksUnavailable(row: {
  deleted_at?: string | null;
  availability_state?: string | null;
}): boolean {
  if (isPropertyListingRemoved(row)) return true;
  return normalizePropertyAvailabilityState(row.availability_state) !== "available";
}

/** Viewing requests allowed only for fully available listings. */
export function propertyAcceptsViewingRequests(row: {
  deleted_at?: string | null;
  availability_state?: string | null;
}): boolean {
  return propertyIsPublicMarketplaceVisible(row);
}

export function availabilityCardOverlayClasses(
  state: string | null | undefined,
): { badgeClass: string; overlayTintClass: string } {
  const s = normalizePropertyAvailabilityState(state);
  if (s === "reserved") {
    return {
      badgeClass: "bg-[#D4A843]/95 text-[#2C2C2C]",
      overlayTintClass: "bg-amber-950/20",
    };
  }
  return {
    badgeClass: "bg-gray-900/85 text-gray-100",
    overlayTintClass: "bg-black/25",
  };
}

export function availabilityCardOverlayLabel(
  state: string | null | undefined,
  deletedAt?: string | null,
): string {
  const s = normalizePropertyAvailabilityState(state);
  if (s === "reserved") return "Reserved";
  if (s === "closed") return "No longer available";
  if (s === "removed" || isPropertyListingRemoved({ deleted_at: deletedAt })) return "Listing removed";
  return "No longer available";
}

export function propertyDetailAvailabilityBanner(
  state: string | null | undefined,
): { tone: "gold" | "gray"; message: string } | null {
  const s = normalizePropertyAvailabilityState(state);
  if (s === "available") return null;
  if (s === "reserved") {
    return { tone: "gold", message: "This property is currently reserved" };
  }
  if (s === "closed") {
    return { tone: "gray", message: "This property is no longer available" };
  }
  return { tone: "gray", message: "This listing has been removed" };
}
