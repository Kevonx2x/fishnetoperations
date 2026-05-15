import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { manilaLocalDateTimeToOffsetIso, normalizeTimeHmForInput } from "@/lib/manila-datetime";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";
import { assertViewingSlotAvailable, fetchAgentViewingSlotSettings } from "@/lib/viewing-slot-conflict";

const STAGES = ["lead", "viewing", "offer", "reservation", "closed"] as const;

const bodySchema = z.object({
  leadId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(15),
  notes: z.string().max(300).optional().nullable(),
});

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
    if (
      session.role !== "agent" &&
      session.role !== "admin" &&
      session.role !== "broker" &&
      session.role !== "team_member"
    ) {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return fail("BAD_REQUEST", parsedBody.error.issues.map((i) => i.message).join("; ") || "Invalid body", 400);
    }
    const { leadId, date, time, notes } = parsedBody.data;
    const timeHm = normalizeTimeHmForInput(time);
    if (!timeHm) {
      return fail("BAD_REQUEST", "Time must be HH:mm", 400);
    }

    let scheduledAt: string;
    try {
      scheduledAt = manilaLocalDateTimeToOffsetIso(date, timeHm);
    } catch (e) {
      return fail("BAD_REQUEST", e instanceof Error ? e.message : "Invalid date/time", 400);
    }

    const scheduledInstant = new Date(scheduledAt);
    if (Number.isNaN(scheduledInstant.getTime())) {
      return fail("BAD_REQUEST", "Invalid scheduled_at", 400);
    }
    if (scheduledInstant.getTime() < Date.now()) {
      return fail("BAD_REQUEST", "scheduled_at cannot be in the past", 400);
    }

    const sb = await createSupabaseServerClient();
    const uid = session.userId;
    const supervisorUserId =
      session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, uid) : null;
    if (session.role === "team_member" && !supervisorUserId) {
      return fail("FORBIDDEN", "Not a team member", 403);
    }

    const { data: lead, error: fetchErr } = await sb
      .from("leads")
      .select("id, agent_id, broker_id, pipeline_stage, client_id, email, property_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const agentId = (lead as { agent_id: string | null }).agent_id;
    const brokerId = (lead as { broker_id: string | null }).broker_id;
    const allowed = leadAccessibleBySession(session, agentId, brokerId, supervisorUserId);
    if (!allowed) {
      return fail("FORBIDDEN", "Not your lead", 403);
    }

    const currentStage = String((lead as { pipeline_stage?: string }).pipeline_stage ?? "lead");
    if (!STAGES.includes(currentStage as (typeof STAGES)[number])) {
      return fail("BAD_REQUEST", "Invalid current stage", 400);
    }

    let admin: ReturnType<typeof createSupabaseAdmin>;
    try {
      admin = createSupabaseAdmin();
    } catch {
      return fail("SERVER_ERROR", "Service configuration error", 500);
    }

    const notesTrim = notes?.trim() ? notes.trim().slice(0, 300) : null;
    const nowIso = new Date().toISOString();

    const ownerUserId =
      String((lead as { agent_id?: string | null }).agent_id ?? "").trim() ||
      String((lead as { broker_id?: string | null }).broker_id ?? "").trim() ||
      "";
    if (!ownerUserId) {
      return fail("BAD_REQUEST", "Lead has no assigned agent or broker.", 400);
    }
    const slotSettings = await fetchAgentViewingSlotSettings(admin, ownerUserId);

    const { data: existingViewing } = await admin.from("viewings").select("id").eq("lead_id", leadId).maybeSingle();
    const existingId = (existingViewing as { id?: string } | null)?.id ?? null;

    const slotCheck = await assertViewingSlotAvailable(admin, {
      ownerUserId,
      scheduledAtIso: scheduledAt,
      settings: slotSettings,
      excludeViewingId: existingId,
    });
    if (!slotCheck.ok) {
      if (slotCheck.reason === "overlap") {
        return NextResponse.json(
          {
            error: "time_slot_unavailable",
            message: "This time conflicts with another viewing. Please choose a different time.",
            conflicting_viewing_id: slotCheck.viewingId,
            conflicting_scheduled_at: slotCheck.scheduledAt,
          },
          { status: 409 },
        );
      }
      return fail("BAD_REQUEST", slotCheck.message, slotCheck.status);
    }

    if (existingId) {
      const { error: vu } = await admin
        .from("viewings")
        .update({
          scheduled_at: scheduledAt,
          status: "scheduled",
          notes: notesTrim,
          reschedule_request_id: null,
          updated_at: nowIso,
        })
        .eq("id", existingId);
      if (vu) return fail("DATABASE_ERROR", vu.message, 500);
    } else {
      const { error: vi } = await admin.from("viewings").insert({
        lead_id: leadId,
        scheduled_at: scheduledAt,
        status: "scheduled",
        notes: notesTrim,
        reschedule_request_id: null,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (vi) return fail("DATABASE_ERROR", vi.message, 500);
    }

    if (currentStage !== "viewing") {
      let maxQ = sb
        .from("leads")
        .select("pipeline_position")
        .eq("pipeline_stage", "viewing")
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
          pipeline_stage: "viewing",
          pipeline_position: nextPos,
          updated_at: now,
        })
        .eq("id", leadId);
      if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

      await recompactStagePositions(sb, { agent_id: agentId, broker_id: brokerId }, currentStage);

      const { error: histErr } = await sb.from("lead_pipeline_history").insert({
        lead_id: leadId,
        from_stage: currentStage,
        to_stage: "viewing",
        note: null,
        changed_by: uid,
      });
      if (histErr) return fail("DATABASE_ERROR", histErr.message, 500);
    }

    const propertyId = (lead as { property_id?: string | null }).property_id;
    let propertyName = PROPERTY_ADDRESS_FALLBACK;
    if (admin && propertyId) {
      const { data: propRow } = await admin
        .from("properties")
        .select("name, location")
        .eq("id", propertyId)
        .maybeSingle();
      propertyName =
        (propRow as { name?: string | null } | null)?.name?.trim() ||
        (propRow as { location?: string | null } | null)?.location?.trim() ||
        propertyAddressLabel(propRow as { name?: string | null; location?: string | null } | null);
    }

    const clientUserId = await resolveClientUserId(lead as { client_id?: string | null; email: string });
    const d = new Date(scheduledAt);
    const dateStr = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    if (admin && clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "viewing_confirmed",
        title: "Viewing scheduled",
        body: `Your viewing for ${propertyName} is set for ${dateStr} at ${timeStr}.`,
        metadata: {
          lead_id: leadId,
          property_id: propertyId ?? null,
          scheduled_at: scheduledAt,
          property_name: propertyName,
        },
      });
    }

    const seenIso = new Date().toISOString();
    const { error: seenErr } = await sb
      .from("leads")
      .update({ new_viewing_request_seen_at: seenIso, updated_at: seenIso })
      .eq("id", leadId);
    if (seenErr) {
      console.warn("[pipeline-confirm-viewing] new_viewing_request_seen_at update failed", seenErr);
    }

    return ok({ success: true, scheduled_at: scheduledAt });
  } catch (e) {
    console.error("[pipeline-confirm-viewing]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}
