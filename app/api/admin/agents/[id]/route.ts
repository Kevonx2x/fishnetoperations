import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

/** Remove an agent registration row (does not delete auth user). */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  const sb = createSupabaseAdmin();
  const { error } = await sb.from("agents").delete().eq("id", id);
  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ deleted: true });
}
