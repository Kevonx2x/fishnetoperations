import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";

const contactSchema = z.object({
  source: z.literal("contact_button"),
  agentUserId: z.string().uuid(),
  propertyId: z.string().uuid().nullable().optional(),
  propertyTitle: z.string().max(500).optional(),
  channel: z.enum(["email", "sms", "whatsapp", "viber", "copy_phone"]),
});

const viewingSchema = z.object({
  source: z.literal("viewing_request"),
  agent_user_id: z.string().uuid(),
  property_id: z.string().uuid().nullable(),
  client_name: z.string().min(1).max(500),
  client_email: z.string().email(),
  client_phone: z.string().min(1).max(200),
});

const bodySchema = z.discriminatedUnion("source", [contactSchema, viewingSchema]);

/** New leads from contact flow enter as `new`. Viewing-request leads start at pipeline Lead; agent moves to Viewing manually. */
const NEW_LEAD_STAGE = "new" as const;
const VIEWING_PIPELINE_STAGE = "Lead" as const;
const VIEWING_REQUEST_LEAD_STAGE = "active" as const;

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
  agentUserId: string,
  propertyId: string | null,
): Promise<number | null> {
  let q = admin.from("leads").select("id").eq("client_id", clientId).eq("agent_id", agentUserId);
  if (propertyId) {
    q = q.eq("property_id", propertyId);
  } else {
    q = q.is("property_id", null);
  }
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("[create-lead] viewing_request: could not resolve existing lead id for duplicate", error);
    return null;
  }
  const id = (data as { id?: number } | null)?.id;
  return id != null ? Number(id) : null;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }

    let admin;
    try {
      admin = createSupabaseAdmin();
    } catch {
      return fail("SERVER_CONFIG", "Server is not configured for lead capture.", 503);
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", session.userId)
      .maybeSingle();

    const clientName =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() || "Client";
    const clientEmail =
      (profile as { email?: string | null } | null)?.email?.trim() ||
      session.email?.trim() ||
      "";
    const clientPhone = (profile as { phone?: string | null } | null)?.phone?.trim() || null;

    if (!clientEmail) {
      return fail("BAD_REQUEST", "Profile or session email required to create a lead.", 400);
    }

    if (parsed.data.source === "viewing_request") {
      const vr = parsed.data;
      if (vr.client_email.trim().toLowerCase() !== clientEmail.toLowerCase()) {
        console.warn("[create-lead] viewing_request: session email does not match body", {
          sessionEmail: clientEmail,
          bodyEmail: vr.client_email,
          sessionUserId: session.userId,
        });
        return fail("FORBIDDEN", "Not allowed", 403);
      }

      const agentUserId = vr.agent_user_id;
      const propertyId = vr.property_id;

      let propertyLabel = "General Inquiry";
      if (propertyId) {
        const { data: prop } = await admin
          .from("properties")
          .select("name, location, deleted_at")
          .eq("id", propertyId)
          .maybeSingle();
        if (!prop) {
          return fail("BAD_REQUEST", "Property not found", 404);
        }
        if (isPropertyListingRemoved(prop as { deleted_at?: string | null })) {
          return fail("BAD_REQUEST", "This listing is no longer available.", 400);
        }
        const p = prop as { name?: string | null; location?: string | null };
        propertyLabel =
          (p.name && String(p.name).trim()) ||
          (p.location && String(p.location).trim()) ||
          "Property";
      }

      const notifyArgs = {
        agentUserId,
        clientName: vr.client_name.trim() || clientName,
        propertyLabel,
        clientEmail: vr.client_email.trim(),
        clientPhone: vr.client_phone,
        sourceLabel: "viewing_request" as const,
        extraEmailHtml: `<p><strong>Phone:</strong> ${esc(vr.client_phone.trim())}</p>`,
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
            archived_by_client: false,
            archived_at: null,
            archive_reason: null,
            archive_note: null,
            stage_at_archive: null,
          })
          .eq("id", existingLeadId);
        if (updErr) {
          console.error("[create-lead] viewing_request: lead update failed", updErr);
          return fail("DATABASE_ERROR", updErr.message, 500);
        }
        await notifyAgentNewLead(admin, {
          ...notifyArgs,
          leadId: existingLeadId,
        });
        return ok({ created: false, updated: true, duplicate: true, leadId: existingLeadId });
      }

      const { data: inserted, error: insErr } = await admin
        .from("leads")
        .insert({
          name: vr.client_name.trim() || clientName,
          email: vr.client_email.trim(),
          phone: vr.client_phone.trim() || clientPhone,
          property_interest: propertyLabel,
          message: "Viewing request submitted.",
          agent_id: agentUserId,
          client_id: session.userId,
          source: "viewing_request",
          stage: VIEWING_REQUEST_LEAD_STAGE,
          pipeline_stage: VIEWING_PIPELINE_STAGE,
          property_id: propertyId,
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("[create-lead] viewing_request: leads insert failed", {
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
                archived_by_client: false,
                archived_at: null,
                archive_reason: null,
                archive_note: null,
                stage_at_archive: null,
              })
              .eq("id", raceLeadId);
            if (raceUpd) {
              console.error("[create-lead] viewing_request: race update failed", raceUpd);
            }
            await notifyAgentNewLead(admin, {
              ...notifyArgs,
              leadId: raceLeadId,
            });
            return ok({ created: false, updated: true, duplicate: true, leadId: raceLeadId });
          }
          const leadIdForNotify = 0;
          await notifyAgentNewLead(admin, {
            ...notifyArgs,
            leadId: leadIdForNotify,
          });
          return ok({ created: false, duplicate: true });
        }
        return fail("DATABASE_ERROR", insErr.message, 500);
      }

      const leadId = inserted?.id;
      if (leadId === undefined || leadId === null) {
        console.warn("[create-lead] viewing_request: lead insert returned no id (treating as duplicate)");
        const fallbackLeadId = await findExistingLeadIdForViewingDedupe(
          admin,
          session.userId,
          agentUserId,
          propertyId,
        );
        const leadIdForNotify = fallbackLeadId ?? 0;
        await notifyAgentNewLead(admin, {
          ...notifyArgs,
          leadId: leadIdForNotify,
        });
        return ok({ created: false, duplicate: true });
      }

      console.log("[create-lead] viewing_request: lead created, notifying agent", {
        agent_user_id_to_notify: agentUserId,
        leadId,
      });

      await notifyAgentNewLead(admin, {
        ...notifyArgs,
        leadId: Number(leadId),
      });

      return ok({ created: true, leadId });
    }

    const { agentUserId, propertyId, propertyTitle, channel } = parsed.data;
    if (propertyId) {
      const { data: propContact, error: pcErr } = await admin
        .from("properties")
        .select("id, deleted_at")
        .eq("id", propertyId)
        .maybeSingle();
      if (pcErr) {
        return fail("DATABASE_ERROR", pcErr.message, 500);
      }
      if (!propContact) {
        return fail("BAD_REQUEST", "Property not found", 404);
      }
      if (isPropertyListingRemoved(propContact as { deleted_at?: string | null })) {
        return fail("BAD_REQUEST", "This listing is no longer available.", 400);
      }
    }
    const propertyInterest = propertyTitle?.trim() || "General Inquiry";
    const message = `Contact channel: ${channel}`;

    const { data: inserted, error: insErr } = await admin
      .from("leads")
      .insert({
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        property_interest: propertyInterest,
        message,
        agent_id: agentUserId,
        client_id: session.userId,
        source: "contact_button",
        stage: NEW_LEAD_STAGE,
        property_id: propertyId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") {
        return ok({ created: false, duplicate: true });
      }
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    const contactLeadId = inserted?.id;
    if (contactLeadId === undefined || contactLeadId === null) {
      return ok({ created: false, duplicate: true });
    }

    const { error: stageErr } = await admin
      .from("leads")
      .update({ stage: NEW_LEAD_STAGE })
      .eq("id", contactLeadId);
    if (stageErr) {
      console.error("[create-lead] contact_button stage ensure", stageErr);
    }

    await notifyAgentNewLead(admin, {
      agentUserId,
      leadId: Number(contactLeadId),
      clientName,
      propertyLabel: propertyInterest,
      clientEmail,
      clientPhone,
      sourceLabel: "contact_button",
      channel,
      extraEmailHtml: `<p><strong>Channel:</strong> ${esc(channel)}</p>`,
      smsSuffix: "",
    });

    return ok({ created: true, leadId: contactLeadId });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

async function notifyAgentNewLead(
  /** Service-role client only — bypasses RLS on `notifications` (requires SUPABASE_SERVICE_ROLE_KEY). */
  admin: ReturnType<typeof createSupabaseAdmin>,
  args: {
    agentUserId: string;
    leadId: number;
    clientName: string;
    propertyLabel: string;
    clientEmail: string;
    clientPhone: string | null | undefined;
    sourceLabel: string;
    channel?: string;
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
    channel,
    extraEmailHtml,
    smsSuffix,
  } = args;

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("[create-lead] notifyAgentNewLead: using service-role admin client for notifications insert", {
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
        channel: channel ?? null,
      },
    })
    .select("id")
    .single();

  if (nErr) {
    console.error("[create-lead] notification insert failed", {
      message: nErr.message,
      code: nErr.code,
      details: nErr.details,
      hint: nErr.hint,
    });
  } else {
    console.log("[create-lead] notification insert ok", {
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
          ${channel ? `<p style="margin:0 0 8px"><strong>Channel:</strong> ${esc(channel)}</p>` : ""}
          ${extraEmailHtml}
          <p style="margin-top:20px;font-size:12px;color:#666">Lead ID: ${leadId}</p>
        </div>
      `,
    });
  }
}
