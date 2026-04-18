import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ONBOARDING_EMAIL_SUFFIX = "@onboarding.bahaygo.internal";

type TmRow = {
  id: string;
  agent_id: string | null;
  email: string;
  name: string;
};

function isInternalEmployeeRow(m: TmRow): boolean {
  if (m.agent_id != null) return false;
  const em = (m.email ?? "").trim().toLowerCase();
  if (em.endsWith(ONBOARDING_EMAIL_SUFFIX)) return true;
  if (/emmanuel/i.test((m.name ?? "").trim())) return true;
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: employeeId } = await ctx.params;
    if (!employeeId) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));
    const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

    const admin = createSupabaseAdmin();
    const { data: tm, error: tmErr } = await admin
      .from("team_members")
      .select("id, agent_id, email, name")
      .eq("id", employeeId)
      .maybeSingle();

    if (tmErr) {
      return NextResponse.json({ error: tmErr.message }, { status: 500 });
    }
    if (!tm || !isInternalEmployeeRow(tm as TmRow)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { count, error: cErr } = await admin
      .from("employee_notes")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId);
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const { data: notes, error: nErr } = await admin
      .from("employee_notes")
      .select("id, note, created_at, created_by")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (nErr) {
      return NextResponse.json({ error: nErr.message }, { status: 500 });
    }

    const rows = notes ?? [];
    const authorIds = [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))];
    let authors: Record<string, string | null> = {};
    if (authorIds.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
      authors = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
    }

    const enriched = rows.map((n) => ({
      ...n,
      author_name: n.created_by ? (authors[n.created_by] ?? null) : null,
    }));

    return NextResponse.json({
      notes: enriched,
      total: count ?? 0,
      limit,
      offset,
    });
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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: employeeId } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const text = typeof body.note === "string" ? body.note.trim() : "";
    if (!employeeId || !text) {
      return NextResponse.json({ error: "Missing employee or note." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: tm, error: tmErr } = await admin
      .from("team_members")
      .select("id, agent_id, email, name")
      .eq("id", employeeId)
      .maybeSingle();

    if (tmErr) {
      return NextResponse.json({ error: tmErr.message }, { status: 500 });
    }
    if (!tm || !isInternalEmployeeRow(tm as TmRow)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const { data: inserted, error: insErr } = await admin
      .from("employee_notes")
      .insert({
        employee_id: employeeId,
        note: text,
        created_by: denied.userId,
      })
      .select("id, note, created_at, created_by")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const { data: author } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", denied.userId)
      .maybeSingle();

    return NextResponse.json({
      note: {
        ...inserted,
        author_name: author?.full_name ?? null,
      },
    });
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
