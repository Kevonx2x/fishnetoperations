import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const STAGES = ["lead", "viewing", "offer", "reservation", "closed"] as const;

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  viewing: "Viewing",
  offer: "Offer",
  reservation: "Reservation",
  closed: "Closed",
};

async function resolveClientUserId(
  row: { client_id?: string | null; email: string },
): Promise<string | null> {
  if (row.client_id) return row.client_id;
  try {
    const admin = createSupabaseAdmin();
    const email = row.email.trim().toLowerCase();
    const { data: prof } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    return (prof as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function recompactStagePositions(
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  owner: { agent_id: string | null; broker_id: string | null },
  pipelineStage: string,
) {
  if (!owner.agent_id && !owner.broker_id) return;
  let q = sb
    .from("leads")
    .select("id")
    .eq("pipeline_stage", pipelineStage)
    .order("pipeline_position", { ascending: true });
  if (owner.agent_id) q = q.eq("agent_id", owner.agent_id);
  else if (owner.broker_id) q = q.eq("broker_id", owner.broker_id);
  const { data: list } = await q;
  const rows = (list as { id: number }[] | null) ?? [];
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i++) {
    await sb.from("leads").update({ pipeline_position: i, updated_at: now }).eq("id", rows[i].id);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const body = (await request.json()) as { leadId?: unknown; pipeline_stage?: unknown };
    const leadId = typeof body.leadId === "number" ? body.leadId : Number(body.leadId);
    const targetStage =
      typeof body.pipeline_stage === "string" ? body.pipeline_stage.trim().toLowerCase() : "";
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return fail("BAD_REQUEST", "leadId required", 400);
    }
    if (!targetStage || !STAGES.includes(targetStage as (typeof STAGES)[number])) {
      return fail("BAD_REQUEST", "Invalid pipeline_stage", 400);
    }

    const sb = await createSupabaseServerClient();
    const uid = session.userId;

    const { data: lead, error: fetchErr } = await sb
      .from("leads")
      .select("id, agent_id, broker_id, pipeline_stage, client_id, email, property_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const agentId = (lead as { agent_id: string | null }).agent_id;
    const brokerId = (lead as { broker_id: string | null }).broker_id;
    const allowed = session.role === "admin" || agentId === uid || brokerId === uid;
    if (!allowed) {
      return fail("FORBIDDEN", "Not your lead", 403);
    }

    const current = String((lead as { pipeline_stage?: string }).pipeline_stage ?? "lead");
    if (current === targetStage) {
      return ok({ success: true, pipeline_stage: targetStage });
    }

    let maxQ = sb
      .from("leads")
      .select("pipeline_position")
      .eq("pipeline_stage", targetStage)
      .order("pipeline_position", { ascending: false })
      .limit(1);
    if (agentId) maxQ = maxQ.eq("agent_id", agentId);
    else if (brokerId) maxQ = maxQ.eq("broker_id", brokerId);
    const { data: maxRow } = await maxQ.maybeSingle();

    const maxPos =
      typeof (maxRow as { pipeline_position?: number } | null)?.pipeline_position === "number"
        ? (maxRow as { pipeline_position: number }).pipeline_position
        : -1;
    const nextPos = maxPos + 1;
    const now = new Date().toISOString();

    const { error: updErr } = await sb
      .from("leads")
      .update({
        pipeline_stage: targetStage,
        pipeline_position: nextPos,
        updated_at: now,
      })
      .eq("id", leadId);
    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    await recompactStagePositions(sb, { agent_id: agentId, broker_id: brokerId }, current);

    const { error: histErr } = await sb.from("lead_pipeline_history").insert({
      lead_id: leadId,
      from_stage: current,
      to_stage: targetStage,
      note: null,
      changed_by: uid,
    });
    if (histErr) return fail("DATABASE_ERROR", histErr.message, 500);

    let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
    try {
      admin = createSupabaseAdmin();
    } catch {
      admin = null;
    }

    const clientUserId = await resolveClientUserId(
      lead as { client_id?: string | null; email: string },
    );
    const nextLabel = STAGE_LABEL[targetStage] ?? targetStage;

    let propertyAddress = PROPERTY_ADDRESS_FALLBACK;
    if (admin) {
      const pid = (lead as { property_id?: string | null }).property_id;
      if (pid) {
        const { data: propRow } = await admin
          .from("properties")
          .select("name, location")
          .eq("id", pid)
          .maybeSingle();
        propertyAddress = propertyAddressLabel(
          propRow as { name?: string | null; location?: string | null } | null,
        );
      }
    }

    if (admin && clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "deal_pipeline",
        title: "Deal update",
        body: `Your deal for ${propertyAddress} has moved to ${nextLabel}. Check your pipeline for next steps.`,
        metadata: { lead_id: leadId, pipeline_stage: targetStage },
      });
    }

    return ok({ success: true, pipeline_stage: targetStage });
  } catch (e) {
    console.error("[pipeline-set-stage]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}
