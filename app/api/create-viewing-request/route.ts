import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

/** Matches pipeline "Lead" column value (lowercase id per `leads_pipeline_stage_check`). */
const VIEWING_PIPELINE_STAGE = "lead" as const;
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

async function findExistingLeadIdForViewingDedupe(
  admin: ReturnType<typeof createSupabaseAdmin>,
  clientId: string,
  agentId: string,
  propertyId: string | null,
): Promise<number | null> {
  let q = admin.from("leads").select("id").eq("client_id", clientId).eq("agent_id", agentId);
  if (propertyId) {
    q = q.eq("property_id", propertyId);
  } else {
    q = q.is("property_id", null);
  }
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("[create-viewing-request] could not resolve existing lead id for duplicate", error);
    return null;
  }
  const id = (data as { id?: number } | null)?.id;
  return id != null ? Number(id) : null;
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

    const agentUserId = body.agent_user_id;
    const propertyId = body.property_id;
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

    const existingLeadId = await findExistingLeadIdForViewingDedupe(
      admin,
      session.userId,
      agentUserId,
      propertyId,
    );

    if (existingLeadId != null) {
      const { error: updErr } = await admin
        .from("leads")
        .update({
          pipeline_stage: VIEWING_PIPELINE_STAGE,
          stage: VIEWING_REQUEST_LEAD_STAGE,
          viewing_request_id: viewingRequestId,
        })
        .eq("id", existingLeadId);
      if (updErr) {
        console.error("[create-viewing-request] lead update failed", updErr);
        return fail("DATABASE_ERROR", updErr.message, 500);
      }
      await notifyAgentNewLead(admin, {
        ...notifyArgs,
        leadId: existingLeadId,
      });
      return ok({ viewing_request_id: viewingRequestId, lead_id: existingLeadId });
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
      pipeline_stage: VIEWING_PIPELINE_STAGE,
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
      if (insErr.code === "23505") {
        const raceLeadId = await findExistingLeadIdForViewingDedupe(
          admin,
          session.userId,
          agentUserId,
          propertyId,
        );
        if (raceLeadId != null) {
          const { error: raceUpd } = await admin
            .from("leads")
            .update({
              pipeline_stage: VIEWING_PIPELINE_STAGE,
              stage: VIEWING_REQUEST_LEAD_STAGE,
              viewing_request_id: viewingRequestId,
            })
            .eq("id", raceLeadId);
          if (raceUpd) {
            console.error("[create-viewing-request] race update failed", raceUpd);
          }
          await notifyAgentNewLead(admin, {
            ...notifyArgs,
            leadId: raceLeadId,
          });
          return ok({ viewing_request_id: viewingRequestId, lead_id: raceLeadId });
        }
        await notifyAgentNewLead(admin, {
          ...notifyArgs,
          leadId: 0,
        });
        return ok({ viewing_request_id: viewingRequestId, lead_id: null });
      }
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    const leadId = inserted?.id;
    if (leadId === undefined || leadId === null) {
      console.warn("[create-viewing-request] lead insert returned no id");
      const fallbackLeadId = await findExistingLeadIdForViewingDedupe(
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
