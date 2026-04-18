import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { EMMANUEL_DELIVERABLE_SEEDS } from "@/lib/emmanuel-onboarding-seed";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type TeamMemberRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  role: string;
  user_id: string | null;
  agent_id: string | null;
  trial_start_date: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type DeliverableRow = {
  id: string;
  employee_id: string;
  week_number: number;
  deliverable_text: string;
  priority: string;
  is_complete: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const ONBOARDING_EMAIL_SUFFIX = "@onboarding.bahaygo.internal";

/** Team Management list: internal onboarding only (Add Employee API), not legacy admin Team table or agent invites. */
function isInternalEmployeeForTeamManagement(m: TeamMemberRow): boolean {
  if (m.agent_id != null) return false;
  const email = (m.email ?? "").trim().toLowerCase();
  if (email.endsWith(ONBOARDING_EMAIL_SUFFIX)) return true;
  if (/emmanuel/i.test((m.name ?? "").trim())) return true;
  return false;
}

async function seedEmmanuelIfNeeded(
  admin: ReturnType<typeof createSupabaseAdmin>,
  members: TeamMemberRow[],
): Promise<void> {
  const emmanuel = members.find((m) => m.agent_id == null && /emmanuel/i.test((m.name ?? "").trim()));
  if (!emmanuel) return;

  const { count, error: countErr } = await admin
    .from("employee_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", emmanuel.id);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) return;

  const rows = EMMANUEL_DELIVERABLE_SEEDS.map((d) => ({
    employee_id: emmanuel.id,
    week_number: d.week_number,
    deliverable_text: d.deliverable_text,
    priority: d.priority,
    is_complete: false,
    notes: null as string | null,
  }));

  const { error: insErr } = await admin.from("employee_deliverables").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export async function GET() {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { data: tmRows, error: tmErr } = await admin
      .from("team_members")
      .select("id, created_at, name, email, role, user_id, agent_id, trial_start_date")
      .is("agent_id", null)
      .order("created_at", { ascending: false });

    if (tmErr) {
      return NextResponse.json({ error: tmErr.message }, { status: 500 });
    }

    const fetchedNullAgent = (tmRows ?? []) as TeamMemberRow[];
    console.log(
      "[team-management] team_members fetched (agent_id is null), count=%s rows=%s",
      fetchedNullAgent.length,
      JSON.stringify(fetchedNullAgent),
    );

    await seedEmmanuelIfNeeded(admin, fetchedNullAgent);

    const list = fetchedNullAgent.filter(isInternalEmployeeForTeamManagement);
    const userIds = [...new Set(list.map((m) => m.user_id).filter((id): id is string => !!id))];

    let profilesById: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profRows, error: pErr } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", userIds);
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
      profilesById = Object.fromEntries((profRows as ProfileRow[] | null)?.map((p) => [p.id, p]) ?? []);
    }

    const employeeIds = list.map((m) => m.id);
    let deliverables: DeliverableRow[] = [];
    if (employeeIds.length > 0) {
      const { data: dRows, error: dErr } = await admin
        .from("employee_deliverables")
        .select("*")
        .in("employee_id", employeeIds)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true });
      if (dErr) {
        return NextResponse.json({ error: dErr.message }, { status: 500 });
      }
      deliverables = (dRows ?? []) as DeliverableRow[];
    }

    const byEmployee: Record<string, DeliverableRow[]> = {};
    for (const d of deliverables) {
      if (!byEmployee[d.employee_id]) byEmployee[d.employee_id] = [];
      byEmployee[d.employee_id]!.push(d);
    }

    const employees = list.map((m) => ({
      ...m,
      profile: m.user_id ? (profilesById[m.user_id] ?? null) : null,
      deliverables: byEmployee[m.id] ?? [],
    }));

    return NextResponse.json({ employees });
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
