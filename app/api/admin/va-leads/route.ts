import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function fullEscape(value: string): string {
  return value.replace(/[%_,():"\\]/g, "\\$&");
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const assignedTo = url.searchParams.get("assigned_to")?.trim() ?? "";

  const sb = createSupabaseAdmin();
  const todayIso = startOfTodayIso();

  const [totalRes, contactedRes, repliesRes, meetingsRes] = await Promise.all([
    sb.from("va_leads").select("*", { count: "exact", head: true }),
    sb
      .from("va_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "contacted")
      .gte("last_contacted_at", todayIso),
    sb
      .from("va_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "replied")
      .gte("last_contacted_at", todayIso),
    sb
      .from("va_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "booked")
      .gte("last_contacted_at", todayIso),
  ]);

  let q = sb.from("va_leads").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (assignedTo) q = q.eq("assigned_to", assignedTo);
  if (search) {
    const esc = fullEscape(search);
    q = q.or(
      `name.ilike.%${esc}%,email.ilike.%${esc}%,phone.ilike.%${esc}%,platform.ilike.%${esc}%`,
    );
  }

  const { data: leads, error } = await q;
  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  const { data: assignRows } = await sb.from("va_leads").select("assigned_to").not("assigned_to", "is", null);
  const assignOptions = [
    ...new Set((assignRows ?? []).map((r: { assigned_to: string | null }) => r.assigned_to).filter(Boolean)),
  ] as string[];

  return ok({
    stats: {
      totalLeads: totalRes.count ?? 0,
      contactedToday: contactedRes.count ?? 0,
      repliesToday: repliesRes.count ?? 0,
      meetingsBookedToday: meetingsRes.count ?? 0,
    },
    leads: leads ?? [],
    assignOptions: assignOptions.sort(),
  });
}

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return fail("VALIDATION_ERROR", "Name is required", 422);

  const statusRaw = typeof o.status === "string" ? o.status.trim() : "not_contacted";
  const allowed = new Set(["not_contacted", "contacted", "replied", "booked", "no_response"]);
  const status = allowed.has(statusRaw) ? statusRaw : "not_contacted";

  const sb = createSupabaseAdmin();
  const row = {
    name,
    role: typeof o.role === "string" ? o.role.trim() || null : null,
    phone: typeof o.phone === "string" ? o.phone.trim() || null : null,
    email: typeof o.email === "string" ? o.email.trim() || null : null,
    platform: typeof o.platform === "string" ? o.platform.trim() || null : null,
    listing_link: typeof o.listing_link === "string" ? o.listing_link.trim() || null : null,
    status,
    follow_up_stage: typeof o.follow_up_stage === "string" ? o.follow_up_stage.trim() || null : null,
    assigned_to: typeof o.assigned_to === "string" ? o.assigned_to.trim() || null : null,
    notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    messages_sent:
      typeof o.messages_sent === "number" && Number.isFinite(o.messages_sent)
        ? Math.max(0, Math.floor(o.messages_sent))
        : typeof o.messages_sent === "string"
          ? Math.max(0, parseInt(o.messages_sent, 10) || 0)
          : 0,
    last_contacted_at:
      status !== "not_contacted" ? new Date().toISOString() : null,
  };

  const { data, error } = await sb.from("va_leads").insert(row).select("*").single();
  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  return ok(data, 201);
}
