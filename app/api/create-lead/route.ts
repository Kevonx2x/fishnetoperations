import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

const contactSchema = z.object({
  source: z.literal("contact_button"),
  agentUserId: z.string().uuid(),
  propertyId: z.string().uuid().nullable().optional(),
  propertyTitle: z.string().max(500).optional(),
  channel: z.enum(["email", "sms", "whatsapp", "viber", "copy_phone"]),
});

const viewingSchema = z.object({
  source: z.literal("viewing_request"),
  viewingRequestId: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion("source", [contactSchema, viewingSchema]);

/** New leads always enter the pipeline as `new` (not `viewing`). */
const NEW_LEAD_STAGE = "new" as const;

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

function formatSlot(iso: string): { date: string; time: string; combined: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    combined: d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
  };
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
      const viewingRequestId = parsed.data.viewingRequestId;
      console.log("[create-lead] viewing_request: loading row", { viewingRequestId });

      const { data: vr, error: vrErr } = await admin
        .from("viewing_requests")
        .select(
          "id, client_name, client_email, client_phone, scheduled_at, notes, agent_user_id, property_id, client_user_id",
        )
        .eq("id", viewingRequestId)
        .maybeSingle();

      if (vrErr) {
        console.error("[create-lead] viewing_request: failed to load viewing_requests row", vrErr);
        return fail("NOT_FOUND", "Viewing request not found", 404);
      }
      if (!vr) {
        console.warn("[create-lead] viewing_request: no row returned for id", viewingRequestId);
        return fail("NOT_FOUND", "Viewing request not found", 404);
      }

      console.log("[create-lead] viewing_request: row loaded", {
        id: (vr as { id: string }).id,
        agent_user_id: (vr as { agent_user_id: string }).agent_user_id,
        property_id: (vr as { property_id: string | null }).property_id,
      });

      const vrRow = vr as {
        client_email: string;
        client_user_id: string | null;
        agent_user_id: string;
        property_id: string | null;
        scheduled_at: string;
        notes: string | null;
        client_name: string;
        client_phone: string | null;
      };

      const emailMatch =
        vrRow.client_email.trim().toLowerCase() === clientEmail.toLowerCase() ||
        (vrRow.client_user_id && vrRow.client_user_id === session.userId);
      if (!emailMatch) {
        console.warn("[create-lead] viewing_request: session email does not match viewing row", {
          sessionEmail: clientEmail,
          vrClientEmail: vrRow.client_email,
          vrClientUserId: vrRow.client_user_id,
          sessionUserId: session.userId,
        });
        return fail("FORBIDDEN", "Not allowed", 403);
      }

      const agentUserId = vrRow.agent_user_id;
      const propertyId = vrRow.property_id;

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

      const slot = formatSlot(vrRow.scheduled_at);
      const messageParts = [
        `Viewing request for ${slot.combined}`,
        vrRow.notes ? `Notes: ${vrRow.notes}` : null,
      ].filter(Boolean);

      const notifyArgs = {
        agentUserId,
        clientName: vrRow.client_name.trim() || clientName,
        propertyLabel,
        clientEmail: vrRow.client_email.trim(),
        clientPhone: vrRow.client_phone,
        sourceLabel: "viewing_request" as const,
        extraEmailHtml: `
          <p><strong>Preferred date:</strong> ${esc(slot.date)}</p>
          <p><strong>Preferred time:</strong> ${esc(slot.time)}</p>
          ${vrRow.notes ? `<p style="white-space:pre-wrap"><strong>Message:</strong> ${esc(vrRow.notes)}</p>` : ""}
        `,
        smsSuffix: ` Viewing: ${slot.combined}.`,
      };

      const { data: inserted, error: insErr } = await admin
        .from("leads")
        .insert({
          name: vrRow.client_name.trim() || clientName,
          email: vrRow.client_email.trim(),
          phone: vrRow.client_phone?.trim() || clientPhone,
          property_interest: propertyLabel,
          message: messageParts.join("\n"),
          agent_id: agentUserId,
          client_id: session.userId,
          source: "viewing_request",
          stage: NEW_LEAD_STAGE,
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
          const existingLeadId = await findExistingLeadIdForViewingDedupe(
            admin,
            session.userId,
            agentUserId,
            propertyId,
          );
          const leadIdForNotify = existingLeadId ?? 0;
          console.log("[create-lead] viewing_request: duplicate lead — still notifying agent", {
            agent_user_id_to_notify: agentUserId,
            leadIdForNotify,
            viewingRequestId,
          });
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
        const existingLeadId = await findExistingLeadIdForViewingDedupe(
          admin,
          session.userId,
          agentUserId,
          propertyId,
        );
        const leadIdForNotify = existingLeadId ?? 0;
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
