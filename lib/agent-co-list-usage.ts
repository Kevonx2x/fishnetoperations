import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Counts properties where the agent appears on `property_agents` but is not the listing owner
 * (`listed_by` ≠ agent's profile id). Used for co-listing cap checks.
 */
export async function countCoListedNonOwnerProperties(
  admin: SupabaseClient,
  agentId: string,
  agentUserId: string,
): Promise<number> {
  const { data: paLinks, error } = await admin.from("property_agents").select("property_id").eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  const propIds = [
    ...new Set(
      (paLinks ?? [])
        .map((r) => (r as { property_id?: string | null }).property_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (propIds.length === 0) return 0;
  const { data: props, error: pErr } = await admin.from("properties").select("listed_by").in("id", propIds);
  if (pErr) throw new Error(pErr.message);
  return (props ?? []).filter((p) => (p as { listed_by: string | null }).listed_by !== agentUserId).length;
}
