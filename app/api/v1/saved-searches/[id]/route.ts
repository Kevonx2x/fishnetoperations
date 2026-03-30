import { NextRequest } from "next/server";
import { patchSavedSearchSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseUserClient } from "@/lib/supabase-route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const body = await request.json();
    const parsed = patchSavedSearchSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { data, error } = await supabase
      .from("saved_searches")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }

    await logActivity(supabase, {
      actor_id: userData.user.id,
      action: "saved_search.update",
      entity_type: "saved_search",
      entity_id: id,
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

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const { error } = await supabase.from("saved_searches").delete().eq("id", id);

    if (error) return fail("DATABASE_ERROR", error.message, 500);

    await logActivity(supabase, {
      actor_id: userData.user.id,
      action: "saved_search.delete",
      entity_type: "saved_search",
      entity_id: id,
    }).catch(() => {});

    return ok({ deleted: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
