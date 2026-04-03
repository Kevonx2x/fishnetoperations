import { NextRequest } from "next/server";
import { Resend } from "resend";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

    const propertyId = (row as { property_id: string }).property_id;
    const { data: prop } = await sb
      .from("properties")
      .select("location, name")
      .eq("id", propertyId)
      .maybeSingle();
    const propLabel =
      (prop as { name?: string | null; location?: string } | null)?.name?.trim() ||
      (prop as { location?: string } | null)?.location ||
      "your selected property";

    const { data: agentRow } = await sb
      .from("agents")
      .select("name, phone")
      .eq("user_id", session.userId)
      .maybeSingle();
    const agentName = (agentRow as { name?: string } | null)?.name ?? "Your agent";
    const agentPhone = (agentRow as { phone?: string | null } | null)?.phone ?? "";

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

    if (action === "decline") {
      const { error: updErr } = await sb
        .from("viewing_requests")
        .update({
          status: "declined",
          updated_at: new Date().toISOString(),
        })
        .eq("id", viewingId);
      if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

      const clientSms = normalizePhoneE164(clientPhone);
      if (clientSms) {
        await sendSmsTo(
          clientSms,
          `Your viewing request for ${propLabel} has been declined. Please contact us to reschedule.`,
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

    const when = new Date(scheduledAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const agentSmsTo = normalizePhoneE164(agentPhone);
    if (agentSmsTo) {
      await sendSmsTo(
        agentSmsTo,
        `Viewing confirmed: ${clientName} at ${propLabel} on ${when.split(",")[0] ?? when} at ${when}.`,
      );
    }

    const clientSmsTo = normalizePhoneE164(clientPhone);
    if (clientSmsTo) {
      await sendSmsTo(
        clientSmsTo,
        `Your viewing at ${propLabel} is confirmed for ${when}. Agent: ${agentName}${agentPhone ? ` ${agentPhone}` : ""}`,
      );
    }

    if (resend && process.env.RESEND_API_KEY) {
      const { error: emailErr } = await resend.emails.send({
        from: process.env.RESEND_FROM ?? "Fishnet Residences <onboarding@resend.dev>",
        to: clientEmail,
        subject: `Viewing confirmed: ${propLabel}`,
        html: `
          <p>Hi ${escapeHtml(clientName)},</p>
          <p>Your property viewing has been <strong>confirmed</strong>.</p>
          <p><strong>Property:</strong> ${escapeHtml(propLabel)}</p>
          <p><strong>When:</strong> ${escapeHtml(when)}</p>
          <p><strong>Agent:</strong> ${escapeHtml(agentName)}</p>
          <p>We look forward to seeing you.</p>
          <p>— Fishnet Residences</p>
        `,
      });
      if (emailErr) {
        console.error("Resend:", emailErr);
        return fail("EMAIL_ERROR", emailErr.message, 502);
      }
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
