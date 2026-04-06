import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

const bodySchema = z.object({
  viewingRequestId: z.string().uuid(),
});

function formatSlotForDisplay(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (!session.email?.trim()) {
      return fail("BAD_REQUEST", "Account email required", 400);
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const supabase = await createSupabaseServerClient();
    const { data: vr, error: vrErr } = await supabase
      .from("viewing_requests")
      .select("id, client_name, client_email, client_phone, scheduled_at, notes, agent_user_id, property_id")
      .eq("id", parsed.data.viewingRequestId)
      .maybeSingle();

    if (vrErr || !vr) {
      return fail("NOT_FOUND", "Viewing request not found", 404);
    }

    const clientEmail = String(vr.client_email ?? "").trim().toLowerCase();
    if (clientEmail !== session.email.trim().toLowerCase()) {
      return fail("FORBIDDEN", "Not allowed", 403);
    }

    const { data: property } = await supabase
      .from("properties")
      .select("name, location")
      .eq("id", vr.property_id)
      .maybeSingle();

    const { data: agent } = await supabase
      .from("agents")
      .select("email, phone, name")
      .eq("user_id", vr.agent_user_id)
      .maybeSingle();

    if (!agent) {
      return fail("NOT_FOUND", "Listing agent not found", 404);
    }

    const propertyLabel =
      (property?.name && String(property.name).trim()) ||
      (property?.location && String(property.location).trim()) ||
      "Property";

    const { date: dateStr, time: timeStr } = formatSlotForDisplay(vr.scheduled_at);
    const phoneDisplay = (vr.client_phone && String(vr.client_phone).trim()) || "—";

    const smsBody = `New viewing request for ${propertyLabel} from ${vr.client_name} on ${dateStr} at ${timeStr}. Phone: ${phoneDisplay}`;

    const smsTo = normalizePhoneE164(agent.phone);
    let smsOk = false;
    if (smsTo) {
      const smsRes = await sendSmsTo(smsTo, smsBody);
      smsOk = smsRes.ok;
    }

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    let emailOk = false;
    const agentEmail = agent.email?.trim();
    if (resend && agentEmail) {
      const esc = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const notesBlock = vr.notes
        ? `<p><strong>Message from client:</strong></p><p style="white-space:pre-wrap">${esc(String(vr.notes))}</p>`
        : "<p><em>No additional message.</em></p>";

      const { error: emailErr } = await resend.emails.send({
        from: RESEND_FROM,
        to: agentEmail,
        subject: `New viewing request — ${propertyLabel}`,
        html: `
          <div style="font-family:Georgia,serif;color:#2C2C2C;line-height:1.5;max-width:560px">
            <h1 style="font-size:20px;margin:0 0 12px">New viewing request</h1>
            <p style="margin:0 0 8px"><strong>Property:</strong> ${esc(propertyLabel)}</p>
            <p style="margin:0 0 8px"><strong>Client:</strong> ${esc(String(vr.client_name))}</p>
            <p style="margin:0 0 8px"><strong>Email:</strong> ${esc(String(vr.client_email))}</p>
            <p style="margin:0 0 8px"><strong>Phone:</strong> ${esc(phoneDisplay)}</p>
            <p style="margin:0 0 8px"><strong>Preferred date:</strong> ${esc(dateStr)}</p>
            <p style="margin:0 0 16px"><strong>Preferred time:</strong> ${esc(timeStr)}</p>
            ${notesBlock}
            <p style="margin-top:24px;font-size:12px;color:#666">— BahayGo</p>
          </div>
        `,
      });
      emailOk = !emailErr;
    }

    const attemptedSms = Boolean(smsTo);
    const attemptedEmail = Boolean(resend && agentEmail);
    if (attemptedSms && attemptedEmail && !smsOk && !emailOk) {
      return fail(
        "NOTIFY_FAILED",
        "Could not send SMS or email to the agent. Your request was saved.",
        502,
        { smsOk, emailOk },
      );
    }

    return ok({ sms: smsOk, email: emailOk });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}
