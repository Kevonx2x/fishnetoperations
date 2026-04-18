import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ONBOARDING_EMAIL_SUFFIX = "@onboarding.bahaygo.internal";

const DEPARTMENTS = new Set(["Engineering", "Sales", "Marketing", "Operations", "Design", "Other"]);
const EMP_TYPES = new Set(["Full Time", "Part Time", "Contractor", "Intern"]);
const CURRENCIES = new Set(["USD", "PHP"]);
const PERIODS = new Set(["Hourly", "Monthly", "Annual"]);
const STATUSES = new Set(["Trial", "Active", "On Leave", "Terminated"]);

type TmRow = {
  id: string;
  agent_id: string | null;
  email: string;
  name: string;
  employment_status: string | null;
};

function isInternalEmployeeRow(m: TmRow): boolean {
  if (m.agent_id != null) return false;
  const em = (m.email ?? "").trim().toLowerCase();
  if (em.endsWith(ONBOARDING_EMAIL_SUFFIX)) return true;
  if (/emmanuel/i.test((m.name ?? "").trim())) return true;
  return false;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const admin = createSupabaseAdmin();

    const { data: row, error: fetchErr } = await admin
      .from("team_members")
      .select("id, agent_id, email, name, employment_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!row || !isInternalEmployeeRow(row as TmRow)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};

    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.role === "string") patch.role = body.role.trim();
    if (typeof body.department === "string") {
      const d = body.department.trim();
      if (!DEPARTMENTS.has(d)) {
        return NextResponse.json({ error: "Invalid department." }, { status: 400 });
      }
      patch.department = d;
    }
    if (typeof body.employment_type === "string") {
      const t = body.employment_type.trim();
      if (!EMP_TYPES.has(t)) {
        return NextResponse.json({ error: "Invalid employment type." }, { status: 400 });
      }
      patch.employment_type = t;
    }
    if (typeof body.currency === "string") {
      const c = body.currency.trim().toUpperCase();
      if (!CURRENCIES.has(c)) {
        return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
      }
      patch.currency = c;
    }
    if (typeof body.rate_period === "string") {
      const p = body.rate_period.trim();
      if (!PERIODS.has(p)) {
        return NextResponse.json({ error: "Invalid rate period." }, { status: 400 });
      }
      patch.rate_period = p;
    }
    if (body.rate_amount !== undefined) {
      const rateRaw = body.rate_amount;
      const rate_amount =
        typeof rateRaw === "number" && Number.isFinite(rateRaw)
          ? rateRaw
          : typeof rateRaw === "string" && rateRaw.trim() !== ""
            ? Number.parseFloat(rateRaw)
            : NaN;
      if (!Number.isFinite(rate_amount) || rate_amount < 0) {
        return NextResponse.json({ error: "Invalid rate / salary amount." }, { status: 400 });
      }
      patch.rate_amount = rate_amount;
    }
    if (body.start_date === null || typeof body.start_date === "string") {
      const s = typeof body.start_date === "string" ? body.start_date.trim() : "";
      if (body.start_date !== null && s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
      }
      if (body.start_date === null) patch.start_date = null;
      else if (s) patch.start_date = s;
    }
    if (body.end_date === null || typeof body.end_date === "string") {
      const s = typeof body.end_date === "string" ? body.end_date.trim() : "";
      if (body.end_date !== null && s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
      }
      if (body.end_date === null) patch.end_date = null;
      else if (s) patch.end_date = s;
    }
    if (body.work_email === null || typeof body.work_email === "string") {
      patch.work_email = typeof body.work_email === "string" ? body.work_email.trim() || null : null;
    }
    if (body.personal_email === null || typeof body.personal_email === "string") {
      patch.personal_email =
        typeof body.personal_email === "string" ? body.personal_email.trim() || null : null;
    }
    if (body.hr_notes === null || typeof body.hr_notes === "string") {
      patch.hr_notes = typeof body.hr_notes === "string" ? body.hr_notes.trim() || null : null;
    }
    if (body.equity_pct !== undefined) {
      const equityRaw = body.equity_pct;
      let equity_pct = 0;
      if (typeof equityRaw === "number" && Number.isFinite(equityRaw)) {
        equity_pct = Math.max(0, equityRaw);
      } else if (typeof equityRaw === "string" && equityRaw.trim() !== "") {
        const e = Number.parseFloat(equityRaw);
        if (Number.isFinite(e)) equity_pct = Math.max(0, e);
      } else if (equityRaw === null) {
        equity_pct = 0;
      }
      patch.equity_pct = equity_pct;
    }
    if (typeof body.employment_status === "string") {
      const st = body.employment_status.trim();
      if (!STATUSES.has(st)) {
        return NextResponse.json({ error: "Invalid employment status." }, { status: 400 });
      }
      patch.employment_status = st;
      if (st === "Terminated" && body.end_date === undefined) {
        patch.end_date = new Date().toISOString().slice(0, 10);
      }
    }
    if (body.onboarding_checklist !== undefined) {
      if (body.onboarding_checklist === null || typeof body.onboarding_checklist !== "object") {
        return NextResponse.json({ error: "Invalid onboarding_checklist." }, { status: 400 });
      }
      patch.onboarding_checklist = body.onboarding_checklist as Record<string, unknown>;
    }
    if (body.equity_vesting_years !== undefined) {
      const v = typeof body.equity_vesting_years === "number" ? body.equity_vesting_years : Number(body.equity_vesting_years);
      if (!Number.isFinite(v) || v <= 0 || v > 20) {
        return NextResponse.json({ error: "Invalid equity vesting years." }, { status: 400 });
      }
      patch.equity_vesting_years = v;
    }
    if (body.equity_cliff_months !== undefined) {
      const c = typeof body.equity_cliff_months === "number" ? body.equity_cliff_months : Number(body.equity_cliff_months);
      if (!Number.isInteger(c) || c < 0 || c > 48) {
        return NextResponse.json({ error: "Invalid equity cliff months." }, { status: 400 });
      }
      patch.equity_cliff_months = c;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { data: updated, error: upErr } = await admin
      .from("team_members")
      .update(patch)
      .eq("id", id)
      .select(
        "id, created_at, name, email, role, user_id, agent_id, start_date, end_date, department, employment_type, rate_amount, currency, rate_period, hr_notes, equity_pct, equity_vesting_years, equity_cliff_months, employment_status, admin_added_by, work_email, personal_email, onboarding_checklist",
      )
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ employee: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: row, error: fetchErr } = await admin
      .from("team_members")
      .select("id, agent_id, email, name, employment_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!row || !isInternalEmployeeRow(row as TmRow)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if ((row as TmRow).employment_status !== "Terminated") {
      return NextResponse.json({ error: "Only terminated employees can be permanently deleted." }, { status: 400 });
    }

    const { error: delErr } = await admin.from("team_members").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
