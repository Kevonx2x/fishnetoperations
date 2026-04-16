import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { InviteAcceptClient } from "./invite-accept-client";

export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let error: "invalid" | "expired" | "used" | null = null;
  let agentName = "";
  let role = "";
  let inviteeName = "";

  try {
    const admin = createSupabaseAdmin();
    const { data: row, error: qErr } = await admin
      .from("team_members")
      .select("id, name, email, role, status, invite_expires_at, agent_id")
      .eq("invite_token", token)
      .maybeSingle();

    if (qErr || !row) {
      error = "invalid";
    } else {
      const r = row as {
        name: string;
        email: string;
        role: string;
        status: string | null;
        invite_expires_at: string | null;
        agent_id: string;
      };
      if (r.status !== "pending") {
        error = "used";
      } else if (r.invite_expires_at && new Date(r.invite_expires_at).getTime() < Date.now()) {
        error = "expired";
      } else {
        inviteeName = r.name?.trim() || "";
        role = r.role;
        const { data: ag } = await admin.from("agents").select("name").eq("id", r.agent_id).maybeSingle();
        agentName = (ag as { name?: string } | null)?.name?.trim() || "Your agent";
      }
    }
  } catch {
    error = "invalid";
  }

  return (
    <InviteAcceptClient
      token={token}
      agentName={agentName}
      role={role}
      inviteeName={inviteeName}
      error={error}
    />
  );
}
