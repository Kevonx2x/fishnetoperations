import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

const BodySchema = z.object({
  note: z.string().max(300).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
    if (session.role !== "agent" && session.role !== "admin" && session.role !== "team_member") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const { id } = await ctx.params;
    const leadId = Number.parseInt(String(id ?? ""), 10);
    if (!Number.isFinite(leadId) || leadId <= 0) return fail("BAD_REQUEST", "Invalid lead id", 400);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fromZodError(parsed.error);
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    const sb = await createSupabaseServerClient();
    const supervisorUserId =
      session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
    if (session.role === "team_member" && !supervisorUserId) {
      return fail("FORBIDDEN", "Not a team member", 403);
    }

    let admin: ReturnType<typeof createSupabaseAdmin>;
    try {
      admin = createSupabaseAdmin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server configuration error";
      return fail("SERVER_ERROR", msg, 500);
    }

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, agent_id, pipeline_stage, client_id, email, property_id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr) return fail("DATABASE_ERROR", leadErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const agentId = (lead as { agent_id: string | null }).agent_id;
    const ownsLead =
      session.role === "admin"
        ? true
        : session.role === "team_member"
          ? agentId != null && agentId === supervisorUserId
          : agentId != null && agentId === session.userId;
    if (!ownsLead) return fail("FORBIDDEN", "Not your lead", 403);

    const currentStage = String((lead as { pipeline_stage?: string }).pipeline_stage ?? "lead").trim().toLowerCase();
    if (currentStage === "closed") return ok({ already_closed: true });

    const nowIso = new Date().toISOString();

    // Position at end of Closed column
    let maxQ = admin
      .from("leads")
      .select("pipeline_position")
      .eq("pipeline_stage", "closed")
      .eq("agent_id", agentId)
      .order("pipeline_position", { ascending: false })
      .limit(1);
    const { data: maxRow } = await maxQ.maybeSingle();
    const maxPos =
      typeof (maxRow as { pipeline_position?: number } | null)?.pipeline_position === "number"
        ? (maxRow as { pipeline_position: number }).pipeline_position
        : -1;

    const { error: updErr } = await admin
      .from("leads")
      .update({
        pipeline_stage: "closed",
        pipeline_position: maxPos + 1,
        updated_at: nowIso,
        closed_date: nowIso,
        closed_at: nowIso,
        closed_by: session.userId,
        closure_confirmed_by_client: null,
        closure_note: note,
      })
      .eq("id", leadId);
    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    await admin.from("lead_pipeline_history").insert({
      lead_id: leadId,
      from_stage: currentStage,
      to_stage: "closed",
      note: note,
      changed_by: session.userId,
    });

    // Notification
    const clientUserId = (lead as { client_id?: string | null }).client_id ?? null;
    let propertyName = PROPERTY_ADDRESS_FALLBACK;
    const pid = (lead as { property_id?: string | null }).property_id;
    if (pid) {
      const { data: propRow } = await admin.from("properties").select("name, location").eq("id", pid).maybeSingle();
      propertyName = propertyAddressLabel(propRow as { name?: string | null; location?: string | null } | null);
    }

    let agentName: string | null = null;
    try {
      const { data: agentProf } = await admin.from("profiles").select("full_name").eq("id", session.userId).maybeSingle();
      agentName = (agentProf as { full_name?: string | null } | null)?.full_name ?? null;
    } catch {
      agentName = null;
    }

    if (clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "closure_pending_confirmation",
        title: "Confirm deal closure",
        body: `Your agent marked your deal for ${propertyName} as closed. Please confirm in your dashboard.`,
        metadata: {
          lead_id: leadId,
          agent_name: agentName,
          property_name: propertyName,
          closed_at: nowIso,
          optional_note: note,
        },
      });
    }

    return ok({ lead_id: leadId, closed_at: nowIso });
  } catch (e) {
    console.error("[lead-close]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

