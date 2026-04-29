import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { CLIENT_ARCHIVE_REASON_KEYS, labelForClientArchiveReason } from "@/lib/client-lead-archive";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  archive_reason: z.enum(CLIENT_ARCHIVE_REASON_KEYS),
  archive_note: z.string().max(300).optional().nullable(),
});

const ACTIVE_VIEWING_STATUSES = new Set(["pending", "confirmed", "rescheduled"]);

async function handleArchive(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getSessionProfile();
  if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (session.role !== "client") return fail("FORBIDDEN", "Clients only", 403);

  const { leadId: leadIdRaw } = await ctx.params;
  const leadId = Number(leadIdRaw);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return fail("BAD_REQUEST", "Invalid leadId", 400);
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return fail("SERVER_CONFIG", "Server is not configured.", 503);
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { archive_reason, archive_note } = parsed.data;
  const noteTrim = (archive_note ?? "").trim();
  if (archive_reason === "other" && !noteTrim) {
    return fail("BAD_REQUEST", "Please enter a reason when you select Other.", 400);
  }

  const archive_note_out: string | null = archive_reason === "other" ? noteTrim.slice(0, 300) : null;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id, client_id, agent_id, property_id, property_interest, pipeline_stage, viewing_request_id, archived_by_client",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return fail("SERVER_ERROR", leadErr.message, 500);
  const row = lead as {
    id: number;
    client_id: string | null;
    agent_id: string | null;
    property_id: string | null;
    property_interest: string | null;
    pipeline_stage: string | null;
    viewing_request_id: string | null;
    archived_by_client: boolean | null;
  } | null;

  if (!row || row.client_id !== session.userId) {
    return fail("NOT_FOUND", "Lead not found", 404);
  }
  if (row.archived_by_client) {
    return fail("BAD_REQUEST", "This lead is already archived.", 400);
  }

  const stageNorm = String(row.pipeline_stage ?? "lead").toLowerCase();
  const stage_at_archive = ["lead", "viewing", "offer", "reservation", "closed"].includes(stageNorm)
    ? stageNorm
    : "lead";

  const nowIso = new Date().toISOString();

  const { error: updErr } = await admin
    .from("leads")
    .update({
      archived_by_client: true,
      archived_at: nowIso,
      archive_reason,
      archive_note: archive_note_out,
      stage_at_archive,
      updated_at: nowIso,
    })
    .eq("id", leadId)
    .eq("client_id", session.userId);

  if (updErr) return fail("SERVER_ERROR", updErr.message, 500);

  if (stage_at_archive === "viewing" && row.viewing_request_id) {
    const { data: vr, error: vrErr } = await admin
      .from("viewing_requests")
      .select("id, status")
      .eq("id", row.viewing_request_id)
      .maybeSingle();
    if (!vrErr && vr) {
      const st = String((vr as { status?: string }).status ?? "").toLowerCase();
      if (ACTIVE_VIEWING_STATUSES.has(st)) {
        await admin
          .from("viewing_requests")
          .update({ status: "cancelled", updated_at: nowIso })
          .eq("id", row.viewing_request_id);
      }
    }
  }

  const agentUserId = row.agent_id?.trim() || null;
  if (agentUserId) {
    let propertyName =
      (row.property_interest && String(row.property_interest).trim()) || "this property";
    if (row.property_id) {
      const { data: prop } = await admin.from("properties").select("name, location").eq("id", row.property_id).maybeSingle();
      const p = prop as { name?: string | null; location?: string | null } | null;
      const title = (p?.name && String(p.name).trim()) || (p?.location && String(p.location).trim());
      if (title) propertyName = title;
    }

    const reasonLabel = labelForClientArchiveReason(archive_reason, archive_note_out);
    const title = `Client removed ${propertyName} from their pipeline`;
    const body = `Reason: ${reasonLabel}. Stage: ${stage_at_archive}.`;

    const { error: nErr } = await admin.from("notifications").insert({
      user_id: agentUserId,
      type: "lead_archived",
      title,
      body,
      metadata: {
        lead_id: leadId,
        property_id: row.property_id,
        property_name: propertyName,
        reason: reasonLabel,
        note: archive_note_out,
        stage_at_archive,
        link: "/dashboard/agent?tab=pipeline",
      },
    });
    if (nErr) {
      console.error("[client/leads/archive] notification insert failed", nErr.message);
    }
  }

  return ok({ success: true, stage_at_archive });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  return handleArchive(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  return handleArchive(req, ctx);
}
