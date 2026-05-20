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
    .from("dormspaces")
    .select("*, dormspace_photos(id, url, display_order)")
    .eq("id", id)
    .maybeSingle();

  if (error) return fail("SERVER_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Not found", 404);

  const row = data as Record<string, unknown>;
  const landlordIdSigned = await signedVerificationUrl(admin, String(row.landlord_id_url ?? ""));
  const billingSigned = await signedVerificationUrl(admin, String(row.proof_of_billing_url ?? ""));

  return NextResponse.json({
    ...row,
    landlord_id_signed_url: landlordIdSigned,
    proof_of_billing_signed_url: billingSigned,
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
    .from("dormspaces")
    .select("id, title, landlord_email, landlord_name, status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", loadErr.message, 500);
  if (!existing) return fail("NOT_FOUND", "Not found", 404);

  if (parsed.data.action === "approve") {
    const { error } = await admin
      .from("dormspaces")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: session.userId,
        rejection_reason: null,
      })
      .eq("id", id);

    if (error) return fail("SERVER_ERROR", error.message, 500);

    if (process.env.RESEND_API_KEY && existing.landlord_email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: RESEND_FROM,
          to: String(existing.landlord_email),
          subject: "Your dormspace listing is live on BahayGo",
          html: `<p>Hi ${esc(String(existing.landlord_name))},</p>
            <p>Your listing <strong>${esc(String(existing.title))}</strong> has been approved and is now visible on BahayGo Dormspaces.</p>
            <p>Thank you for listing with us.</p>`,
        });
      } catch (e) {
        console.warn("[admin/dormspaces] approval email failed", e);
      }
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  const reason = parsed.data.rejection_reason?.trim() || "Did not meet our listing guidelines.";
  const { error } = await admin
    .from("dormspaces")
    .update({
      status: "rejected",
      rejection_reason: reason,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", id);

  if (error) return fail("SERVER_ERROR", error.message, 500);

  if (process.env.RESEND_API_KEY && existing.landlord_email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: RESEND_FROM,
        to: String(existing.landlord_email),
        subject: "Update on your BahayGo dormspace submission",
        html: `<p>Hi ${esc(String(existing.landlord_name))},</p>
          <p>We could not approve <strong>${esc(String(existing.title))}</strong> at this time.</p>
          <p><strong>Reason:</strong> ${esc(reason)}</p>
          <p>You may submit a revised listing at any time.</p>`,
      });
    } catch (e) {
      console.warn("[admin/dormspaces] rejection email failed", e);
    }
  }

  return NextResponse.json({ ok: true, status: "rejected" });
}
