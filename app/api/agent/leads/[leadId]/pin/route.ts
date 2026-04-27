import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

/**
 * Toggle "pinned" status for a lead in the agent pipeline.
 * Pin state is persisted on the `leads` row (pinned, pinned_at).
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
    if (
      session.role !== "agent" &&
      session.role !== "admin" &&
      session.role !== "broker" &&
      session.role !== "team_member"
    ) {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const { leadId: leadIdRaw } = await ctx.params;
    const leadId = Number(leadIdRaw);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return fail("BAD_REQUEST", "Invalid leadId", 400);
    }

    const sb = await createSupabaseServerClient();
    const supervisorUserId =
      session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
    if (session.role === "team_member" && !supervisorUserId) {
      return fail("FORBIDDEN", "Not a team member", 403);
    }

    const { data: lead, error: fetchErr } = await sb
      .from("leads")
      .select("id, agent_id, broker_id, pinned")
      .eq("id", leadId)
      .maybeSingle();
    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const allowed = leadAccessibleBySession(
      session,
      (lead as { agent_id: string | null }).agent_id,
      (lead as { broker_id: string | null }).broker_id,
      supervisorUserId,
    );
    if (!allowed) return fail("FORBIDDEN", "Not your lead", 403);

    const currentlyPinned = Boolean((lead as { pinned?: boolean | null }).pinned);
    const nextPinned = !currentlyPinned;
    const nowIso = new Date().toISOString();

    const { error: updErr } = await sb
      .from("leads")
      .update({
        pinned: nextPinned,
        pinned_at: nextPinned ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", leadId);
    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    return ok({ success: true, lead_id: leadId, pinned: nextPinned, pinned_at: nextPinned ? nowIso : null });
  } catch (e) {
    console.error("[lead-pin]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

