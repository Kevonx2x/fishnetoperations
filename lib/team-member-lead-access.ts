import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminPanelRole } from "@/lib/auth-roles";

/**
 * For a `team_member` profile, returns the supervising listing agent's profile id (`agents.user_id`)
 * when their `team_members` row is active.
 */
export async function resolveTeamMemberSupervisorUserId(
  sb: SupabaseClient,
  teamMemberUserId: string,
): Promise<string | null> {
  const { data: tm, error } = await sb
    .from("team_members")
    .select("agent_id")
    .eq("user_id", teamMemberUserId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !tm?.agent_id) return null;
  const { data: ag, error: agErr } = await sb
    .from("agents")
    .select("user_id")
    .eq("id", tm.agent_id)
    .maybeSingle();
  if (agErr || !ag) return null;
  return (ag as { user_id: string }).user_id ?? null;
}

export function leadAccessibleBySession(
  session: { userId: string; role: string },
  leadAgentProfileId: string | null,
  leadBrokerProfileId: string | null,
  supervisorProfileUserId: string | null,
): boolean {
  if (isAdminPanelRole(session.role)) return true;
  if (leadBrokerProfileId && leadBrokerProfileId === session.userId) return true;
  if (leadAgentProfileId && leadAgentProfileId === session.userId) return true;
  if (
    session.role === "team_member" &&
    supervisorProfileUserId &&
    leadAgentProfileId &&
    leadAgentProfileId === supervisorProfileUserId
  ) {
    return true;
  }
  return false;
}
