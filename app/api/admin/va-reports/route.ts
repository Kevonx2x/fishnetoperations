import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function mondayStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const sb = createSupabaseAdmin();
  const weekStart = mondayStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: weekRows, error: weekErr } = await sb
    .from("va_daily_reports")
    .select("leads_found, contacts_made, replies, meetings_booked")
    .gte("report_date", weekStartStr)
    .lte("report_date", weekEndStr);

  if (weekErr) {
    return fail("DATABASE_ERROR", weekErr.message, 500);
  }

  const weeklyTotals = (weekRows ?? []).reduce(
    (acc, r) => ({
      leadsFound: acc.leadsFound + (r.leads_found ?? 0),
      contactsMade: acc.contactsMade + (r.contacts_made ?? 0),
      replies: acc.replies + (r.replies ?? 0),
      meetingsBooked: acc.meetingsBooked + (r.meetings_booked ?? 0),
    }),
    { leadsFound: 0, contactsMade: 0, replies: 0, meetingsBooked: 0 },
  );

  const { data: reports, error } = await sb
    .from("va_daily_reports")
    .select("*")
    .order("report_date", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({
    weeklyTotals,
    weekRange: { start: weekStartStr, end: weekEndStr },
    reports: reports ?? [],
  });
}

export async function POST(req: Request) {
  const denied = await requireFullAdminSession();
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
  const va_name = typeof o.va_name === "string" ? o.va_name.trim() : "";
  if (!va_name) return fail("VALIDATION_ERROR", "VA name is required", 422);

  const report_date =
    typeof o.report_date === "string" && o.report_date.trim()
      ? o.report_date.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("va_daily_reports")
    .insert({
      va_name,
      report_date,
      leads_found: num(o.leads_found),
      contacts_made: num(o.contacts_made),
      replies: num(o.replies),
      meetings_booked: num(o.meetings_booked),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("DUPLICATE", "A report for this VA and date already exists", 409);
    }
    return fail("DATABASE_ERROR", error.message, 500);
  }
  return ok(data, 201);
}
