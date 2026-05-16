import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

const VALID_STAGES = new Set(["lead", "viewing", "offer", "reservation", "closed"]);

function restoredPipelineStage(stageAtArchive: string | null | undefined): string {
  const s = String(stageAtArchive ?? "").trim().toLowerCase();
  if (VALID_STAGES.has(s)) return s;
  return "lead";
}

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

  const body = (await req.json().catch(() => ({}))) as { lead_id?: unknown };
  const leadId = typeof body.lead_id === "number" ? body.lead_id : Number(body.lead_id);
  if (!Number.isFinite(leadId) || leadId < 1) {
    return Response.json({ error: "lead_id required" }, { status: 400 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const sb = await createSupabaseServerClient();
  const supervisorUserId =
    session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
  if (session.role === "team_member" && !supervisorUserId) {
    return Response.json({ error: "Not a team member" }, { status: 403 });
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id, archived_at, stage_at_archive, pipeline_stage")
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
  const allowed = leadAccessibleBySession(session, agentId, brokerId, supervisorUserId);
  if (!allowed) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  const archivedAt = (lead as { archived_at?: string | null }).archived_at;
  if (!archivedAt) {
    return Response.json({ error: "Lead is not archived" }, { status: 400 });
  }

  const stageAtArchive = (lead as { stage_at_archive?: string | null }).stage_at_archive;
  const pipelineStage = restoredPipelineStage(stageAtArchive);

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("leads")
    .update({
      archived_at: null,
      archive_reason: null,
      archive_note: null,
      stage_at_archive: null,
      pipeline_stage: pipelineStage,
      updated_at: now,
    })
    .eq("id", leadId);

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, pipeline_stage: pipelineStage });
}
