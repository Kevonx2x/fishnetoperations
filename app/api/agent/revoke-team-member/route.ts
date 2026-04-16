import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  team_member_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
    if (session.role !== "agent" && session.role !== "admin") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("BAD_REQUEST", "Invalid JSON", 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const admin = createSupabaseAdmin();
    const { data: row, error: fetchErr } = await admin
      .from("team_members")
      .select("id, agent_id, status, user_id")
      .eq("id", parsed.data.team_member_id)
      .maybeSingle();

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    const tm = row as { id: string; agent_id: string | null; status: string | null; user_id: string | null } | null;
    if (!tm?.agent_id) return fail("NOT_FOUND", "Team member not found", 404);

    const { data: agentRow, error: agentErr } = await admin
      .from("agents")
      .select("id, user_id")
      .eq("id", tm.agent_id)
      .maybeSingle();
    if (agentErr) return fail("DATABASE_ERROR", agentErr.message, 500);
    const ar = agentRow as { id: string; user_id: string } | null;
    if (!ar) return fail("NOT_FOUND", "Agent not found", 404);
    if (session.role !== "admin" && ar.user_id !== session.userId) {
      return fail("FORBIDDEN", "Not your team member", 403);
    }

    if (tm.status !== "active") {
      return fail("BAD_REQUEST", "Revoke is only for active members", 400);
    }

    if (tm.user_id) {
      const { error: banErr } = await admin.auth.admin.updateUserById(tm.user_id, {
        ban_duration: "350630h",
      });
      if (banErr) {
        console.error("[revoke-team-member] ban:", banErr);
        return fail("AUTH_ERROR", banErr.message || "Could not disable account", 500);
      }
    }

    const { error: upErr } = await admin
      .from("team_members")
      .update({ status: "revoked" })
      .eq("id", tm.id);
    if (upErr) return fail("DATABASE_ERROR", upErr.message, 500);

    return ok({ id: tm.id, status: "revoked" });
  } catch (e) {
    console.error("[revoke-team-member]", e);
    return fail("INTERNAL", e instanceof Error ? e.message : "Unexpected error", 500);
  }
}
