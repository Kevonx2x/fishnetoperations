import { NextRequest } from "next/server";
import { patchLeadSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { isAdminPanelRole } from "@/lib/auth-roles";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getSessionProfile();
    if (!session) {
      return fail("UNAUTHORIZED", "Sign in to update leads", 401);
    }

    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = patchLeadSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const isAdmin = isAdminPanelRole(session.role);
    const sb = isAdmin ? createSupabaseAdmin() : await createSupabaseServerClient();

    const { data, error } = await sb
      .from("leads")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, error.code === "PGRST116" ? 404 : 500);
    }

    const userSb = await createSupabaseServerClient();
    await logActivity(userSb, {
      actor_id: session.userId,
      action: "lead.update",
      entity_type: "lead",
      entity_id: id,
      metadata: { fields: Object.keys(parsed.data) },
    }).catch(() => {});

    return ok(data);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
