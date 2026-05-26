import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { escHtml, publicAppBaseUrl } from "@/lib/dormspace-email";
import { RESEND_FROM } from "@/lib/resend-from";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type DormspaceInquiryPayload = {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
};

export async function handleDormspaceInquiry(
  dormspace_id: string,
  payload: DormspaceInquiryPayload,
): Promise<NextResponse> {
  const { name, email, phone, message } = payload;
  const session = await getSessionProfile();
  const admin = createSupabaseAdmin();

  const { data: listing, error: listErr } = await admin
    .from("dormspaces")
    .select("id, title, status, landlord_email, landlord_name")
    .eq("id", dormspace_id)
    .maybeSingle();

  if (listErr) return fail("SERVER_ERROR", "Could not load listing", 500);
  if (!listing || (listing.status !== "approved" && listing.status !== "pending")) {
    return fail("NOT_FOUND", "Dormspace not found", 404);
  }

  const phoneTrimmed = phone?.trim() || null;

  const { error: insertErr } = await admin.from("dormspace_inquiries").insert({
    dormspace_id,
    sender_user_id: session?.userId ?? null,
    name: name.trim(),
    email: email.trim(),
    phone: phoneTrimmed,
    message: message.trim(),
    status: "new",
  });

  if (insertErr) {
    console.error("[dormspace-inquiry] insert failed", insertErr);
    return fail("SERVER_ERROR", "Could not save inquiry", 500);
  }

  const landlordEmail =
    typeof listing.landlord_email === "string" ? listing.landlord_email.trim() : "";
  const emailValid = landlordEmail.length > 0 && z.string().email().safeParse(landlordEmail).success;

  if (emailValid && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const dashboardLink = `${publicAppBaseUrl()}/dormspaces/dashboard/inquiries`;
      const listingTitle = listing.title ?? "your listing";
      await resend.emails.send({
        from: RESEND_FROM,
        to: landlordEmail,
        subject: `New dormspace inquiry — ${name.trim()}`,
        html: `
          <p>You have a new inquiry for <strong>${escHtml(listingTitle)}</strong> on BahayGo Dormspaces.</p>
          <p><strong>From:</strong> ${escHtml(name.trim())}<br/>
          <strong>Email:</strong> ${escHtml(email.trim())}<br/>
          ${phoneTrimmed ? `<strong>Phone:</strong> ${escHtml(phoneTrimmed)}<br/>` : ""}
          </p>
          <p><strong>Message:</strong></p>
          <p>${escHtml(message.trim()).replace(/\n/g, "<br/>")}</p>
          <p><a href="${escHtml(dashboardLink)}">Open your Dormspace dashboard</a> to manage inquiries.</p>
        `,
      });
    } catch (e) {
      console.warn("[dormspace-inquiry] landlord email failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
