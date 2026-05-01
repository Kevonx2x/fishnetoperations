import { z } from "zod";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  property_id: z.string().uuid(),
});

/**
 * Authenticated agent requests to co-list on an existing property (pending admin approval).
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
    return Response.json({ error: "Agents only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const sb = await createSupabaseServerClient();
  const { data: agentRow, error: agentErr } = await sb
    .from("agents")
    .select("id")
    .eq("user_id", session.userId)
    .maybeSingle();

  if (agentErr) {
    return Response.json({ error: agentErr.message }, { status: 500 });
  }
  const agentId = (agentRow as { id?: string } | null)?.id;
  if (!agentId) {
    return Response.json({ error: "Agent profile not found" }, { status: 400 });
  }

  const { error: insErr } = await sb.from("co_agent_requests").insert({
    property_id: parsed.data.property_id,
    agent_id: agentId,
    status: "pending",
  });

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
