import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

const BodySchema = z.object({
  lead_id: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(8).default("PHP"),
  terms_text: z.string().max(500).optional().nullable(),
  valid_until: z.string().max(32).optional().nullable(), // YYYY-MM-DD
  message: z.string().max(300).optional().nullable(),
});

async function resolveClientUserId(
  admin: ReturnType<typeof createSupabaseAdmin>,
  row: { client_id?: string | null; email: string },
): Promise<string | null> {
  if (row.client_id) return row.client_id;
  const email = row.email.trim().toLowerCase();
  const { data: prof } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  return (prof as { id?: string } | null)?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
    if (session.role !== "agent" && session.role !== "admin" && session.role !== "team_member") {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fromZodError(parsed.error);
    const body = parsed.data;

    const sb = await createSupabaseServerClient();
    const supervisorUserId =
      session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sb, session.userId) : null;
    if (session.role === "team_member" && !supervisorUserId) {
      return fail("FORBIDDEN", "Not a team member", 403);
    }

    let admin: ReturnType<typeof createSupabaseAdmin>;
    try {
      admin = createSupabaseAdmin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server configuration error";
      return fail("SERVER_ERROR", msg, 500);
    }

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, agent_id, pipeline_stage, pipeline_position, client_id, email, property_id")
      .eq("id", body.lead_id)
      .maybeSingle();
    if (leadErr) return fail("DATABASE_ERROR", leadErr.message, 500);
    if (!lead) return fail("NOT_FOUND", "Lead not found", 404);

    const agentId = (lead as { agent_id: string | null }).agent_id;
    const ownsLead =
      session.role === "admin"
        ? true
        : session.role === "team_member"
          ? agentId != null && agentId === supervisorUserId
          : agentId != null && agentId === session.userId;
    if (!ownsLead) return fail("FORBIDDEN", "Not your lead", 403);

    const nowIso = new Date().toISOString();

    // Insert offer
    const termsText = body.terms_text?.trim() ? body.terms_text.trim() : null;
    const validUntil = body.valid_until?.trim() ? body.valid_until.trim() : null;
    const currency = body.currency?.trim() ? body.currency.trim().toUpperCase() : "PHP";

    const { data: offerRow, error: offerErr } = await admin
      .from("offers")
      .insert({
        lead_id: body.lead_id,
        created_by: session.userId,
        amount: body.amount,
        currency,
        terms_text: termsText,
        valid_until: validUntil,
        status: "pending",
      })
      .select("id, created_at")
      .maybeSingle();
    if (offerErr) return fail("DATABASE_ERROR", offerErr.message, 500);
    const offerId = (offerRow as { id?: string } | null)?.id;
    if (!offerId) return fail("DATABASE_ERROR", "Offer insert failed", 500);

    // Move lead to Offer stage when currently before Offer
    const currentStage = String((lead as { pipeline_stage?: string }).pipeline_stage ?? "lead").trim().toLowerCase();
    const shouldAdvance = currentStage === "lead" || currentStage === "viewing";
    if (shouldAdvance) {
      let maxQ = admin
        .from("leads")
        .select("pipeline_position")
        .eq("pipeline_stage", "offer")
        .eq("agent_id", agentId)
        .order("pipeline_position", { ascending: false })
        .limit(1);
      const { data: maxRow } = await maxQ.maybeSingle();
      const maxPos =
        typeof (maxRow as { pipeline_position?: number } | null)?.pipeline_position === "number"
          ? (maxRow as { pipeline_position: number }).pipeline_position
          : -1;

      const { error: updErr } = await admin
        .from("leads")
        .update({
          pipeline_stage: "offer",
          pipeline_position: maxPos + 1,
          updated_at: nowIso,
        })
        .eq("id", body.lead_id);
      if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

      await admin.from("lead_pipeline_history").insert({
        lead_id: body.lead_id,
        from_stage: currentStage,
        to_stage: "offer",
        note: null,
        changed_by: session.userId,
      });
    } else {
      // Still update updated_at so the UI refreshes timestamps consistently.
      await admin.from("leads").update({ updated_at: nowIso }).eq("id", body.lead_id);
    }

    // Notify client
    const clientUserId = await resolveClientUserId(admin, lead as { client_id?: string | null; email: string });
    let propertyName = PROPERTY_ADDRESS_FALLBACK;
    const pid = (lead as { property_id?: string | null }).property_id;
    if (pid) {
      const { data: propRow } = await admin.from("properties").select("name, location").eq("id", pid).maybeSingle();
      propertyName = propertyAddressLabel(propRow as { name?: string | null; location?: string | null } | null);
    }

    const msg = body.message?.trim() ? body.message.trim() : null;
    let agentName: string | null = null;
    try {
      const { data: agentProf } = await admin.from("profiles").select("full_name").eq("id", session.userId).maybeSingle();
      agentName = (agentProf as { full_name?: string | null } | null)?.full_name ?? null;
    } catch {
      agentName = null;
    }
    if (clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "offer_sent",
        title: "Offer sent",
        body: `Your agent sent an offer for ${propertyName}. Check Messages for details.`,
        metadata: {
          lead_id: body.lead_id,
          offer_id: offerId,
          amount: body.amount,
          currency,
          valid_until: validUntil,
          agent_name: agentName,
          property_name: propertyName,
          message: msg,
        },
      });
    }

    return ok({ offer_id: offerId, created_at: (offerRow as { created_at?: string } | null)?.created_at ?? nowIso });
  } catch (e) {
    console.error("[offers]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

