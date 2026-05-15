import type { SupabaseClient } from "@supabase/supabase-js";

type PropertyAgentsJoinRow = {
  agents: { user_id: string } | { user_id: string }[] | null;
};

/**
 * Resolve the listing agent's auth user_id for a property: listed_by first, then first property_agents row.
 */
export async function resolveListingAgentUserId(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<string | null> {
  const pid = propertyId.trim();
  if (!pid) return null;

  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("listed_by")
    .eq("id", pid)
    .maybeSingle();

  if (propErr) {
    console.warn("[resolveListingAgentUserId] properties lookup failed", propErr.message);
    return null;
  }

  const listedBy = (prop as { listed_by?: string | null } | null)?.listed_by?.trim();
  if (listedBy) return listedBy;

  const { data: paRows, error: paErr } = await supabase
    .from("property_agents")
    .select("agents(user_id)")
    .eq("property_id", pid)
    .limit(1);

  if (paErr) {
    console.warn("[resolveListingAgentUserId] property_agents lookup failed", paErr.message);
    return null;
  }

  const row = (paRows as PropertyAgentsJoinRow[] | null)?.[0];
  const agents = row?.agents;
  if (!agents) return null;
  if (Array.isArray(agents)) {
    return agents[0]?.user_id?.trim() || null;
  }
  return agents.user_id?.trim() || null;
}
