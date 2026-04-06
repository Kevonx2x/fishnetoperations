import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteCtx = { params: Promise<{ id: string }> };

/** List connected agents + approved agents available to add. */
export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return fail("UNAUTHORIZED", "Admin sign-in required", 401);
    }

    const { id: propertyId } = await ctx.params;
    const admin = createSupabaseAdmin();

    const { data: links, error: linkErr } = await admin
      .from("property_agents")
      .select("agent_id")
      .eq("property_id", propertyId);

    if (linkErr) {
      return fail("DATABASE_ERROR", linkErr.message, 500);
    }

    const linkedIds = [...new Set((links ?? []).map((r) => (r as { agent_id: string }).agent_id))];

    let connected: { id: string; name: string; email: string; status: string; verified: boolean | null }[] = [];
    if (linkedIds.length > 0) {
      const { data: agents, error: aErr } = await admin
        .from("agents")
        .select("id, name, email, status, verified")
        .in("id", linkedIds)
        .order("name");
      if (aErr) {
        return fail("DATABASE_ERROR", aErr.message, 500);
      }
      connected = (agents ?? []) as typeof connected;
    }

    const { data: approved, error: apErr } = await admin
      .from("agents")
      .select("id, name, email, status, verified")
      .eq("status", "approved")
      .eq("verified", true)
      .order("name");

    if (apErr) {
      return fail("DATABASE_ERROR", apErr.message, 500);
    }

    const linkedSet = new Set(linkedIds);
    const availableToAdd = ((approved ?? []) as { id: string; name: string; email: string }[]).filter(
      (a) => !linkedSet.has(a.id),
    );

    return ok({ connected, availableToAdd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return fail("SERVER_CONFIG", "SUPABASE_SERVICE_ROLE_KEY is not configured.", 503);
    }
    return fail("INTERNAL_ERROR", msg, 500);
  }
}

const postSchema = z.object({
  agent_id: z.string().uuid(),
});

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return fail("UNAUTHORIZED", "Admin sign-in required", 401);
    }

    const { id: propertyId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const admin = createSupabaseAdmin();

    const { data: agent, error: agentErr } = await admin
      .from("agents")
      .select("id, status, verified")
      .eq("id", parsed.data.agent_id)
      .maybeSingle();

    if (agentErr) {
      return fail("DATABASE_ERROR", agentErr.message, 500);
    }
    const a = agent as { id: string; status: string; verified: boolean | null } | null;
    if (!a || a.status !== "approved" || !a.verified) {
      return fail("BAD_REQUEST", "Only approved, verified agents can be linked.", 400);
    }

    const { error: insErr } = await admin.from("property_agents").insert({
      property_id: propertyId,
      agent_id: parsed.data.agent_id,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return fail("CONFLICT", "Agent is already connected to this property.", 409);
      }
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    return ok({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return fail("SERVER_CONFIG", "SUPABASE_SERVICE_ROLE_KEY is not configured.", 503);
    }
    return fail("INTERNAL_ERROR", msg, 500);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return fail("UNAUTHORIZED", "Admin sign-in required", 401);
    }

    const { id: propertyId } = await ctx.params;
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    if (!agentId || !z.string().uuid().safeParse(agentId).success) {
      return fail("BAD_REQUEST", "agent_id query parameter required", 400);
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("property_agents")
      .delete()
      .eq("property_id", propertyId)
      .eq("agent_id", agentId);

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }

    return ok({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return fail("SERVER_CONFIG", "SUPABASE_SERVICE_ROLE_KEY is not configured.", 503);
    }
    return fail("INTERNAL_ERROR", msg, 500);
  }
}
