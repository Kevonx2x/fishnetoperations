import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const STATUSES = new Set(["New", "Interviewed", "Hired", "Rejected"]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) {
    return fail("VALIDATION_ERROR", "Missing applicant id", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const patch: { status?: string; notes?: string | null } = {};

  if ("status" in o) {
    const s = typeof o.status === "string" ? o.status.trim() : "";
    if (!STATUSES.has(s)) {
      return fail("VALIDATION_ERROR", "Invalid status", 422);
    }
    patch.status = s;
  }

  if ("notes" in o) {
    const n = o.notes;
    if (n === null || n === undefined) {
      patch.notes = null;
    } else if (typeof n === "string") {
      patch.notes = n.trim() ? n.trim() : null;
    } else {
      return fail("VALIDATION_ERROR", "Invalid notes", 422);
    }
  }

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "No fields to update", 422);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("applicants")
    .update(patch)
    .eq("id", id)
    .select("id, created_at, first_name, last_name, age, email, notes, status")
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  if (!data) {
    return fail("NOT_FOUND", "Applicant not found", 404);
  }

  return ok(data);
}
