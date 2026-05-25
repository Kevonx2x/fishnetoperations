import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { CEO_DECISION_CATEGORIES } from "@/lib/ceo-admin-constants";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("ceo_decisions")
    .select("*")
    .order("decided_at", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ decisions: data ?? [] });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const context =
    typeof o.context === "string" && o.context.trim() ? o.context.trim() : null;
  const decision = typeof o.decision === "string" ? o.decision.trim() : "";
  const alternatives_considered =
    typeof o.alternatives_considered === "string" && o.alternatives_considered.trim()
      ? o.alternatives_considered.trim()
      : null;
  const reasoning =
    typeof o.reasoning === "string" && o.reasoning.trim() ? o.reasoning.trim() : null;
  const category = typeof o.category === "string" ? o.category.trim() : "other";

  let decided_at = new Date().toISOString();
  if (typeof o.decided_at === "string" && o.decided_at.trim()) {
    const parsed = new Date(o.decided_at);
    if (Number.isFinite(parsed.getTime())) {
      decided_at = parsed.toISOString();
    }
  }

  if (!title) {
    return fail("VALIDATION_ERROR", "Title is required", 422);
  }
  if (!decision) {
    return fail("VALIDATION_ERROR", "Decision is required", 422);
  }
  if (!CEO_DECISION_CATEGORIES.includes(category as (typeof CEO_DECISION_CATEGORIES)[number])) {
    return fail("VALIDATION_ERROR", "Invalid category", 422);
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("ceo_decisions")
    .insert({
      title,
      context,
      decision,
      alternatives_considered,
      reasoning,
      category,
      status: "active",
      decided_by: session.userId,
      decided_at,
    })
    .select("*")
    .single();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok(data, 201);
}
