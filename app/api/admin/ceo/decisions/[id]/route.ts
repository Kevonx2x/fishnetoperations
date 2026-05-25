import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  CEO_DECISION_CATEGORIES,
  CEO_DECISION_STATUSES,
} from "@/lib/ceo-admin-constants";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) {
    return fail("VALIDATION_ERROR", "Missing id", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("title" in o) {
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) return fail("VALIDATION_ERROR", "Title cannot be empty", 422);
    patch.title = title;
  }
  if ("context" in o) {
    const c = o.context;
    if (c === null) patch.context = null;
    else if (typeof c === "string") patch.context = c.trim() || null;
    else return fail("VALIDATION_ERROR", "Invalid context", 422);
  }
  if ("decision" in o) {
    const decision = typeof o.decision === "string" ? o.decision.trim() : "";
    if (!decision) return fail("VALIDATION_ERROR", "Decision cannot be empty", 422);
    patch.decision = decision;
  }
  if ("alternatives_considered" in o) {
    const a = o.alternatives_considered;
    if (a === null) patch.alternatives_considered = null;
    else if (typeof a === "string") patch.alternatives_considered = a.trim() || null;
    else return fail("VALIDATION_ERROR", "Invalid alternatives_considered", 422);
  }
  if ("reasoning" in o) {
    const r = o.reasoning;
    if (r === null) patch.reasoning = null;
    else if (typeof r === "string") patch.reasoning = r.trim() || null;
    else return fail("VALIDATION_ERROR", "Invalid reasoning", 422);
  }
  if ("category" in o) {
    const category = typeof o.category === "string" ? o.category.trim() : "";
    if (!CEO_DECISION_CATEGORIES.includes(category as (typeof CEO_DECISION_CATEGORIES)[number])) {
      return fail("VALIDATION_ERROR", "Invalid category", 422);
    }
    patch.category = category;
  }
  if ("status" in o) {
    const status = typeof o.status === "string" ? o.status.trim() : "";
    if (!CEO_DECISION_STATUSES.includes(status as (typeof CEO_DECISION_STATUSES)[number])) {
      return fail("VALIDATION_ERROR", "Invalid status", 422);
    }
    patch.status = status;
  }

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "No fields to update", 422);
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("ceo_decisions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  if (!data) {
    return fail("NOT_FOUND", "Decision not found", 404);
  }

  return ok(data);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) {
    return fail("VALIDATION_ERROR", "Missing id", 400);
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("ceo_decisions").delete().eq("id", id);

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ deleted: true });
}
