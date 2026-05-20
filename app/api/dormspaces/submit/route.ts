import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { uploadDormspaceListingPhoto, uploadDormspaceVerificationFile } from "@/lib/dormspace-storage";
import { RESEND_FROM } from "@/lib/resend-from";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const roomTypes = ["private", "shared_2", "shared_4", "shared_6_plus"] as const;
const genders = ["any", "male", "female"] as const;

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "true" || v === "on" || v === "1";
}

function parseNum(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const session = await getSessionProfile();

  const landlord_name = String(form.get("landlord_name") ?? "").trim();
  const landlord_email = String(form.get("landlord_email") ?? "").trim();
  const landlord_phone = String(form.get("landlord_phone") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const room_type = String(form.get("room_type") ?? "").trim();
  const gender_preference = String(form.get("gender_preference") ?? "any").trim() || "any";
  const address = String(form.get("address") ?? "").trim();
  const city = String(form.get("city") ?? "").trim() || null;
  const neighborhood = String(form.get("neighborhood") ?? "").trim() || null;
  const near_school = String(form.get("near_school") ?? "").trim() || null;
  const curfew = String(form.get("curfew") ?? "").trim() || null;
  const rules_notes = String(form.get("rules_notes") ?? "").trim() || null;

  const monthly_price = parseNum(form.get("monthly_price"));
  const deposit_months = parseNum(form.get("deposit_months")) ?? 1;
  const latitude = parseNum(form.get("latitude"));
  const longitude = parseNum(form.get("longitude"));

  const idFile = form.get("landlord_id");
  const billingFile = form.get("proof_of_billing");
  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  const baseSchema = z.object({
    landlord_name: z.string().min(1).max(200),
    landlord_email: z.string().email().max(320),
    landlord_phone: z.string().min(7).max(40),
    title: z.string().min(3).max(300),
    room_type: z.enum(roomTypes),
    gender_preference: z.enum(genders),
    address: z.string().min(5).max(500),
    monthly_price: z.number().positive().max(9999999),
  });

  const parsed = baseSchema.safeParse({
    landlord_name,
    landlord_email,
    landlord_phone,
    title,
    room_type,
    gender_preference,
    address,
    monthly_price: monthly_price ?? NaN,
  });

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid form data", 400);
  }

  if (!(idFile instanceof File) || idFile.size === 0) {
    return fail("BAD_REQUEST", "Valid ID upload is required", 400);
  }
  if (!(billingFile instanceof File) || billingFile.size === 0) {
    return fail("BAD_REQUEST", "Proof of billing upload is required", 400);
  }
  if (photoFiles.length < 3) {
    return fail("BAD_REQUEST", "Upload at least 3 listing photos", 400);
  }
  if (photoFiles.length > 10) {
    return fail("BAD_REQUEST", "Maximum 10 listing photos", 400);
  }

  const admin = createSupabaseAdmin();

  const { data: inserted, error: insertErr } = await admin
    .from("dormspaces")
    .insert({
      landlord_user_id: session?.userId ?? null,
      landlord_name,
      landlord_email,
      landlord_phone,
      title,
      description,
      monthly_price,
      deposit_months,
      room_type,
      gender_preference,
      address,
      city,
      neighborhood,
      latitude,
      longitude,
      near_school,
      has_wifi: parseBool(form.get("has_wifi")),
      has_aircon: parseBool(form.get("has_aircon")),
      has_kitchen: parseBool(form.get("has_kitchen")),
      has_laundry: parseBool(form.get("has_laundry")),
      has_water_included: parseBool(form.get("has_water_included")),
      has_electricity_included: parseBool(form.get("has_electricity_included")),
      has_security: parseBool(form.get("has_security")),
      curfew,
      rules_notes,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    console.error("[dormspaces/submit] insert failed", insertErr);
    return fail("SERVER_ERROR", "Could not save submission", 500);
  }

  const dormspaceId = inserted.id as string;

  try {
    const landlord_id_url = await uploadDormspaceVerificationFile(admin, dormspaceId, "id", idFile);
    const proof_of_billing_url = await uploadDormspaceVerificationFile(admin, dormspaceId, "billing", billingFile);

    await admin.from("dormspaces").update({ landlord_id_url, proof_of_billing_url }).eq("id", dormspaceId);

    const photoRows: { dormspace_id: string; url: string; display_order: number }[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const url = await uploadDormspaceListingPhoto(admin, dormspaceId, photoFiles[i]!, i);
      photoRows.push({ dormspace_id: dormspaceId, url, display_order: i });
    }
    const { error: photosErr } = await admin.from("dormspace_photos").insert(photoRows);
    if (photosErr) throw new Error(photosErr.message);
  } catch (e) {
    console.error("[dormspaces/submit] storage failed", e);
    await admin.from("dormspaces").delete().eq("id", dormspaceId);
    return fail(
      "SERVER_ERROR",
      "Could not upload files. Ensure dormspace storage buckets exist (run migration).",
      500,
    );
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminLink = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://bahaygo.com"}/admin`;
      await resend.emails.send({
        from: RESEND_FROM,
        to: "support@bahaygo.com",
        subject: `New dormspace submission — ${title}`,
        html: `<p>A new dormspace listing is pending review.</p>
          <p><strong>${title}</strong> by ${landlord_name} (${landlord_email})</p>
          <p><a href="${adminLink}">Open admin</a> → Dormspace Submissions</p>`,
      });
    } catch (e) {
      console.warn("[dormspaces/submit] admin email failed", e);
    }
  }

  return NextResponse.json({ ok: true, id: dormspaceId });
}
