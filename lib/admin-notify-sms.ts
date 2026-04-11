import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminSms } from "@/lib/twilio-sms";

const RECENT_MS = 5 * 60 * 1000;

/**
 * After email/OAuth callback: notify only for very new sessions (avoids spam on repeat logins).
 * Sends SMS + in-app notifications to all admins for any role.
 */
export async function notifyAdminNewClientFromSession(session: Session): Promise<void> {
  try {
    const u = session.user;
    const now = Date.now();
    const createdMs = new Date(u.created_at).getTime();
    const confirmedMs = u.email_confirmed_at ? new Date(u.email_confirmed_at).getTime() : 0;
    const recentUser =
      now - createdMs < RECENT_MS || (confirmedMs > 0 && now - confirmedMs < RECENT_MS);
    if (!recentUser) return;
    await notifyAdminSignupFromUser(u);
  } catch (e) {
    console.error("[admin-notify-sms] signup from session", e);
  }
}

/**
 * SMS + notifications for new signups (all roles). Used after auth callback and POST notify.
 */
export async function notifyAdminSignupFromUser(user: User): Promise<void> {
  try {
    const sb = createSupabaseAdmin();
    const { data: p } = await sb
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (p?.role ?? "client") as string;
    const email = (p?.email?.trim() || user.email || "").trim() || "—";
    const fullName = (
      p?.full_name?.trim() ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
      user.email ||
      "User"
    ).trim();

    const msg = `New ${role} signed up on BahayGo: ${fullName} (${email})`;

    await sendAdminSms(msg);

    const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin");
    if (!admins?.length) return;

    for (const admin of admins) {
      const { error } = await sb.from("notifications").insert({
        user_id: admin.id as string,
        type: "signup",
        title: "New signup",
        body: msg,
        metadata: {
          profile_id: user.id,
          role,
          email,
        },
      });
      if (error) {
        console.error("[admin-notify-sms] notification insert", error.message);
      }
    }
  } catch (e) {
    console.error("[admin-notify-sms] signup", e);
  }
}

/** @deprecated use notifyAdminSignupFromUser */
export async function notifyAdminNewClientFromUser(user: User): Promise<void> {
  await notifyAdminSignupFromUser(user);
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
