/** Agent property listing caps by tier (payments not wired yet — tier stored on `agents.listing_tier`). */

export const FREE_TIER_LISTING_MAX = 3;
export const PRO_TIER_LISTING_MAX = 20;

export type AgentListingTier = "free" | "pro";

export function normalizeListingTier(raw: string | null | undefined): AgentListingTier {
  return raw === "pro" ? "pro" : "free";
}

export function listingLimitForTier(tier: string | null | undefined): number {
  return normalizeListingTier(tier) === "pro" ? PRO_TIER_LISTING_MAX : FREE_TIER_LISTING_MAX;
}
