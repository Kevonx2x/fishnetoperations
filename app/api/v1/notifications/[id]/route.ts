import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
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

    const body = await request.json().catch(() => ({}));
    const markRead = (body as { read?: boolean }).read !== false;

    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: markRead ? new Date().toISOString() : null })
      .eq("id", id)
      .select()
      .single();

    if (error) return fail("DATABASE_ERROR", error.message, 500);
    return ok(data);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
