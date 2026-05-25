import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
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

  let notes: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "notes" in body) {
      const n = (body as { notes?: unknown }).notes;
      if (n === null || n === undefined) notes = null;
      else if (typeof n === "string") notes = n.trim() || null;
    }
  } catch {
    /* empty body is fine */
  }

  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { error: compErr } = await admin.from("ceo_checklist_completions").insert({
    item_id: id,
    completed_by: session.userId,
    notes,
    completed_at: now,
  });

  if (compErr) {
    return fail("DATABASE_ERROR", compErr.message, 500);
  }

  const { data, error: updErr } = await admin
    .from("ceo_checklist_items")
    .update({
      last_completed_at: now,
      last_completed_by: session.userId,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updErr) {
    return fail("DATABASE_ERROR", updErr.message, 500);
  }
  if (!data) {
    return fail("NOT_FOUND", "Checklist item not found", 404);
  }

  const { count } = await admin
    .from("ceo_checklist_completions")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);

  const { data: latest } = await admin
    .from("ceo_checklist_completions")
    .select("notes")
    .eq("item_id", id)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({
    ...data,
    completion_count: count ?? 1,
    last_completion_notes: latest?.notes ?? notes,
  });
}
