import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const INTERNAL_ROLES = ["owner", "co_founder", "va_admin"] as const;

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const trialRaw = typeof body.trial_start_date === "string" ? body.trial_start_date.trim() : "";

    if (!name || !INTERNAL_ROLES.includes(role as (typeof INTERNAL_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid name or role." }, { status: 400 });
    }

    const trial_start_date =
      trialRaw && /^\d{4}-\d{2}-\d{2}$/.test(trialRaw) ? trialRaw : new Date().toISOString().slice(0, 10);

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "member";
    const email = `${slug}.${crypto.randomUUID().slice(0, 8)}@onboarding.bahaygo.internal`;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("team_members")
      .insert({
        name,
        email,
        role,
        trial_start_date,
        created_by: denied.userId,
        agent_id: null,
        status: "active",
      })
      .select("id, created_at, name, email, role, user_id, agent_id, trial_start_date")
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
