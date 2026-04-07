import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

const bodySchema = z.object({ decision: z.enum(["approve", "reject"]) });

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  const { id } = await context.params;
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
    const { data: row, error: fetchErr } = await sb
      .from("co_agent_requests")
      .select("id, property_id, agent_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return fail("DATABASE_ERROR", fetchErr.message, 500);
    }
    if (!row) {
      return fail("NOT_FOUND", "Request not found", 404);
    }
    if (row.status !== "pending") {
      return fail("INVALID_STATE", "Request is not pending", 400);
    }

    if (parsed.data.decision === "reject") {
      const { error } = await sb
        .from("co_agent_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) return fail("DATABASE_ERROR", error.message, 500);
      return ok({ ok: true as const });
    }

    const { error: linkErr } = await sb.from("property_agents").insert({
      property_id: row.property_id,
      agent_id: row.agent_id,
    });
    if (linkErr && linkErr.code !== "23505") {
      return fail("DATABASE_ERROR", linkErr.message, 500);
    }

    const { error: updErr } = await sb
      .from("co_agent_requests")
      .update({ status: "approved" })
      .eq("id", id);
    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    const propRes = await sb
      .from("properties")
      .select("name, location")
      .eq("id", row.property_id)
      .maybeSingle();
    const propLabel =
      propRes.data?.name?.trim() || propRes.data?.location || "the property";

    const { data: agent } = await sb
      .from("agents")
      .select("user_id, name, phone")
      .eq("id", row.agent_id)
      .maybeSingle();
    const agentUserId = (agent as { user_id?: string | null } | null)?.user_id;
    if (agentUserId) {
      const { error: notifErr } = await sb.from("notifications").insert({
        user_id: agentUserId,
        type: "co_agent_request",
        title: "Co-List Request Approved!",
        body: `You are now a listing agent on ${propLabel}. You will appear on the listing shortly.`,
      });
      if (notifErr) {
        console.error("co-agent approval notification:", notifErr.message);
      }
    }

    const phone = normalizePhoneE164(agent?.phone ?? null);
    if (phone) {
      await sendSmsTo(
        phone,
        `BahayGo: You were approved as a co-agent on ${propLabel}.`,
      );
    }

    return ok({ ok: true as const });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
