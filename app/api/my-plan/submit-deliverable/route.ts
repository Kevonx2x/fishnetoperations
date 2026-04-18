import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const BLOCKED = new Set(["submitted", "pending_review", "approved"]);

export async function PATCH(req: Request) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const deliverable_id = typeof body.deliverable_id === "string" ? body.deliverable_id : "";
    if (!deliverable_id) {
      return NextResponse.json({ error: "Missing deliverable_id." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: del, error: delErr } = await admin
      .from("employee_deliverables")
      .select("id, employee_id, deliverable_text, status")
      .eq("id", deliverable_id)
      .maybeSingle();

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    if (!del) {
      return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
    }

    const st = (del.status as string) ?? "not_started";
    if (BLOCKED.has(st)) {
      return NextResponse.json({ error: "This deliverable cannot be submitted right now." }, { status: 400 });
    }

    const { data: tm, error: tmErr } = await admin
      .from("team_members")
      .select("id, user_id, name")
      .eq("id", del.employee_id)
      .maybeSingle();

    if (tmErr) {
      return NextResponse.json({ error: tmErr.message }, { status: 500 });
    }
    if (!tm || tm.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await admin
      .from("employee_deliverables")
      .update({
        status: "submitted",
        is_complete: false,
        updated_at: now,
      })
      .eq("id", deliverable_id)
      .select("*")
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const displayName = (tm.name ?? "Team member").trim() || "Team member";
    const shortText = (del.deliverable_text as string).slice(0, 200);
    const { error: noteErr } = await admin.from("employee_notes").insert({
      employee_id: tm.id,
      note: `${displayName} submitted "${shortText}" for review.`,
      created_by: user.id,
    });
    if (noteErr) {
      console.error("[submit-deliverable] employee_notes:", noteErr.message);
    }

    const { data: admins, error: admErr } = await admin.from("profiles").select("id").eq("role", "admin");
    if (admErr) {
      console.error("[submit-deliverable] admin list:", admErr.message);
    } else {
      const bodyText = `${displayName} submitted "${shortText}" for your review.`;
      for (const row of admins ?? []) {
        const { error: nErr } = await admin.from("notifications").insert({
          user_id: row.id,
          type: "general",
          title: "New deliverable submitted",
          body: bodyText,
          metadata: { deliverable_id },
        });
        if (nErr) {
          console.error("[submit-deliverable] notification:", nErr.message);
        }
      }
    }

    return NextResponse.json({ deliverable: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
