import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminSms } from "@/lib/twilio-sms";

const RECENT_MS = 5 * 60 * 1000;

/** After email/OAuth callback: notify only for very new sessions (avoids spam on repeat logins). */
export async function notifyAdminNewClientFromSession(session: Session): Promise<void> {
  try {
    const u = session.user;
    const now = Date.now();
    const createdMs = new Date(u.created_at).getTime();
    const confirmedMs = u.email_confirmed_at ? new Date(u.email_confirmed_at).getTime() : 0;
    const recentUser =
      now - createdMs < RECENT_MS || (confirmedMs > 0 && now - confirmedMs < RECENT_MS);
    if (!recentUser) return;
    await notifyAdminNewClientFromUser(u);
  } catch (e) {
    console.error("[admin-notify-sms] new client from session", e);
  }
}

/** After signup with immediate session or POST /api/v1/notify/admin-new-client. */
export async function notifyAdminNewClientFromUser(user: User): Promise<void> {
  try {
    const sb = createSupabaseAdmin();
    const { data: p } = await sb
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!p || p.role !== "client") return;

    const email = (p.email?.trim() || user.email || "").trim() || "—";
    const name = (
      p.full_name?.trim() ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
      user.email ||
      "Client"
    ).trim();

    await sendAdminSms(
      `👤 BahayGo: New client joined!\nName: ${name}\nEmail: ${email}\nView: bahaygo.com/admin → Users tab`,
    );
  } catch (e) {
    console.error("[admin-notify-sms] new client", e);
  }
}

export async function notifyAdminNewAgentRegistered(params: {
  name: string;
  email: string;
  license: string;
}): Promise<void> {
  try {
    await sendAdminSms(
      `🏠 BahayGo: New agent registered!\nName: ${params.name}\nEmail: ${params.email}\nLicense: ${params.license}\nCheck admin: bahaygo.com/admin`,
    );
  } catch (e) {
    console.error("[admin-notify-sms] new agent", e);
  }
}

export async function notifyAdminVerificationDocumentsSubmitted(params: {
  name: string;
  email: string;
}): Promise<void> {
  try {
    await sendAdminSms(
      `📋 BahayGo: Agent submitted verification docs!\nName: ${params.name}\nEmail: ${params.email}\nReview: bahaygo.com/admin → Verification tab`,
    );
  } catch (e) {
    console.error("[admin-notify-sms] verification submitted", e);
  }
}
