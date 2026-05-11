import { NextResponse } from "next/server";
import { isValid, parseISO } from "date-fns";
import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";
import { propertyAcceptsViewingRequests } from "@/lib/property-availability";

/** Client submitted a date/time — card belongs in Viewing, not Lead (see `leads_pipeline_stage_check`). */
const VIEWING_REQUEST_PIPELINE_STAGE = "viewing" as const;
const VIEWING_REQUEST_LEAD_STAGE = "active" as const;

const bodySchema = z.object({
  agent_user_id: z.string().uuid(),
  property_id: z.string().uuid().nullable(),
  client_name: z.string().min(1).max(500),
  client_email: z.string().email(),
  client_phone: z.string().min(1).max(200),
  scheduled_at: z.string().min(1),
  notes: z.string().max(10000).nullable().optional(),
  status: z.literal("pending"),
});

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Active lead for same client + property: not client-archived, not declined/closed — reuse instead of inserting a second card. */
async function findActiveDuplicateLeadIdForViewing(
  admin: ReturnType<typeof createSupabaseAdmin>,
  clientId: string,
  agentId: string,
  propertyId: string | null,
): Promise<number | null> {
  let q = admin
    .from("leads")
    .select("id")
    .eq("client_id", clientId)
    .eq("agent_id", agentId)
    .eq("archived_by_client", false)
    .not("pipeline_stage", "in", "(closed,declined)");
  if (propertyId) {
    q = q.eq("property_id", propertyId);
  } else {
    q = q.is("property_id", null);
  }
  const { data, error } = await q.order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.warn("[create-viewing-request] could not resolve active duplicate lead id", error);
    return null;
  }
  const id = (data as { id?: number } | null)?.id;
  return id != null ? Number(id) : null;
}

function isLeadsClientAgentPropertyDedupeViolation(err: {
  code?: string;
  message?: string;
  details?: string | null;
}): boolean {
  if (String(err.code) !== "23505") return false;
  const blob = `${err.message ?? ""} ${err.details ?? ""}`;
  return blob.includes("leads_client_agent_property_dedupe_idx");
}

/** After unique-violation on insert, resolve the row using the same active-duplicate filters. */
async function resolveActiveDuplicateLeadIdAfterDedupeInsert(
  admin: ReturnType<typeof createSupabaseAdmin>,
  clientId: string,
  agentUserId: string,
  propertyId: string | null,
): Promise<number | null> {
  const fromMaybe = await findActiveDuplicateLeadIdForViewing(admin, clientId, agentUserId, propertyId);
  if (fromMaybe != null) return fromMaybe;
  let q = admin
    .from("leads")
    .select("id")
    .eq("client_id", clientId)
    .eq("agent_id", agentUserId)
    .eq("archived_by_client", false)
    .not("pipeline_stage", "in", "(closed,declined)");
  if (propertyId) {
    q = q.eq("property_id", propertyId);
  } else {
    q = q.is("property_id", null);
  }
  const { data, error } = await q.order("id", { ascending: false }).limit(1);
  if (error) {
    console.warn("[create-viewing-request] resolveActiveDuplicateLeadIdAfterDedupeInsert failed", error);
    return null;
  }
  const row = (data as { id?: number }[] | null)?.[0];
  const id = row?.id;
  return id != null ? Number(id) : null;
}

/** Confirmed pipeline viewing (calendar row); excludes cancelled/completed. */
async function findActiveScheduledViewingForLead(
  admin: ReturnType<typeof createSupabaseAdmin>,
  leadId: number,
): Promise<{ id: string; scheduled_at: string } | null> {
  const { data, error } = await admin
    .from("viewings")
    .select("id, scheduled_at, status")
    .eq("lead_id", leadId)
    .eq("status", "scheduled")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; scheduled_at: string };
  return { id: String(row.id), scheduled_at: String(row.scheduled_at) };
}

async function notifyAgentViewingRescheduleRequested(
  admin: ReturnType<typeof createSupabaseAdmin>,
  args: {
    agentUserId: string;
    leadId: number;
    propertyId: string | null;
    propertyLabel: string;
    clientName: string;
    currentScheduledAt: string;
    requestedScheduledAt: string;
  },
) {
  const { error } = await admin.from("notifications").insert({
    user_id: args.agentUserId,
    type: "viewing_reschedule_requested",
    title: "Reschedule requested",
    body: null,
    metadata: {
      lead_id: args.leadId,
      property_id: args.propertyId,
      property_name: args.propertyLabel,
      client_name: args.clientName,
      current_scheduled_at: args.currentScheduledAt,
      requested_scheduled_at: args.requestedScheduledAt,
    },
  });
  if (error) {
    console.error("[create-viewing-request] viewing_reschedule_requested notification failed", error);
  }
}

async function notifyAgentViewingRequestUpdated(
  admin: ReturnType<typeof createSupabaseAdmin>,
  args: {
    agentUserId: string;
    leadId: number;
    propertyId: string | null;
    newScheduledAt: string;
    propertyLabel: string;
    clientName: string;
    oldScheduledAt: string | null;
    isUpdate: boolean;
  },
) {
  const {
    agentUserId,
    leadId,
    propertyId,
    newScheduledAt,
    propertyLabel,
    clientName,
    oldScheduledAt,
    isUpdate,
  } = args;
  const { error: nErr } = await admin.from("notifications").insert({
    user_id: agentUserId,
    type: "viewing_request",
    title: "Viewing request",
    body: null,
    metadata: {
      lead_id: leadId,
      property_id: propertyId,
      property_name: propertyLabel,
      client_name: clientName,
      new_scheduled_at: newScheduledAt,
      old_scheduled_at: oldScheduledAt,
      is_update: isUpdate,
    },
  });
  if (nErr) {
    console.error("[create-viewing-request] viewing_request notification insert failed", nErr);
  }
}

async function notifyAgentNewLead(
  admin: ReturnType<typeof createSupabaseAdmin>,
  args: {
    agentUserId: string;
    leadId: number;
    clientName: string;
    propertyLabel: string;
    clientEmail: string;
    clientPhone: string | null | undefined;
    sourceLabel: string;
    extraEmailHtml: string;
    smsSuffix: string;
  },
) {
  const {
    agentUserId,
    leadId,
    clientName,
    propertyLabel,
    clientEmail,
    clientPhone,
    sourceLabel,
    extraEmailHtml,
    smsSuffix,
  } = args;

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("[create-viewing-request] notifyAgentNewLead", {
    serviceRoleKeyConfigured: serviceRoleConfigured,
    notifyUserId: agentUserId,
    leadId,
    sourceLabel,
  });

  const { data: notifRows, error: nErr } = await admin
    .from("notifications")
    .insert({
      user_id: agentUserId,
      type: "new_lead",
      title: "New Lead",
      body: `${clientName} is interested in ${propertyLabel}`,
      metadata: {
        lead_id: leadId,
        source: sourceLabel,
        channel: null,
      },
    })
    .select("id")
    .single();

  if (nErr) {
    console.error("[create-viewing-request] notification insert failed", {
      message: nErr.message,
      code: nErr.code,
      details: nErr.details,
      hint: nErr.hint,
    });
  } else {
    console.log("[create-viewing-request] notification insert ok", {
      notificationId: (notifRows as { id?: string } | null)?.id ?? null,
      user_id: agentUserId,
    });
  }

  const { data: agent } = await admin
    .from("agents")
    .select("email, phone, name")
    .eq("user_id", agentUserId)
    .maybeSingle();
  const a = agent as { email?: string | null; phone?: string | null; name?: string | null } | null;

  const smsBody = `New lead on BahayGo! ${clientName} contacted you about ${propertyLabel}.${smsSuffix} Check your dashboard.`.slice(
    0,
    1600,
  );
  const smsTo = normalizePhoneE164(a?.phone);
  if (smsTo) {
    await sendSmsTo(smsTo, smsBody);
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const agentEmail = a?.email?.trim();
  if (resend && agentEmail) {
    const phoneDisplay = (clientPhone && String(clientPhone).trim()) || "—";
    await resend.emails.send({
      from: RESEND_FROM,
      to: agentEmail,
      subject: `New lead — ${propertyLabel}`,
      html: `
        <div style="font-family:Georgia,serif;color:#2C2C2C;line-height:1.5;max-width:560px">
          <h1 style="font-size:20px;margin:0 0 12px">New lead on BahayGo</h1>
          <p style="margin:0 0 8px"><strong>Property / interest:</strong> ${esc(propertyLabel)}</p>
          <p style="margin:0 0 8px"><strong>Client:</strong> ${esc(clientName)}</p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${esc(clientEmail)}</p>
          <p style="margin:0 0 8px"><strong>Phone:</strong> ${esc(phoneDisplay)}</p>
          <p style="margin:0 0 8px"><strong>Source:</strong> ${esc(sourceLabel)}</p>
          ${extraEmailHtml}
          <p style="margin-top:20px;font-size:12px;color:#666">Lead ID: ${leadId}</p>
        </div>
      `,
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
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

    const body = parsed.data;
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", session.userId)
      .maybeSingle();

    const clientNameFromProfile =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() || "Client";
    const clientEmail =
      (profile as { email?: string | null } | null)?.email?.trim() ||
      session.email?.trim() ||
      "";
    const clientPhoneFromProfile = (profile as { phone?: string | null } | null)?.phone?.trim() || null;

    if (!clientEmail) {
      return fail("BAD_REQUEST", "Profile or session email required.", 400);
    }

    if (body.client_email.trim().toLowerCase() !== clientEmail.toLowerCase()) {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const scheduled = parseISO(body.scheduled_at);
    if (!isValid(scheduled)) {
      return fail("BAD_REQUEST", "Invalid viewing date/time.", 400);
    }
    const skewMs = 60_000;
    if (scheduled.getTime() <= Date.now() - skewMs) {
      return fail(
        "BAD_REQUEST",
        "Requested viewing time must be in the future. Please refresh the page and pick another time.",
        400,
      );
    }

    const agentUserId = body.agent_user_id;
    const propertyId = body.property_id;
    if (propertyId) {
      const { data: propCheck, error: propCheckErr } = await admin
        .from("properties")
        .select("id, deleted_at, availability_state, is_demo")
        .eq("id", propertyId)
        .maybeSingle();
      if (propCheckErr) {
        return fail("DATABASE_ERROR", propCheckErr.message, 500);
      }
      if (!propCheck) {
        return fail("BAD_REQUEST", "Property not found", 404);
      }
      if ((propCheck as { is_demo?: boolean | null }).is_demo === true) {
        return fail("BAD_REQUEST", "Property not found", 404);
      }
      if (
        !propertyAcceptsViewingRequests(
          propCheck as { deleted_at?: string | null; availability_state?: string | null },
        )
      ) {
        return NextResponse.json(
          { error: "This property is no longer accepting viewing requests" },
          { status: 400 },
        );
      }
    }
    const notesTrimmed = body.notes?.trim() ?? "";
    const notes = notesTrimmed.length > 0 ? notesTrimmed : null;

    const { data: agentRow, error: agentLookupErr } = await admin
      .from("agents")
      .select("id")
      .eq("user_id", agentUserId)
      .maybeSingle();

    if (agentLookupErr) {
      console.error("[create-viewing-request] agents lookup failed", agentLookupErr);
      return fail("DATABASE_ERROR", agentLookupErr.message, 500);
    }
    if (!agentRow || !(agentRow as { id?: string }).id) {
      return fail("BAD_REQUEST", "agent not found", 400);
    }

    const { data: vrRow, error: vrErr } = await admin
      .from("viewing_requests")
      .insert({
        agent_user_id: agentUserId,
        property_id: propertyId,
        client_user_id: session.userId,
        client_name: body.client_name.trim(),
        client_email: body.client_email.trim(),
        client_phone: body.client_phone.trim(),
        scheduled_at: body.scheduled_at,
        notes,
        status: body.status,
      })
      .select("id")
      .single();

    if (vrErr) {
      console.error("[create-viewing-request] viewing_requests insert failed", vrErr);
      return fail("DATABASE_ERROR", vrErr.message, 500);
    }

    const viewingRequestId = (vrRow as { id: string }).id;

    let propertyLabel = "General Inquiry";
    if (propertyId) {
      const { data: prop } = await admin
        .from("properties")
        .select("name, location")
        .eq("id", propertyId)
        .maybeSingle();
      const p = prop as { name?: string | null; location?: string | null } | null;
      propertyLabel =
        (p?.name && String(p.name).trim()) ||
        (p?.location && String(p.location).trim()) ||
        "Property";
    }

    const notifyArgs = {
      agentUserId,
      clientName: body.client_name.trim() || clientNameFromProfile,
      propertyLabel,
      clientEmail: body.client_email.trim(),
      clientPhone: body.client_phone,
      sourceLabel: "viewing_request" as const,
      extraEmailHtml: `<p><strong>Phone:</strong> ${esc(body.client_phone.trim())}</p>`,
      smsSuffix: " Viewing request submitted.",
    };

    const existingLeadId = await findActiveDuplicateLeadIdForViewing(
      admin,
      session.userId,
      agentUserId,
      propertyId,
    );

    if (existingLeadId != null) {
      const { data: existingLeadRow } = await admin
        .from("leads")
        .select("pipeline_stage, viewing_request_id")
        .eq("id", existingLeadId)
        .maybeSingle();
      const existingPs = String(
        (existingLeadRow as { pipeline_stage?: string } | null)?.pipeline_stage ?? "",
      ).toLowerCase();
      const nowIso = new Date().toISOString();

      const activeViewing = await findActiveScheduledViewingForLead(admin, existingLeadId);
      if (activeViewing != null) {
        const { error: rsUpd } = await admin
          .from("viewings")
          .update({ reschedule_request_id: viewingRequestId, updated_at: nowIso })
          .eq("id", activeViewing.id);
        if (rsUpd) {
          console.error("[create-viewing-request] viewings reschedule_request_id update failed", rsUpd);
          return fail("DATABASE_ERROR", rsUpd.message, 500);
        }
        const { error: leadSeenErr } = await admin
          .from("leads")
          .update({
            new_viewing_request_seen_at: null,
            archived_by_agent: false,
            archived_by_agent_at: null,
            updated_at: nowIso,
          })
          .eq("id", existingLeadId);
        if (leadSeenErr) {
          console.error("[create-viewing-request] lead update failed (reschedule)", leadSeenErr);
          return fail("DATABASE_ERROR", leadSeenErr.message, 500);
        }
        await notifyAgentViewingRescheduleRequested(admin, {
          agentUserId,
          leadId: existingLeadId,
          propertyId,
          propertyLabel,
          clientName: body.client_name.trim() || clientNameFromProfile,
          currentScheduledAt: activeViewing.scheduled_at,
          requestedScheduledAt: body.scheduled_at,
        });
        return ok({
          reschedule: true,
          lead_id: existingLeadId,
          viewing_request_id: viewingRequestId,
        });
      }

      let oldScheduledAt: string | null = null;
      const prevVrId = String(
        (existingLeadRow as { viewing_request_id?: string | null } | null)?.viewing_request_id ?? "",
      ).trim();
      if (prevVrId) {
        const { data: prevVr } = await admin
          .from("viewing_requests")
          .select("scheduled_at")
          .eq("id", prevVrId)
          .maybeSingle();
        const sa = (prevVr as { scheduled_at?: string | null } | null)?.scheduled_at;
        oldScheduledAt = sa != null && String(sa).trim() ? String(sa).trim() : null;
      }
      const leadUpdate: Record<string, unknown> = {
        viewing_request_id: viewingRequestId,
        new_viewing_request_seen_at: null,
        archived_by_client: false,
        archived_by_agent: false,
        archived_by_agent_at: null,
        archived_at: null,
        archive_reason: null,
        archive_note: null,
        stage_at_archive: null,
        updated_at: nowIso,
      };
      if (existingPs === "lead" || existingPs === "viewing") {
        leadUpdate.pipeline_stage = VIEWING_REQUEST_PIPELINE_STAGE;
      }
      const { error: updErr } = await admin.from("leads").update(leadUpdate).eq("id", existingLeadId);
      if (updErr) {
        console.error("[create-viewing-request] lead update failed", updErr);
        return fail("DATABASE_ERROR", updErr.message, 500);
      }
      await notifyAgentViewingRequestUpdated(admin, {
        agentUserId,
        leadId: existingLeadId,
        propertyId,
        newScheduledAt: body.scheduled_at,
        propertyLabel,
        clientName: body.client_name.trim() || clientNameFromProfile,
        oldScheduledAt,
        isUpdate: true,
      });
      return ok({
        updated: true,
        viewing_request_id: viewingRequestId,
        lead_id: existingLeadId,
      });
    }

    const leadsInsertPayload = {
      name: body.client_name.trim() || clientNameFromProfile,
      email: body.client_email.trim(),
      phone: body.client_phone.trim() || clientPhoneFromProfile,
      property_interest: propertyLabel,
      message: "Viewing request submitted.",
      agent_id: agentUserId,
      client_id: session.userId,
      source: "viewing_request",
      stage: VIEWING_REQUEST_LEAD_STAGE,
      pipeline_stage: VIEWING_REQUEST_PIPELINE_STAGE,
      property_id: propertyId,
      viewing_request_id: viewingRequestId,
    };

    console.log("[create-viewing-request] before leads insert: agentUserId from body", agentUserId);
    console.log("[create-viewing-request] before leads insert: agents lookup", {
      data: agentRow,
      error: agentLookupErr,
      id: (agentRow as { id?: string } | null)?.id ?? null,
    });
    console.log("[create-viewing-request] before leads insert: leads insert payload", leadsInsertPayload);

    console.log("[debug] agent_id being inserted:", leadsInsertPayload.agent_id);

    const { data: inserted, error: insErr } = await admin
      .from("leads")
      .insert(leadsInsertPayload)
      .select("id")
      .maybeSingle();

    if (insErr) {
      console.error("[create-viewing-request] leads insert failed", {
        message: insErr.message,
        code: insErr.code,
        details: insErr.details,
      });
      if (isLeadsClientAgentPropertyDedupeViolation(insErr)) {
        const raceLeadId = await resolveActiveDuplicateLeadIdAfterDedupeInsert(
          admin,
          session.userId,
          agentUserId,
          propertyId,
        );
        if (raceLeadId != null) {
          const { data: raceLeadRow } = await admin
            .from("leads")
            .select("pipeline_stage, viewing_request_id")
            .eq("id", raceLeadId)
            .maybeSingle();
          const racePs = String(
            (raceLeadRow as { pipeline_stage?: string } | null)?.pipeline_stage ?? "",
          ).toLowerCase();
          const nowIsoRace = new Date().toISOString();

          const raceActiveViewing = await findActiveScheduledViewingForLead(admin, raceLeadId);
          if (raceActiveViewing != null) {
            const { error: raceRs } = await admin
              .from("viewings")
              .update({ reschedule_request_id: viewingRequestId, updated_at: nowIsoRace })
              .eq("id", raceActiveViewing.id);
            if (raceRs) {
              console.error("[create-viewing-request] race viewings reschedule update failed", raceRs);
              return fail("DATABASE_ERROR", raceRs.message, 500);
            }
            const { error: raceLeadSeen } = await admin
              .from("leads")
              .update({
                new_viewing_request_seen_at: null,
                archived_by_agent: false,
                archived_by_agent_at: null,
                updated_at: nowIsoRace,
              })
              .eq("id", raceLeadId);
            if (raceLeadSeen) {
              console.error("[create-viewing-request] race lead update failed (reschedule)", raceLeadSeen);
              return fail("DATABASE_ERROR", raceLeadSeen.message, 500);
            }
            await notifyAgentViewingRescheduleRequested(admin, {
              agentUserId,
              leadId: raceLeadId,
              propertyId,
              propertyLabel,
              clientName: body.client_name.trim() || clientNameFromProfile,
              currentScheduledAt: raceActiveViewing.scheduled_at,
              requestedScheduledAt: body.scheduled_at,
            });
            return ok({
              reschedule: true,
              lead_id: raceLeadId,
              viewing_request_id: viewingRequestId,
            });
          }

          let raceOldScheduledAt: string | null = null;
          const racePrevVrId = String(
            (raceLeadRow as { viewing_request_id?: string | null } | null)?.viewing_request_id ?? "",
          ).trim();
          if (racePrevVrId) {
            const { data: racePrevVr } = await admin
              .from("viewing_requests")
              .select("scheduled_at")
              .eq("id", racePrevVrId)
              .maybeSingle();
            const rsa = (racePrevVr as { scheduled_at?: string | null } | null)?.scheduled_at;
            raceOldScheduledAt = rsa != null && String(rsa).trim() ? String(rsa).trim() : null;
          }
          const racePatch: Record<string, unknown> = {
            viewing_request_id: viewingRequestId,
            new_viewing_request_seen_at: null,
            archived_by_client: false,
            archived_by_agent: false,
            archived_by_agent_at: null,
            archived_at: null,
            archive_reason: null,
            archive_note: null,
            stage_at_archive: null,
            updated_at: nowIsoRace,
          };
          if (racePs === "lead" || racePs === "viewing") {
            racePatch.pipeline_stage = VIEWING_REQUEST_PIPELINE_STAGE;
          }
          const { error: raceUpd } = await admin.from("leads").update(racePatch).eq("id", raceLeadId);
          if (raceUpd) {
            console.error("[create-viewing-request] race update failed", raceUpd);
          }
          await notifyAgentViewingRequestUpdated(admin, {
            agentUserId,
            leadId: raceLeadId,
            propertyId,
            newScheduledAt: body.scheduled_at,
            propertyLabel,
            clientName: body.client_name.trim() || clientNameFromProfile,
            oldScheduledAt: raceOldScheduledAt,
            isUpdate: true,
          });
          return ok({
            updated: true,
            viewing_request_id: viewingRequestId,
            lead_id: raceLeadId,
          });
        }
        console.warn(
          "[create-viewing-request] duplicate on leads_client_agent_property_dedupe_idx but existing row not found",
        );
        return ok({ viewing_request_id: viewingRequestId, lead_id: null });
      }
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    const leadId = inserted?.id;
    if (leadId === undefined || leadId === null) {
      console.warn("[create-viewing-request] lead insert returned no id");
      const fallbackLeadId = await findActiveDuplicateLeadIdForViewing(
        admin,
        session.userId,
        agentUserId,
        propertyId,
      );
      await notifyAgentNewLead(admin, {
        ...notifyArgs,
        leadId: fallbackLeadId ?? 0,
      });
      return ok({
        viewing_request_id: viewingRequestId,
        lead_id: fallbackLeadId ?? null,
      });
    }

    const leadIdNum = Number(leadId);
    await notifyAgentNewLead(admin, {
      ...notifyArgs,
      leadId: leadIdNum,
    });

    return ok({ viewing_request_id: viewingRequestId, lead_id: leadIdNum });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
