import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  license_number: z.string().min(1).optional(),
  score: z.number().optional(),
  closings: z.number().int().min(0).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  broker_id: z.union([z.string().uuid(), z.null()]).optional(),
});

/** Admin: update agent + matching profiles row (name/email/phone). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const sb = createSupabaseAdmin();
  const { data: existing, error: fetchErr } = await sb
    .from("agents")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return fail("DATABASE_ERROR", fetchErr.message, 500);
  }
  if (!existing?.user_id) {
    return fail("NOT_FOUND", "Agent not found", 404);
  }

  const p = parsed.data;
  const agentUpdate: Record<string, unknown> = {};
  if (p.name !== undefined) agentUpdate.name = p.name;
  if (p.email !== undefined) agentUpdate.email = p.email;
  if (p.phone !== undefined) agentUpdate.phone = p.phone;
  if (p.license_number !== undefined) agentUpdate.license_number = p.license_number;
  if (p.score !== undefined) agentUpdate.score = p.score;
  if (p.closings !== undefined) agentUpdate.closings = p.closings;
  if (p.status !== undefined) agentUpdate.status = p.status;
  if (p.broker_id !== undefined) agentUpdate.broker_id = p.broker_id;

  if (Object.keys(agentUpdate).length > 0) {
    const { error: upErr } = await sb.from("agents").update(agentUpdate).eq("id", id);
    if (upErr) {
      return fail("DATABASE_ERROR", upErr.message, 500);
    }
  }

  const profileUpdate: Record<string, unknown> = {};
  if (p.name !== undefined) profileUpdate.full_name = p.name;
  if (p.email !== undefined) profileUpdate.email = p.email;
  if (p.phone !== undefined) profileUpdate.phone = p.phone;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profErr } = await sb
      .from("profiles")
      .update(profileUpdate)
      .eq("id", existing.user_id);
    if (profErr) {
      return fail("DATABASE_ERROR", profErr.message, 500);
    }
  }

  return ok({ updated: true });
}

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
