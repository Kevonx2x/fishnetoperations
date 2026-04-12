import { type NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AdminProfileReportRow = {
  id: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  notes: string | null;
  reporter_name: string;
  reported_name: string;
};

/** List profile reports with reporter / reported names (service role). */
export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const sb = createSupabaseAdmin();
  const { data: reports, error } = await sb
    .from("reports")
    .select("id, created_at, reporter_id, reported_user_id, reason, notes")
    .order("created_at", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  const rows = reports ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.reporter_id as string, r.reported_user_id as string]))];

  const { data: profs } = ids.length
    ? await sb.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };

  const nameById = new Map<string, string>();
  for (const p of profs ?? []) {
    const id = p.id as string;
    const n = (p.full_name as string | null)?.trim();
    nameById.set(id, n || "—");
  }

  const data: AdminProfileReportRow[] = rows.map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    reporter_id: r.reporter_id as string,
    reported_user_id: r.reported_user_id as string,
    reason: r.reason as string,
    notes: (r.notes as string | null) ?? null,
    reporter_name: nameById.get(r.reporter_id as string) ?? "—",
    reported_name: nameById.get(r.reported_user_id as string) ?? "—",
  }));

  return ok(data);
}

/** Delete a report row (dismiss). */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return fail("VALIDATION_ERROR", "id query parameter required", 422);
  }

  const sb = createSupabaseAdmin();
  const { error } = await sb.from("reports").delete().eq("id", id);
  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  return ok({ deleted: true });
}

/** Send a general notification to the reported user (warn). */
export async function POST(request: NextRequest) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const body = (await request.json().catch(() => ({}))) as {
    reportedUserId?: string;
    reportId?: string;
  };
  const reportedUserId = body.reportedUserId?.trim();
  const reportId = body.reportId?.trim() ?? null;
  if (!reportedUserId) {
    return fail("VALIDATION_ERROR", "reportedUserId required", 422);
  }

  const sb = createSupabaseAdmin();
  const { error } = await sb.from("notifications").insert({
    user_id: reportedUserId,
    type: "general",
    title: "Community warning",
    body: "BahayGo admin reviewed a report involving your profile. Please follow our community guidelines.",
    metadata: {
      source: "admin_profile_report_warn",
      report_id: reportId,
    },
  });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  return ok({ notified: true });
}
