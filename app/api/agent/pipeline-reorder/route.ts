import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STAGES = ["lead", "viewing", "offer", "reservation", "closed"] as const;

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const body = (await request.json()) as {
      pipeline_stage?: string;
      lead_ids?: unknown;
    };
    const pipelineStage = typeof body.pipeline_stage === "string" ? body.pipeline_stage.trim() : "";
    const leadIds = body.lead_ids;
    if (!pipelineStage || !STAGES.includes(pipelineStage as (typeof STAGES)[number])) {
      return fail("BAD_REQUEST", "Invalid pipeline_stage", 400);
    }
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return fail("BAD_REQUEST", "lead_ids required", 400);
    }
    const ids = leadIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length !== leadIds.length) {
      return fail("BAD_REQUEST", "Invalid lead_ids", 400);
    }

    const sb = await createSupabaseServerClient();
    const uid = session.userId;

    const { data: rows, error: fetchErr } = await sb
      .from("leads")
      .select("id, agent_id, broker_id, pipeline_stage")
      .in("id", ids);

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!rows || rows.length !== ids.length) {
      return fail("BAD_REQUEST", "Some leads not found", 400);
    }

    for (const r of rows as { id: number; agent_id: string | null; broker_id: string | null; pipeline_stage: string }[]) {
      const allowed =
        session.role === "admin" || r.agent_id === uid || r.broker_id === uid;
      if (!allowed) {
        return fail("FORBIDDEN", "Not your lead", 403);
      }
      if (String(r.pipeline_stage) !== pipelineStage) {
        return fail("BAD_REQUEST", "Lead not in this pipeline stage", 400);
      }
    }

    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i++) {
      const { error: updErr } = await sb
        .from("leads")
        .update({ pipeline_position: i, updated_at: now })
        .eq("id", ids[i]);
      if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);
    }

    return ok({ success: true });
  } catch (e) {
    console.error("[pipeline-reorder]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}
