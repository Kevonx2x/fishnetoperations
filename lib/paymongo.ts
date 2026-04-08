export const PAYMONGO_SUBSCRIPTION_TIERS = ["pro", "featured", "broker"] as const;
export type PaymongoSubscriptionTier = (typeof PAYMONGO_SUBSCRIPTION_TIERS)[number];

const TIER_AMOUNTS_CENTAVOS: Record<PaymongoSubscriptionTier, number> = {
  pro: 99900,
  featured: 149900,
  broker: 400000,
};

const TIER_TITLE: Record<PaymongoSubscriptionTier, string> = {
  pro: "Pro",
  featured: "Featured",
  broker: "Broker",
};

export function isPaymongoSubscriptionTier(s: string): s is PaymongoSubscriptionTier {
  return (PAYMONGO_SUBSCRIPTION_TIERS as readonly string[]).includes(s);
}

export function tierAmountCentavos(tier: PaymongoSubscriptionTier): number {
  return TIER_AMOUNTS_CENTAVOS[tier];
}

export function subscriptionDescription(tier: PaymongoSubscriptionTier): string {
  return `BahayGo ${TIER_TITLE[tier]} - Monthly Subscription`;
}

export function subscriptionRemarks(agentId: string, tier: PaymongoSubscriptionTier): string {
  return `agent_id:${agentId},tier:${tier}`;
}

export function parseSubscriptionRemarks(remarks: string): {
  agentId: string;
  tier: PaymongoSubscriptionTier;
} | null {
  const trimmed = remarks.trim();
  let agentId: string | null = null;
  let tier: string | null = null;
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (p.startsWith("agent_id:")) agentId = p.slice("agent_id:".length).trim();
    if (p.startsWith("tier:")) tier = p.slice("tier:".length).trim().toLowerCase();
  }
  if (!agentId || !tier) return null;
  if (!isPaymongoSubscriptionTier(tier)) return null;
  return { agentId, tier };
}

export function paymongoBasicAuthHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("Missing PAYMONGO_SECRET_KEY");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export function billingSuccessRedirectUrl(tier: PaymongoSubscriptionTier): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://bahaygo.com";
  return `${origin}/dashboard/agent?tab=billing&payment=success&tier=${encodeURIComponent(tier)}`;
}

export function billingCancelRedirectUrl(): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://bahaygo.com";
  return `${origin}/pricing`;
}
