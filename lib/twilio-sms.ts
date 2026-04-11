import twilio from "twilio";

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (raw.trim().startsWith("+")) {
    return `+${d}`;
  }
  if (d.startsWith("63") && d.length >= 11) {
    return `+${d}`;
  }
  if (d.startsWith("0") && d.length >= 10) {
    return `+63${d.slice(1)}`;
  }
  if (d.length === 10) {
    return `+63${d}`;
  }
  return `+${d}`;
}

export async function sendSmsTo(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  const client = getTwilioClient();
  if (!client || !from) {
    return { ok: false, error: "Twilio not configured" };
  }
  try {
    await client.messages.create({ from, to, body: body.slice(0, 1600) });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[twilio-sms]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * SMS to TWILIO_ADMIN_PHONE (admin alerts). Uses the same Twilio client as sendSmsTo.
 * Does not throw; logs on failure so callers never block main flows.
 */
export async function sendAdminSms(body: string): Promise<void> {
  const to =
    process.env.ADMIN_PHONE_NUMBER?.trim() || process.env.TWILIO_ADMIN_PHONE?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER;
  const client = getTwilioClient();
  if (!to || !from || !client) {
    console.warn(
      "[twilio-sms] admin SMS skipped: missing ADMIN_PHONE_NUMBER / TWILIO_ADMIN_PHONE or Twilio config",
    );
    return;
  }
  try {
    await client.messages.create({
      body: body.slice(0, 1600),
      from,
      to,
    });
  } catch (e) {
    console.error("[twilio-sms] admin SMS failed:", e instanceof Error ? e.message : e);
  }
}
