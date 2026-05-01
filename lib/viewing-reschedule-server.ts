import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

type Session = NonNullable<Awaited<ReturnType<typeof getSessionProfile>>>;

export type ViewingRescheduleBundle = {
  session: Session;
  admin: ReturnType<typeof createSupabaseAdmin>;
  viewing: {
    id: string;
    lead_id: number;
    scheduled_at: string;
    status: string;
    /** Populated when authorize succeeds (pending reschedule). */
    reschedule_request_id: string;
  };
  lead: {
    id: number;
    agent_id: string | null;
    broker_id: string | null;
    client_id: string | null;
    property_id: string | null;
    viewing_request_id: string | null;
  };
};

const ALLOWED_ROLES = new Set(["agent", "admin", "broker", "team_member"]);

export async function authorizeViewingRescheduleMutation(
  viewingUuid: string,
): Promise<{ ok: true; bundle: ViewingRescheduleBundle } | { ok: false; status: number; message: string }> {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return { ok: false, status: 401, message: "Sign in required" };
  }
  if (!ALLOWED_ROLES.has(String(session.role))) {
    return { ok: false, status: 403, message: "Not allowed" };
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return { ok: false, status: 503, message: "Server is not configured." };
  }

  const { data: viewing, error: vErr } = await admin
    .from("viewings")
    .select("id, lead_id, scheduled_at, status, reschedule_request_id")
    .eq("id", viewingUuid)
    .maybeSingle();

  if (vErr || !viewing) {
    return { ok: false, status: 404, message: "Viewing not found" };
  }

  const v = viewing as {
    id: string;
    lead_id: number | string;
    scheduled_at: string;
    status: string;
    reschedule_request_id: string | null;
  };

  if (!v.reschedule_request_id?.trim()) {
    return { ok: false, status: 400, message: "No pending reschedule for this viewing." };
  }

  const leadId = typeof v.lead_id === "number" ? v.lead_id : Number(v.lead_id);
  if (!Number.isFinite(leadId)) {
    return { ok: false, status: 400, message: "Invalid lead" };
  }

  const { data: lead, error: lErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id, client_id, property_id, viewing_request_id")
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return { ok: false, status: 404, message: "Lead not found" };
  }

  const l = lead as {
    id: number;
    agent_id: string | null;
    broker_id: string | null;
    client_id: string | null;
    property_id: string | null;
    viewing_request_id: string | null;
  };

  const sb = (await createSupabaseServerClient()) as SupabaseClient;
  const supervisorUserId =
    session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
  if (session.role === "team_member" && !supervisorUserId) {
    return { ok: false, status: 403, message: "Not a team member" };
  }

  if (!leadAccessibleBySession(session, l.agent_id, l.broker_id, supervisorUserId)) {
    return { ok: false, status: 403, message: "Not your lead" };
  }

  return {
    ok: true,
    bundle: {
      session,
      admin,
      viewing: {
        id: String(v.id),
        lead_id: leadId,
        scheduled_at: String(v.scheduled_at),
        status: String(v.status ?? ""),
        reschedule_request_id: v.reschedule_request_id.trim(),
      },
      lead: {
        id: l.id,
        agent_id: l.agent_id,
        broker_id: l.broker_id,
        client_id: l.client_id,
        property_id: l.property_id,
        viewing_request_id: l.viewing_request_id,
      },
    },
  };
}
