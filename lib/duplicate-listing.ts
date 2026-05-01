import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches duplicate rule: LOWER(TRIM(location)). */
export function normalizeListingLocation(location: string): string {
  return location.trim().toLowerCase();
}

export type DuplicateListingExisting = {
  id: string;
  name: string | null;
  location: string;
  agent_id: string | null;
  agent_name: string;
};

type RpcDupRow = {
  id: string;
  prop_name: string;
  prop_location: string;
  listed_by: string | null;
};

/** Build API/modal payload from find_duplicate_active_property RPC row (listed_by → agents.id + display name). */
export async function duplicateExistingFromRpcRow(
  admin: SupabaseClient,
  dup: RpcDupRow,
): Promise<DuplicateListingExisting> {
  const ownerId = dup.listed_by;
  let agentName = "Another agent";
  let agentRowId: string | null = null;
  if (ownerId) {
    const { data: ag } = await admin.from("agents").select("id, name").eq("user_id", ownerId).maybeSingle();
    if (ag) {
      agentRowId = (ag as { id: string }).id;
      agentName = String((ag as { name?: string | null }).name ?? "").trim() || agentName;
    } else {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
      const fn = (prof as { full_name?: string | null } | null)?.full_name?.trim();
      if (fn) agentName = fn;
    }
  }
  const rawName = dup.prop_name?.trim();
  return {
    id: dup.id,
    name: rawName ? rawName : null,
    location: dup.prop_location,
    agent_id: agentRowId,
    agent_name: agentName,
  };
}
