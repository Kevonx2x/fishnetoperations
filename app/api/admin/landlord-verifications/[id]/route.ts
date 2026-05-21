import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { fail, fromZodError } from "@/lib/api/response";
import { signedVerificationUrl } from "@/lib/dormspace-storage";
import { RESEND_FROM } from "@/lib/resend-from";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejection_reason: z.string().max(2000).optional(),
});

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, landlord_id_url, landlord_proof_of_billing_url, landlord_verification_status, landlord_verification_submitted_at, landlord_verification_rejection_reason, created_at, is_landlord",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return fail("SERVER_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Not found", 404);

  const idSigned = await signedVerificationUrl(admin, String(data.landlord_id_url ?? ""));
  const billingSigned = await signedVerificationUrl(
    admin,
    String(data.landlord_proof_of_billing_url ?? ""),
  );

  const { count: listingCount } = await admin
    .from("dormspaces")
    .select("id", { count: "exact", head: true })
    .eq("landlord_user_id", id);

  return NextResponse.json({
    ...data,
    landlord_id_signed_url: idSigned,
    landlord_proof_of_billing_signed_url: billingSigned,
    dormspace_count: listingCount ?? 0,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();
  const { data: existing, error: loadErr } = await admin
    .from("profiles")
    .select("id, full_name, email, landlord_verification_status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", loadErr.message, 500);
  if (!existing) return fail("NOT_FOUND", "Not found", 404);

  const nowIso = new Date().toISOString();
  const email = existing.email?.trim();
  const name = existing.full_name?.trim() || "Landlord";

  if (parsed.data.action === "approve") {
    const { error } = await admin
      .from("profiles")
      .update({
        landlord_verification_status: "approved",
        landlord_verification_approved_at: nowIso,
        landlord_verification_approved_by: session.userId,
        landlord_verification_rejection_reason: null,
      })
      .eq("id", id);

    if (error) return fail("SERVER_ERROR", error.message, 500);

    if (process.env.RESEND_API_KEY && email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: RESEND_FROM,
          to: email,
          subject: "You're a verified landlord on BahayGo Dormspaces",
          html: `<p>Hi ${esc(name)},</p>
            <p>Your landlord verification has been <strong>approved</strong>. The verified badge will show on your listings, and new submissions can go live faster.</p>
            <p>Thank you for listing with BahayGo Dormspaces.</p>`,
        });
      } catch (e) {
        console.warn("[admin/landlord-verifications] approval email failed", e);
      }
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  const reason =
    parsed.data.rejection_reason?.trim() ||
    "We could not verify your documents. Please re-upload a clear ID and proof of billing.";

  const { error } = await admin
    .from("profiles")
    .update({
      landlord_verification_status: "rejected",
      landlord_verification_rejection_reason: reason,
      landlord_verification_approved_at: null,
      landlord_verification_approved_by: null,
    })
    .eq("id", id);

  if (error) return fail("SERVER_ERROR", error.message, 500);

  if (process.env.RESEND_API_KEY && email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: RESEND_FROM,
        to: email,
        subject: "Update on your BahayGo landlord verification",
        html: `<p>Hi ${esc(name)},</p>
          <p>We could not approve your landlord verification at this time.</p>
          <p><strong>Reason:</strong> ${esc(reason)}</p>
          <p>Please submit a new listing with updated documents when you're ready.</p>`,
      });
    } catch (e) {
      console.warn("[admin/landlord-verifications] rejection email failed", e);
    }
  }

  return NextResponse.json({ ok: true, status: "rejected" });
}
