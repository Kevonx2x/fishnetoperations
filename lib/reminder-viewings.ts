import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";
import { RESEND_FROM } from "@/lib/resend-from";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type ViewingRow = {
  id: string;
  agent_user_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  scheduled_at: string;
  reminder_minutes: number;
  property_id: string;
  status: string;
  reminder_sent: boolean;
};

/** Process due viewing reminders (SMS + email to client). Returns count marked sent. */
export async function processDueViewingReminders(): Promise<{ sent: number; errors: string[] }> {
  const sb = createSupabaseAdmin();
  const errors: string[] = [];
  const now = new Date();

  const { data: rows, error } = await sb
    .from("viewing_requests")
    .select(
      "id, agent_user_id, client_name, client_email, client_phone, scheduled_at, reminder_minutes, property_id, status, reminder_sent",
    )
    .eq("status", "confirmed")
    .eq("reminder_sent", false);

  if (error) {
    return { sent: 0, errors: [error.message] };
  }

  const list = (rows ?? []) as ViewingRow[];
  let sent = 0;
  const windowMs = 6 * 60 * 1000;

  for (const v of list) {
    const sched = new Date(v.scheduled_at);
    const remindAt = new Date(sched.getTime() - v.reminder_minutes * 60 * 1000);
    const windowStart = new Date(now.getTime() - windowMs);
    if (remindAt > now || remindAt < windowStart) continue;

    const { data: prop } = await sb
      .from("properties")
      .select("location, name")
      .eq("id", v.property_id)
      .maybeSingle();
    const propLabel =
      (prop as { name?: string | null; location?: string } | null)?.name?.trim() ||
      (prop as { location?: string } | null)?.location ||
      "the property";

    const when = sched.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const clientTo = normalizePhoneE164(v.client_phone);
    if (clientTo) {
      const r = await sendSmsTo(clientTo, `Reminder: Your viewing at ${propLabel} is on ${when}.`);
      if (!r.ok) errors.push(`sms ${v.id}: ${r.error}`);
    }

    if (resend && process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: RESEND_FROM,
          to: v.client_email,
          subject: `Reminder: viewing at ${propLabel}`,
          html: `<p>Hi ${escapeHtml(v.client_name)},</p><p>This is a friendly reminder about your viewing on <strong>${escapeHtml(when)}</strong> at <strong>${escapeHtml(propLabel)}</strong>.</p>`,
        });
      } catch (e) {
        errors.push(`email ${v.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const { error: upErr } = await sb
      .from("viewing_requests")
      .update({ reminder_sent: true, updated_at: new Date().toISOString() })
      .eq("id", v.id);
    if (upErr) errors.push(`update ${v.id}: ${upErr.message}`);
    else sent += 1;
  }

  return { sent, errors };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
