import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (
    session.role !== "agent" &&
    session.role !== "broker" &&
    session.role !== "admin" &&
    session.role !== "team_member"
  ) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const sb = await createSupabaseServerClient();
  const supervisorUserId =
    session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
  if (session.role === "team_member" && !supervisorUserId) {
    return Response.json({ error: "Not a team member" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { lead_id?: unknown };
  const leadIdRaw = body.lead_id;
  const leadId =
    typeof leadIdRaw === "number"
      ? leadIdRaw
      : typeof leadIdRaw === "string"
        ? parseInt(leadIdRaw, 10)
        : NaN;
  if (!Number.isFinite(leadId)) {
    return Response.json({ error: "lead_id required" }, { status: 400 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) {
    return Response.json({ error: leadErr.message }, { status: 500 });
  }
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  const agentId = (lead as { agent_id: string | null }).agent_id;
  const brokerId = (lead as { broker_id: string | null }).broker_id;
  if (!leadAccessibleBySession(session, agentId, brokerId, supervisorUserId)) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  const viewedAt = new Date().toISOString();
  const { error: updErr, data: updated } = await admin
    .from("deal_documents")
    .update({ viewed_by_agent_at: viewedAt })
    .eq("lead_id", leadId)
    .eq("status", "uploaded")
    .is("viewed_by_agent_at", null)
    .eq("direction", "requested")
    .not("file_url", "is", null)
    .select("id");

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  const count = Array.isArray(updated) ? updated.length : 0;
  return Response.json({ success: true, updated_count: count });
}
