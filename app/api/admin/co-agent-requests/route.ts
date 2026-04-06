import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type CoAgentRequestListItem = {
  id: string;
  created_at: string;
  status: string;
  property_id: string;
  agent_id: string;
  propertyName: string;
  propertyLocation: string;
  agentName: string;
};

export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  try {
    const sb = createSupabaseAdmin();
    const { data: rows, error } = await sb
      .from("co_agent_requests")
      .select("id, created_at, status, property_id, agent_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }
    const list = rows ?? [];
    if (list.length === 0) {
      return ok([] as CoAgentRequestListItem[]);
    }
    const propIds = [...new Set(list.map((r) => r.property_id))];
    const agentIds = [...new Set(list.map((r) => r.agent_id))];
    const [propsRes, agentsRes] = await Promise.all([
      sb.from("properties").select("id, name, location").in("id", propIds),
      sb.from("agents").select("id, name").in("id", agentIds),
    ]);
    if (propsRes.error) {
      return fail("DATABASE_ERROR", propsRes.error.message, 500);
    }
    if (agentsRes.error) {
      return fail("DATABASE_ERROR", agentsRes.error.message, 500);
    }
    const propMap = new Map((propsRes.data ?? []).map((p) => [p.id, p]));
    const agentMap = new Map((agentsRes.data ?? []).map((a) => [a.id, a]));
    const merged: CoAgentRequestListItem[] = list.map((r) => {
      const p = propMap.get(r.property_id);
      const a = agentMap.get(r.agent_id);
      return {
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        property_id: r.property_id,
        agent_id: r.agent_id,
        propertyName: (p?.name?.trim() || p?.location || "Property") as string,
        propertyLocation: (p?.location ?? "") as string,
        agentName: (a?.name ?? "Agent") as string,
      };
    });
    return ok(merged);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
