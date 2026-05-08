import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentToAgentDealContext =
  | {
      allowed: true;
      kind: "co_listing" | "cross_deal";
      property_id: string;
      property_name: string;
    }
  | { allowed: false };

type AgentIdUserId = { id: string; user_id: string };

async function loadAgentUserIds(
  sb: SupabaseClient,
  agentIds: string[],
): Promise<Record<string, string>> {
  if (agentIds.length === 0) return {};
  const { data, error } = await sb.from("agents").select("id, user_id").in("id", agentIds);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as AgentIdUserId[]) {
    if (row?.id && row?.user_id) out[row.id] = row.user_id;
  }
  return out;
}

function propertyTitle(row: { name?: string | null; location?: string | null } | null | undefined): string {
  const n = String(row?.name ?? "").trim();
  if (n) return n;
  return String(row?.location ?? "").trim() || "Property";
}

/**
 * Agent↔agent messaging is allowed ONLY when there is shared deal context:
 * - Co-listing: an accepted `co_agent_requests` exists tying one agent to the other's property
 * - Cross-deal: an active lead exists for one agent on a property listed by the other
 *
 * Returns the first context found (co-listing preferred), including the property title for UI banners.
 */
export async function canAgentMessageAgent(
  sb: SupabaseClient,
  viewerAgentId: string,
  targetAgentId: string,
): Promise<AgentToAgentDealContext> {
  const a = viewerAgentId.trim();
  const b = targetAgentId.trim();
  if (!a || !b || a === b) return { allowed: false };

  const userIdsByAgentId = await loadAgentUserIds(sb, [a, b]);
  const viewerUserId = userIdsByAgentId[a];
  const targetUserId = userIdsByAgentId[b];
  if (!viewerUserId || !targetUserId) return { allowed: false };

  // 1) Co-listing: accepted request between co-agent and listing agent via properties.listed_by (user id).
  {
    const { data, error } = await sb
      .from("co_agent_requests")
      .select("agent_id, property_id, properties!inner(id, name, location, listed_by)")
      .eq("status", "accepted")
      .in("agent_id", [a, b])
      .limit(6);
    if (!error && Array.isArray(data)) {
      for (const r of data as unknown as Array<{
        agent_id?: string | null;
        property_id?: string | null;
        properties?: { id?: string | null; name?: string | null; location?: string | null; listed_by?: string | null } | null;
      }>) {
        const reqAgentId = String(r.agent_id ?? "");
        const p = r.properties ?? null;
        const listedBy = String(p?.listed_by ?? "");
        if (!reqAgentId || !p?.id || !listedBy) continue;
        // If viewer requested to co-list on target's listing (or vice versa)
        const match =
          (reqAgentId === a && listedBy === targetUserId) || (reqAgentId === b && listedBy === viewerUserId);
        if (match) {
          return {
            allowed: true,
            kind: "co_listing",
            property_id: String(p.id),
            property_name: propertyTitle(p),
          };
        }
      }
    }
  }

  // 2) Cross-deal: a lead exists for one agent on a property listed by the other.
  // We intentionally check both directions and treat any matching lead as shared context.
  {
    const q1 = await sb
      .from("leads")
      .select("property_id, properties!inner(id, name, location, listed_by)")
      .eq("agent_id", a)
      .eq("properties.listed_by", targetUserId)
      .limit(1);
    if (!q1.error && q1.data && q1.data.length > 0) {
      const p = (q1.data[0] as unknown as { properties?: { id?: string; name?: string | null; location?: string | null } })
        .properties;
      if (p?.id) {
        return { allowed: true, kind: "cross_deal", property_id: String(p.id), property_name: propertyTitle(p) };
      }
    }

    const q2 = await sb
      .from("leads")
      .select("property_id, properties!inner(id, name, location, listed_by)")
      .eq("agent_id", b)
      .eq("properties.listed_by", viewerUserId)
      .limit(1);
    if (!q2.error && q2.data && q2.data.length > 0) {
      const p = (q2.data[0] as unknown as { properties?: { id?: string; name?: string | null; location?: string | null } })
        .properties;
      if (p?.id) {
        return { allowed: true, kind: "cross_deal", property_id: String(p.id), property_name: propertyTitle(p) };
      }
    }
  }

  return { allowed: false };
}

