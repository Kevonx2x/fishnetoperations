import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const DEPARTMENTS = new Set(["Engineering", "Sales", "Marketing", "Operations", "Design", "Other"]);
const EMP_TYPES = new Set(["Full Time", "Part Time", "Contractor", "Intern"]);
const CURRENCIES = new Set(["USD", "PHP"]);
const PERIODS = new Set(["Hourly", "Monthly", "Annual"]);

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";
    const employment_type = typeof body.employment_type === "string" ? body.employment_type.trim() : "";
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "PHP";
    const rate_period = typeof body.rate_period === "string" ? body.rate_period.trim() : "";
    const startRaw = typeof body.start_date === "string" ? body.start_date.trim() : "";
    const hr_notes =
      body.hr_notes === null || typeof body.hr_notes === "string" ? (body.hr_notes as string | null) : null;
    const work_email =
      body.work_email === null || typeof body.work_email === "string"
        ? (typeof body.work_email === "string" ? body.work_email.trim() || null : null)
        : undefined;
    const personal_email =
      body.personal_email === null || typeof body.personal_email === "string"
        ? (typeof body.personal_email === "string" ? body.personal_email.trim() || null : null)
        : undefined;

    const rateRaw = body.rate_amount;
    const rate_amount =
      typeof rateRaw === "number" && Number.isFinite(rateRaw)
        ? rateRaw
        : typeof rateRaw === "string" && rateRaw.trim() !== ""
          ? Number.parseFloat(rateRaw)
          : NaN;

    const equityRaw = body.equity_pct;
    let equity_pct = 0;
    if (typeof equityRaw === "number" && Number.isFinite(equityRaw)) {
      equity_pct = Math.max(0, equityRaw);
    } else if (typeof equityRaw === "string" && equityRaw.trim() !== "") {
      const e = Number.parseFloat(equityRaw);
      if (Number.isFinite(e)) equity_pct = Math.max(0, e);
    }

    if (!name || !role || role.length > 120) {
      return NextResponse.json({ error: "Invalid name or role." }, { status: 400 });
    }
    if (!DEPARTMENTS.has(department)) {
      return NextResponse.json({ error: "Invalid department." }, { status: 400 });
    }
    if (!EMP_TYPES.has(employment_type)) {
      return NextResponse.json({ error: "Invalid employment type." }, { status: 400 });
    }
    if (!CURRENCIES.has(currency)) {
      return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
    }
    if (!PERIODS.has(rate_period)) {
      return NextResponse.json({ error: "Invalid rate period." }, { status: 400 });
    }
    if (!startRaw || !/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) {
      return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    }
    if (!Number.isFinite(rate_amount) || rate_amount < 0) {
      return NextResponse.json({ error: "Invalid rate / salary amount." }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "member";
    const email = `${slug}.${crypto.randomUUID().slice(0, 8)}@onboarding.bahaygo.internal`;

    const admin = createSupabaseAdmin();
    const insertRow: Record<string, unknown> = {
      name,
      email,
      role,
      agent_id: null,
      status: "active",
      start_date: startRaw,
      department,
      employment_type,
      rate_amount,
      currency,
      rate_period,
      hr_notes: hr_notes?.trim() || null,
      equity_pct,
      employment_status: "Trial",
      admin_added_by: denied.userId,
    };
    if (work_email !== undefined) insertRow.work_email = work_email;
    if (personal_email !== undefined) insertRow.personal_email = personal_email;

    const { data, error } = await admin
      .from("team_members")
      .insert(insertRow)
      .select(
        "id, created_at, name, email, role, user_id, agent_id, start_date, end_date, department, employment_type, rate_amount, currency, rate_period, hr_notes, equity_pct, equity_vesting_years, equity_cliff_months, employment_status, admin_added_by, work_email, personal_email, onboarding_checklist",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employee: data });
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
