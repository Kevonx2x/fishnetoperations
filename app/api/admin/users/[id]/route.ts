import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  role: z.enum(["admin", "ops_admin", "broker", "agent", "client"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) return fromZodError(e);
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  if (id === denied.userId && parsed.role !== "admin") {
    return fail("FORBIDDEN", "You cannot remove your own admin role here.", 403);
  }

  const sb = createSupabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .update({ role: parsed.role, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ id, role: parsed.role });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  if (id === denied.userId) {
    return fail("FORBIDDEN", "You cannot delete your own account.", 403);
  }

  const sb = createSupabaseAdmin();
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) {
    return fail("AUTH_ERROR", error.message, 500);
  }

  return ok({ deleted: true });
}
