import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { CEO_CHECKLIST_CADENCES } from "@/lib/ceo-checklist-due";
import { CEO_CHECKLIST_CATEGORIES } from "@/lib/ceo-admin-constants";
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
  if ("description" in o) {
    const d = o.description;
    if (d === null) patch.description = null;
    else if (typeof d === "string") patch.description = d.trim() || null;
    else return fail("VALIDATION_ERROR", "Invalid description", 422);
  }
  if ("category" in o) {
    const category = typeof o.category === "string" ? o.category.trim() : "";
    if (!CEO_CHECKLIST_CATEGORIES.includes(category as (typeof CEO_CHECKLIST_CATEGORIES)[number])) {
      return fail("VALIDATION_ERROR", "Invalid category", 422);
    }
    patch.category = category;
  }
  if ("cadence" in o) {
    const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
    if (!CEO_CHECKLIST_CADENCES.includes(cadence as (typeof CEO_CHECKLIST_CADENCES)[number])) {
      return fail("VALIDATION_ERROR", "Invalid cadence", 422);
    }
    patch.cadence = cadence;
  }
  if ("estimated_minutes" in o) {
    const raw = o.estimated_minutes;
    if (raw === null) patch.estimated_minutes = null;
    else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return fail("VALIDATION_ERROR", "Invalid estimated_minutes", 422);
      }
      patch.estimated_minutes = Math.round(n);
    }
  }
  if ("is_active" in o) {
    if (typeof o.is_active !== "boolean") {
      return fail("VALIDATION_ERROR", "is_active must be boolean", 422);
    }
    patch.is_active = o.is_active;
  }
  if ("sort_order" in o) {
    const n = typeof o.sort_order === "number" ? o.sort_order : Number(o.sort_order);
    if (!Number.isFinite(n)) {
      return fail("VALIDATION_ERROR", "Invalid sort_order", 422);
    }
    patch.sort_order = Math.round(n);
  }

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "No fields to update", 422);
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("ceo_checklist_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  if (!data) {
    return fail("NOT_FOUND", "Checklist item not found", 404);
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
  const { error } = await admin.from("ceo_checklist_items").delete().eq("id", id);

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ deleted: true });
}
