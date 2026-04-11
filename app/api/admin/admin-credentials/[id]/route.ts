import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SUPER_ADMIN_EMAIL = "ron.business101@gmail.com";

function requireCredentialsAccess(denied: Awaited<ReturnType<typeof requireAdminSession>>) {
  if (denied === "unauthorized") return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  if ((denied.email ?? "").toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return fail("FORBIDDEN", "Credentials vault is restricted", 403);
  }
  return null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminSession();
  const block = requireCredentialsAccess(denied);
  if (block) return block;

  const { id } = await ctx.params;
  if (!id) return fail("VALIDATION_ERROR", "Missing id", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof o.service_name === "string") patch.service_name = o.service_name.trim();
  if (typeof o.username === "string") patch.username = o.username;
  if (typeof o.password_plain === "string") patch.password_plain = o.password_plain;
  if (o.monthly_cost !== undefined) {
    const monthly =
      typeof o.monthly_cost === "number"
        ? o.monthly_cost
        : parseFloat(String(o.monthly_cost ?? "0"));
    patch.monthly_cost = Number.isFinite(monthly) ? monthly : 0;
  }
  if (typeof o.notes === "string") patch.notes = o.notes.trim() || null;

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "No fields to update", 422);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("admin_credentials")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return fail("DATABASE_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Row not found", 404);
  return ok(data);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminSession();
  const block = requireCredentialsAccess(denied);
  if (block) return block;

  const { id } = await ctx.params;
  if (!id) return fail("VALIDATION_ERROR", "Missing id", 400);

  const sb = createSupabaseAdmin();
  const { error } = await sb.from("admin_credentials").delete().eq("id", id);
  if (error) return fail("DATABASE_ERROR", error.message, 500);
  return ok({ deleted: true });
}
