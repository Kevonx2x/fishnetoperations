import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { fail, fromZodError } from "@/lib/api/response";
import { RESEND_FROM } from "@/lib/resend-from";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  agency_id: z.string().uuid(),
  name: z.string().min(1).max(500),
  email: z.string().email().max(320),
  phone: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(10000),
});

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicAppBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "https://bahaygo.com";
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { agency_id, name, email, phone, message } = parsed.data;
  const session = await getSessionProfile();
  const admin = createSupabaseAdmin();

  const { data: agency, error: agencyErr } = await admin
    .from("agencies")
    .select("id, company_name, email, status, verified")
    .eq("id", agency_id)
    .maybeSingle();

  if (agencyErr) {
    console.error("[agency/inquiry] agency lookup failed", agencyErr);
    return fail("SERVER_ERROR", "Could not load agency", 500);
  }
  if (!agency || agency.status !== "approved" || !agency.verified) {
    return fail("NOT_FOUND", "Agency not found", 404);
  }

  const phoneTrimmed = phone?.trim() || null;

  const { data: inserted, error: insertErr } = await admin
    .from("agency_inquiries")
    .insert({
      agency_id,
      sender_user_id: session?.userId ?? null,
      name: name.trim(),
      email: email.trim(),
      phone: phoneTrimmed,
      message: message.trim(),
      status: "new",
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    console.error("[agency/inquiry] insert failed", insertErr);
    return fail("SERVER_ERROR", "Could not save inquiry", 500);
  }

  const inquiryId = inserted.id as string;
  const agencyEmail = typeof agency.email === "string" ? agency.email.trim() : "";
  const emailValid = agencyEmail.length > 0 && z.string().email().safeParse(agencyEmail).success;

  if (emailValid && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminLink = `${publicAppBaseUrl()}/admin`;
      const company = agency.company_name ?? "your agency";
      await resend.emails.send({
        from: RESEND_FROM,
        to: agencyEmail,
        subject: `New inquiry from BahayGo — ${name.trim()}`,
        html: `
          <p>You have a new inquiry for <strong>${esc(company)}</strong> on BahayGo.</p>
          <p><strong>From:</strong> ${esc(name.trim())}<br/>
          <strong>Email:</strong> ${esc(email.trim())}<br/>
          ${phoneTrimmed ? `<strong>Phone:</strong> ${esc(phoneTrimmed)}<br/>` : ""}
          </p>
          <p><strong>Message:</strong></p>
          <p>${esc(message.trim()).replace(/\n/g, "<br/>")}</p>
          <p><a href="${esc(adminLink)}">Open BahayGo admin</a> to review inquiries.</p>
        `,
      });
    } catch (e) {
      console.warn("[agency/inquiry] Resend notification failed (inquiry saved)", e);
    }
  }

  return NextResponse.json({ ok: true, inquiry_id: inquiryId });
}
