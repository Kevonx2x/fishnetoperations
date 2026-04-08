/**
 * Agent caps by tier (`agents.listing_tier`). Tier may be updated by PayMongo subscription webhooks or admin.
 * Broker tier uses unlimited (Infinity) for owned / co-list / team in app logic; DB uses a large int.
 */

export const AGENT_LISTING_TIERS = ["free", "pro", "featured", "broker"] as const;
export type AgentListingTier = (typeof AGENT_LISTING_TIERS)[number];

export type TierLimits = {
  owned: number;
  coList: number;
  team: number;
};

export const TIER_LIMITS: Record<AgentListingTier, TierLimits> = {
  free: { owned: 1, coList: 2, team: 0 },
  pro: { owned: 20, coList: 10, team: 3 },
  featured: { owned: 20, coList: 10, team: 5 },
  broker: {
    owned: Number.POSITIVE_INFINITY,
    coList: Number.POSITIVE_INFINITY,
    team: Number.POSITIVE_INFINITY,
  },
};

export const TIER_LABEL: Record<AgentListingTier, string> = {
  free: "Free",
  pro: "Pro",
  featured: "Featured",
  broker: "Broker",
};

export function normalizeListingTier(raw: string | null | undefined): AgentListingTier {
  if (raw === "pro" || raw === "featured" || raw === "broker") return raw;
  return "free";
}

export function tierLimitsForTier(tier: string | null | undefined): TierLimits {
  return TIER_LIMITS[normalizeListingTier(tier)];
}

/** Max properties the user may own (`listed_by` = user). */
export function ownedListingLimitForTier(tier: string | null | undefined): number {
  return tierLimitsForTier(tier).owned;
}

/** Max owned listings (alias for `ownedListingLimitForTier`). */
export function listingLimitForTier(tier: string | null | undefined): number {
  return ownedListingLimitForTier(tier);
}

/** Max properties where the agent is a co-listing agent (not the listing owner). */
export function coListLimitForTier(tier: string | null | undefined): number {
  return tierLimitsForTier(tier).coList;
}

/** Max showing assistants / team members (`agent_team_members`). */
export function teamMemberLimitForTier(tier: string | null | undefined): number {
  return tierLimitsForTier(tier).team;
}

export function isUnlimitedOwned(tier: string | null | undefined): boolean {
  return !Number.isFinite(tierLimitsForTier(tier).owned);
}

export function isUnlimitedCoList(tier: string | null | undefined): boolean {
  return !Number.isFinite(tierLimitsForTier(tier).coList);
}

export function formatLimitN(n: number): string {
  return Number.isFinite(n) ? String(n) : "Unlimited";
}
