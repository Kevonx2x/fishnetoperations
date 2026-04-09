import { NextRequest } from "next/server";
import { Resend } from "resend";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";
import { RESEND_FROM } from "@/lib/resend-from";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function resolveClientUserId(
  row: { client_user_id?: string | null; client_email: string },
): Promise<string | null> {
  if (row.client_user_id) return row.client_user_id;
  try {
    const admin = createSupabaseAdmin();
    const email = row.client_email.trim().toLowerCase();
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
    if (session.role !== "agent" && session.role !== "admin") {
      return fail("FORBIDDEN", "Agents only", 403);
    }

    const body = (await request.json()) as {
      viewingId?: string;
      action?: "confirm" | "decline";
      scheduledAt?: string;
      reminderMinutes?: number;
      clientPhone?: string | null;
    };

    const viewingId = body.viewingId;
    if (!viewingId || typeof viewingId !== "string") {
      return fail("BAD_REQUEST", "viewingId required", 400);
    }
    const action = body.action;
    if (action !== "confirm" && action !== "decline") {
      return fail("BAD_REQUEST", "action must be confirm or decline", 400);
    }

    const sb = await createSupabaseServerClient();
    const { data: row, error: fetchErr } = await sb
      .from("viewing_requests")
      .select("*")
      .eq("id", viewingId)
      .maybeSingle();

    if (fetchErr) return fail("DATABASE_ERROR", fetchErr.message, 500);
    if (!row) return fail("NOT_FOUND", "Viewing not found", 404);

    const agentUserId = (row as { agent_user_id: string }).agent_user_id;
    if (agentUserId !== session.userId && session.role !== "admin") {
      return fail("FORBIDDEN", "Not your viewing", 403);
    }

    const propertyId = (row as { property_id: string | null }).property_id;
    const { data: prop } = propertyId
      ? await sb.from("properties").select("location, name").eq("id", propertyId).maybeSingle()
      : { data: null };
    const propLabel =
      (prop as { name?: string | null; location?: string } | null)?.name?.trim() ||
      (prop as { location?: string } | null)?.location?.trim() ||
      (propertyId ? "Property" : "General viewing");

    const propertyAddressForNotification = propertyAddressLabel(
      prop as { name?: string | null; location?: string | null } | null,
    );

    const { data: listingAgent } = await sb
      .from("agents")
      .select("name, phone")
      .eq("user_id", agentUserId)
      .maybeSingle();
    const agentName = (listingAgent as { name?: string } | null)?.name ?? "Your agent";
    const agentPhone = (listingAgent as { phone?: string | null } | null)?.phone ?? "";

    const clientName = (row as { client_name: string }).client_name;
    const clientEmail = (row as { client_email: string }).client_email;
    let scheduledAt = (row as { scheduled_at: string }).scheduled_at;
    if (body.scheduledAt && typeof body.scheduledAt === "string") {
      scheduledAt = body.scheduledAt;
    }

    const reminderMinutes =
      typeof body.reminderMinutes === "number" && body.reminderMinutes > 0
        ? body.reminderMinutes
        : ((row as { reminder_minutes?: number }).reminder_minutes ?? 60);

    const clientPhone =
      body.clientPhone !== undefined
        ? body.clientPhone
        : (row as { client_phone?: string | null }).client_phone;

    const clientUserId = await resolveClientUserId(
      row as { client_user_id?: string | null; client_email: string },
    );

    let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
    try {
      admin = createSupabaseAdmin();
    } catch {
      admin = null;
    }

    if (action === "decline") {
      const { error: updErr } = await sb
        .from("viewing_requests")
        .update({
          status: "declined",
          updated_at: new Date().toISOString(),
        })
        .eq("id", viewingId);
      if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

      if (admin && clientUserId) {
        await admin.from("notifications").insert({
          user_id: clientUserId,
          type: "viewing_declined",
          title: "Viewing request update",
          body: `Your viewing request for ${propertyAddressForNotification} needs a new time. ${agentName} is unavailable on your requested date.`,
          metadata: { viewing_request_id: viewingId, property_label: propLabel },
        });
      }

      if (resend) {
        const { error: emailErr } = await resend.emails.send({
          from: RESEND_FROM,
          to: clientEmail,
          subject: `Viewing request — ${propLabel}`,
          html: `
            <p>Hi ${escapeHtml(clientName)},</p>
            <p>${escapeHtml(agentName)} is unavailable for your requested viewing time.</p>
            <p><strong>Property:</strong> ${escapeHtml(propLabel)}</p>
            <p>Please choose another date or time in the app.</p>
            <p>— BahayGo</p>
          `,
        });
        if (emailErr) console.error("[viewing-action] decline email", emailErr);
      }

      const clientSms = normalizePhoneE164(clientPhone);
      if (clientSms) {
        await sendSmsTo(
          clientSms,
          `Viewing update: ${agentName} can't make your requested time for ${propLabel}. Request a new time in BahayGo.`,
        );
      }
      return ok({ success: true });
    }

    const { error: updErr } = await sb
      .from("viewing_requests")
      .update({
        status: "confirmed",
        scheduled_at: scheduledAt,
        reminder_minutes: reminderMinutes,
        reminder_sent: false,
        client_phone: clientPhone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewingId);

    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    const d = new Date(scheduledAt);
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    if (admin && clientUserId) {
      await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "viewing_confirmed",
        title: "Viewing confirmed",
        body: `Your viewing has been confirmed! ${agentName} confirmed your visit to ${propLabel} on ${dateStr} at ${timeStr}`,
        metadata: { viewing_request_id: viewingId, property_label: propLabel, scheduled_at: scheduledAt },
      });
    }

    const agentSmsTo = normalizePhoneE164(agentPhone);
    if (agentSmsTo) {
      await sendSmsTo(
        agentSmsTo,
        `Viewing confirmed: ${clientName} at ${propLabel} on ${dateStr} at ${timeStr}.`,
      );
    }

    const clientSmsTo = normalizePhoneE164(clientPhone);
    if (clientSmsTo) {
      await sendSmsTo(
        clientSmsTo,
        `Your viewing at ${propLabel} is confirmed for ${dateStr} at ${timeStr}. Agent: ${agentName}${agentPhone ? ` — ${agentPhone}` : ""}`,
      );
    }

    if (resend) {
      const { error: emailErr } = await resend.emails.send({
        from: RESEND_FROM,
        to: clientEmail,
        subject: `Viewing confirmed: ${propLabel}`,
        html: `
          <p>Hi ${escapeHtml(clientName)},</p>
          <p>Your property viewing has been <strong>confirmed</strong>.</p>
          <p><strong>Property:</strong> ${escapeHtml(propLabel)}</p>
          <p><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
          <p><strong>Time:</strong> ${escapeHtml(timeStr)}</p>
          <p><strong>Agent:</strong> ${escapeHtml(agentName)}${agentPhone ? ` — ${escapeHtml(agentPhone)}` : ""}</p>
          <p>We look forward to seeing you.</p>
          <p>— BahayGo</p>
        `,
      });
      if (emailErr) console.error("[viewing-action] confirm email", emailErr);
    }

    return ok({ success: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
