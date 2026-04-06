import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  password: z.string().min(8).max(128),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return fail("UNAUTHORIZED", "Admin sign-in required", 401);
    }

    const { id: agentRecordId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const admin = createSupabaseAdmin();

    const { data: agent, error: fetchErr } = await admin
      .from("agents")
      .select("user_id")
      .eq("id", agentRecordId)
      .maybeSingle();

    if (fetchErr) {
      return fail("DATABASE_ERROR", fetchErr.message, 500);
    }

    const userId = (agent as { user_id?: string | null } | null)?.user_id;
    if (!userId) {
      return fail("NOT_FOUND", "Agent not found", 404);
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      password: parsed.data.password,
    });

    if (authErr) {
      return fail("AUTH_ERROR", authErr.message, 400);
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
