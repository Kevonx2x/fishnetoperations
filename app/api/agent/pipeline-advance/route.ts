import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ORDER = ["lead", "viewing", "offer", "reservation", "closed"] as const;

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  viewing: "Viewing",
  offer: "Offer",
  reservation: "Reservation",
  closed: "Closed",
};

function nextPipelineStage(current: string): string | null {
  const i = ORDER.indexOf(current as (typeof ORDER)[number]);
  if (i < 0 || i >= ORDER.length - 1) return null;
  return ORDER[i + 1];
}

async function resolveClientUserId(
  row: { client_id?: string | null; email: string },
): Promise<string | null> {
  if (row.client_id) return row.client_id;
  try {
    const admin = createSupabaseAdmin();
    const email = row.email.trim().toLowerCase();
    const { data: prof } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    return (prof as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const body = (await request.json()) as { leadId?: number; note?: string | null };
    const leadId = body.leadId;
    if (leadId == null || typeof leadId !== "number" || !Number.isFinite(leadId)) {
      return fail("BAD_REQUEST", "leadId required", 400);
    }

    const sb = await createSupabaseServerClient();
    const { data: lead, error: fetchErr } = await sb
      .from("leads")
      .select("id, agent_id, broker_id, pipeline_stage, client_id, email, property_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const agentId = (lead as { agent_id: string | null }).agent_id;
    const brokerId = (lead as { broker_id: string | null }).broker_id;
    const uid = session.userId;
    const allowed =
      session.role === "admin" || agentId === uid || brokerId === uid;
    if (!allowed) {
      return fail("FORBIDDEN", "Not your lead", 403);
    }

    const current = String((lead as { pipeline_stage?: string }).pipeline_stage ?? "lead");
    const next = nextPipelineStage(current);
    if (!next) {
      return fail("BAD_REQUEST", "Already at final stage", 400);
    }

    const note =
      typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;

    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from("leads")
      .update({
        pipeline_stage: next,
        updated_at: nowIso,
        ...(next === "closed" ? { closed_date: nowIso } : {}),
      })
      .eq("id", leadId);
    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    const { error: histErr } = await sb.from("lead_pipeline_history").insert({
      lead_id: leadId,
      from_stage: current,
      to_stage: next,
      note,
      changed_by: uid,
    });
    if (histErr) return fail("DATABASE_ERROR", histErr.message, 500);

    let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
    try {
      admin = createSupabaseAdmin();
    } catch {
      admin = null;
    }

    const clientUserId = await resolveClientUserId(
      lead as { client_id?: string | null; email: string },
    );
    const nextLabel = STAGE_LABEL[next] ?? next;

    let propertyAddress = PROPERTY_ADDRESS_FALLBACK;
    if (admin) {
      const pid = (lead as { property_id?: string | null }).property_id;
      if (pid) {
        const { data: propRow } = await admin
          .from("properties")
          .select("name, location")
          .eq("id", pid)
          .maybeSingle();
        propertyAddress = propertyAddressLabel(
          propRow as { name?: string | null; location?: string | null } | null,
        );
      }
    }

    if (admin && clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "deal_pipeline",
        title: "Deal update",
        body: `Your deal for ${propertyAddress} has moved to ${nextLabel}. Check your pipeline for next steps.`,
        metadata: { lead_id: leadId, pipeline_stage: next },
      });
    }

    return ok({ success: true, pipeline_stage: next });
  } catch (e) {
    console.error("[pipeline-advance]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}
