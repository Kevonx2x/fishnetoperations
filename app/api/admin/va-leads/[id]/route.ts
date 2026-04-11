import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED = new Set(["not_contacted", "contacted", "replied", "booked", "no_response"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const { id } = await ctx.params;
  if (!id) return fail("VALIDATION_ERROR", "Missing id", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const sb = createSupabaseAdmin();
  const { data: existing, error: fetchErr } = await sb.from("va_leads").select("*").eq("id", id).maybeSingle();
  if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
  if (!existing) return fail("NOT_FOUND", "Lead not found", 404);

  const o = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof o.status === "string") {
    const s = o.status.trim();
    if (!ALLOWED.has(s)) return fail("VALIDATION_ERROR", "Invalid status", 422);
    patch.status = s;
    if (s !== (existing as { status: string }).status) {
      patch.last_contacted_at = new Date().toISOString();
    }
  }
  if (typeof o.notes === "string") patch.notes = o.notes.trim() || null;
  if (typeof o.follow_up_stage === "string") patch.follow_up_stage = o.follow_up_stage.trim() || null;
  if (typeof o.assigned_to === "string") patch.assigned_to = o.assigned_to.trim() || null;
  if (o.messages_sent !== undefined) {
    const n =
      typeof o.messages_sent === "number"
        ? o.messages_sent
        : parseInt(String(o.messages_sent), 10);
    if (!Number.isFinite(n) || n < 0) return fail("VALIDATION_ERROR", "Invalid messages_sent", 422);
    patch.messages_sent = Math.floor(n);
  }

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "No updatable fields", 422);
  }

  const { data, error } = await sb.from("va_leads").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return fail("DATABASE_ERROR", error.message, 500);
  return ok(data);
}
