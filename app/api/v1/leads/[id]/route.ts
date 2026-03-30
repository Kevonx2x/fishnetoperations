import { NextRequest } from "next/server";
import { patchLeadSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { verifyAdminApiRequest } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseUserClient } from "@/lib/supabase-route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = patchLeadSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const admin = verifyAdminApiRequest(request);
    const userClient = createSupabaseUserClient(request);
    const { data: userData } = await userClient.auth.getUser();

    const sb = admin ? createSupabaseAdmin() : userClient;
    if (!admin && !userData.user) {
      return fail("UNAUTHORIZED", "Sign in or provide x-admin-password", 401);
    }

    const { data, error } = await sb
      .from("leads")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, error.code === "PGRST116" ? 404 : 500);
    }

    if (userData.user) {
      await logActivity(userClient, {
        actor_id: userData.user.id,
        action: "lead.update",
        entity_type: "lead",
        entity_id: id,
        metadata: { fields: Object.keys(parsed.data) },
      }).catch(() => {});
    }

    return ok(data);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
