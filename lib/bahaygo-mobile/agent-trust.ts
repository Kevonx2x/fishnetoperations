import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { verificationStateFromAgent } from "@/lib/bahaygo-mobile/trust";

/** Agent trust signals for in-card preview (detail page adds depth). */
export type AgentTrustSignal = {
  agentId: string;
  name: string;
  verified: boolean;
  verificationState: ReturnType<typeof verificationStateFromAgent>;
  agencyName: string | null;
  prcLicensed: boolean;
};

export function agentTrustSignalFromMarketplaceAgent(
  agent: MarketplaceAgent | null | undefined,
): AgentTrustSignal | null {
  if (!agent?.id) return null;
  const status = agent.status || "pending";
  return {
    agentId: agent.id,
    name: agent.name,
    verified: agent.verified,
    verificationState: verificationStateFromAgent(agent.verified, status),
    agencyName: agent.agencyName?.trim() || null,
    prcLicensed: agent.verified && status === "approved",
  };
}
