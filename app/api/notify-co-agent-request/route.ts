import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  propertyId: z.string().uuid(),
});

/**
 * After a co-agent request is created, notify all admins (service role).
 * Caller must be the requesting agent (session matches agents row).
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in required", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const sb = createSupabaseAdmin();
    const { data: agentRow, error: agentErr } = await sb
      .from("agents")
      .select("id, name")
      .eq("user_id", session.userId)
      .maybeSingle();

    if (agentErr) {
      return fail("DATABASE_ERROR", agentErr.message, 500);
    }
    if (!agentRow) {
      return fail("FORBIDDEN", "Not an agent", 403);
    }

    const { data: reqRow, error: reqErr } = await sb
      .from("co_agent_requests")
      .select("id")
      .eq("property_id", parsed.data.propertyId)
      .eq("agent_id", agentRow.id)
      .eq("status", "pending")
      .maybeSingle();

    if (reqErr) {
      return fail("DATABASE_ERROR", reqErr.message, 500);
    }
    if (!reqRow) {
      return fail("NOT_FOUND", "No pending co-agent request for this property", 404);
    }

    const { data: prop } = await sb
      .from("properties")
      .select("name, location")
      .eq("id", parsed.data.propertyId)
      .maybeSingle();

    const propertyName = prop?.name?.trim() || prop?.location || "a property";
    const agentName = agentRow.name?.trim() || "An agent";

    const { data: admins, error: adminsErr } = await sb.from("profiles").select("id").eq("role", "admin");
    if (adminsErr) {
      return fail("DATABASE_ERROR", adminsErr.message, 500);
    }

    const rows = (admins ?? []).map((p) => ({
      user_id: p.id,
      type: "co_agent_request" as const,
      title: "New Co-Agent Request",
      body: `${agentName} wants to represent ${propertyName}`,
      metadata: { link: "/admin" },
    }));

    if (rows.length === 0) {
      return ok({ notified: 0 });
    }

    const { error: insErr } = await sb.from("notifications").insert(rows);
    if (insErr) {
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    return ok({ notified: rows.length });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
