import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export async function PATCH(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.is_complete === "boolean") patch.is_complete = body.is_complete;
    if (body.notes === null || typeof body.notes === "string") patch.notes = body.notes;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("employee_deliverables")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deliverable: data });
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

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const employee_id = typeof body.employee_id === "string" ? body.employee_id : "";
    const week_number = typeof body.week_number === "number" ? body.week_number : Number(body.week_number);
    const deliverable_text = typeof body.deliverable_text === "string" ? body.deliverable_text.trim() : "";
    const priority = typeof body.priority === "string" ? body.priority.trim() : "";

    if (!employee_id || !deliverable_text || !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (!Number.isInteger(week_number) || week_number < 1 || week_number > 4) {
      return NextResponse.json({ error: "week_number must be 1–4." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("employee_deliverables")
      .insert({
        employee_id,
        week_number,
        deliverable_text,
        priority,
        is_complete: false,
        notes: null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deliverable: data });
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
