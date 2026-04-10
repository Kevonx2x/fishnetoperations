import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  averageLeadResponseHours,
  calculateAgentScore,
  profileCompletenessFromFlags,
} from "@/lib/agent-score";

/**
 * Loads leads/properties, computes BahayGo score, persists to `agents.score`.
 * Uses service role (server-only).
 */
export async function recalculateAndPersistAgentScore(agentUserId: string): Promise<number | null> {
  const sb = createSupabaseAdmin();

  const { data: agent, error: agentErr } = await sb
    .from("agents")
    .select("id, user_id, image_url, bio, phone, verification_status")
    .eq("user_id", agentUserId)
    .maybeSingle();

  if (agentErr || !agent) {
    console.error("[recalculate-agent-score] agent", agentErr?.message);
    return null;
  }

  const agentRecordId = String(agent.id);

  const { count: closingsCount } = await sb
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentUserId)
    .not("closed_date", "is", null);

  const { data: leadsForResponse } = await sb
    .from("leads")
    .select("created_at, updated_at")
    .eq("agent_id", agentUserId);

  const avgResponseHours = averageLeadResponseHours(leadsForResponse ?? []);

  const { count: ownedCount } = await sb
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("listed_by", agentUserId);

  const { count: coCount } = await sb
    .from("property_agents")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentRecordId);

  const hasListing = (ownedCount ?? 0) > 0 || (coCount ?? 0) > 0;

  const profileCompleteness = profileCompletenessFromFlags({
    hasAvatar: Boolean((agent.image_url as string | null)?.trim()),
    hasBio: Boolean((agent.bio as string | null)?.trim()),
    hasPhone: Boolean((agent.phone as string | null)?.trim()),
    hasListing,
  });

  const isVerified = agent.verification_status === "verified";

  const score = calculateAgentScore({
    closings: closingsCount ?? 0,
    avgResponseHours,
    profileCompleteness,
    isVerified,
  });

  const { error: upErr } = await sb.from("agents").update({ score }).eq("user_id", agentUserId);
  if (upErr) {
    console.error("[recalculate-agent-score] update", upErr.message);
    return null;
  }

  return score;
}
