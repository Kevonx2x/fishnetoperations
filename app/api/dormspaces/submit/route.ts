import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { getSessionProfile } from "@/lib/admin-api-auth";
import {
  canSetLandlordFlagOnSubmit,
  isDormspaceSubmitBlockedRole,
  isLandlordCapable,
} from "@/lib/auth-roles";
import { fail } from "@/lib/api/response";
import {
  isVerifiedLandlordProfile,
  needsLandlordVerificationUpload,
  normalizeLandlordVerificationStatus,
} from "@/lib/landlord-verification";
import {
  signedVerificationUrl,
  uploadDormspaceListingPhoto,
  uploadLandlordProfileVerificationFile,
} from "@/lib/dormspace-storage";
import { RESEND_FROM } from "@/lib/resend-from";
import {
  buildGenderBedDbFields,
  parseBedInventoryFromFormData,
} from "@/lib/dormspace-bed-inventory-form";
import { calculateAndStoreWalkTimes } from "@/lib/dormspace-walk-times";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60;
export const runtime = "nodejs";

const roomTypes = ["private", "shared_2", "shared_4", "shared_6_plus", "mixed"] as const;

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "true" || v === "on" || v === "1";
}

function parseNum(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendAdminEmail(html: string, subject: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: RESEND_FROM,
      to: "ron.business101@gmail.com",
      subject,
      html,
    });
  } catch (e) {
    console.warn("[dormspaces/submit] admin email failed", e);
  }
}

export async function POST(req: Request) {
  try {
    return await handleDormspaceSubmit(req);
  } catch (e) {
    console.error("[dormspaces/submit] unhandled", e);
    return fail("SERVER_ERROR", "Could not save submission", 500);
  }
}

async function handleDormspaceSubmit(req: Request) {
  const session = await getSessionProfile();

  if (session && isDormspaceSubmitBlockedRole(session.role)) {
    return fail(
      "role_conflict",
      "Agents, brokers, and admins cannot create dormspace listings under their existing accounts. Please use a separate landlord account.",
      403,
    );
  }

  const form = await req.formData();

  let landlord_name = String(form.get("landlord_name") ?? "").trim();
  let landlord_email = String(form.get("landlord_email") ?? "").trim();
  let landlord_phone = String(form.get("landlord_phone") ?? "").trim();

  const firstName = String(form.get("landlord_first_name") ?? "").trim();
  const lastName = String(form.get("landlord_last_name") ?? "").trim();
  if (!landlord_name && (firstName || lastName)) {
    landlord_name = `${firstName} ${lastName}`.trim();
  }
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim();
  const city = String(form.get("city") ?? "").trim() || null;
  const neighborhood = String(form.get("neighborhood") ?? "").trim() || null;
  const near_school = String(form.get("near_school") ?? "").trim() || null;
  const curfew = String(form.get("curfew") ?? "").trim() || null;
  const rules_notes = String(form.get("rules_notes") ?? "").trim() || null;

  const deposit_months = parseNum(form.get("deposit_months")) ?? 1;
  const latitude = parseNum(form.get("latitude"));
  const longitude = parseNum(form.get("longitude"));

  const idFile = form.get("landlord_id");
  const billingFile = form.get("proof_of_billing");
  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  const bedInventory = parseBedInventoryFromFormData(form);
  if (!bedInventory) {
    return fail("BAD_REQUEST", "Invalid room type or bed setup", 400);
  }
  const bedFields = buildGenderBedDbFields(bedInventory);
  if (bedFields.error) {
    return fail("BAD_REQUEST", bedFields.error, 400);
  }

  const room_type = bedFields.payload.room_type as string;

  const baseSchema = z.object({
    landlord_name: z.string().min(1).max(200),
    landlord_email: z.string().email().max(320),
    landlord_phone: z.string().min(7).max(40),
    title: z.string().min(3).max(300),
    room_type: z.enum(roomTypes),
    address: z.string().min(5).max(500),
  });

  const parsed = baseSchema.safeParse({
    landlord_name,
    landlord_email,
    landlord_phone,
    title,
    room_type,
    address,
  });

  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid form data", 400);
  }

  if (photoFiles.length < 3) {
    return fail("BAD_REQUEST", "Upload at least 3 listing photos", 400);
  }
  if (photoFiles.length > 10) {
    return fail("BAD_REQUEST", "Maximum 10 listing photos", 400);
  }

  const admin = createSupabaseAdmin();
  const password = String(form.get("landlord_password") ?? "").trim();

  let landlordUserId: string | null =
    session && isLandlordCapable(session) ? session.userId : null;

  if (session && isLandlordCapable(session)) {
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", session.userId)
      .maybeSingle();
    if (!landlord_name) landlord_name = prof?.full_name?.trim() ?? "";
    if (!landlord_email) landlord_email = (prof?.email ?? session.email ?? "").trim();
    if (!landlord_phone) landlord_phone = prof?.phone?.trim() ?? "";
  }

  const emailLower = landlord_email.trim().toLowerCase();

  if (!landlordUserId && password.length >= 8) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", emailLower)
      .maybeSingle();

    if (existingProfile?.id) {
      if (session && session.userId === existingProfile.id) {
        landlordUserId = session.userId;
        if (canSetLandlordFlagOnSubmit(existingProfile.role as string)) {
          await admin.from("profiles").update({
            is_landlord: true,
            full_name: landlord_name,
            phone: landlord_phone,
          }).eq("id", session.userId);
        }
      } else {
        return fail(
          "EMAIL_EXISTS",
          "An account with this email already exists. Sign in to submit your listing.",
          409,
        );
      }
    }

    if (!landlordUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: { full_name: landlord_name, role: "landlord" },
      });

      if (createErr || !created.user?.id) {
        const msg = createErr?.message ?? "Could not create account";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
          return fail(
            "EMAIL_EXISTS",
            "An account with this email already exists. Sign in to submit your listing.",
            409,
          );
        }
        return fail("AUTH_ERROR", msg, 400);
      }

      landlordUserId = created.user.id;
      const { error: profErr } = await admin.from("profiles").upsert(
        {
          id: landlordUserId,
          full_name: landlord_name,
          email: emailLower,
          phone: landlord_phone,
          role: "landlord",
          is_landlord: true,
          landlord_verification_status: "unverified",
        },
        { onConflict: "id" },
      );

      if (profErr) {
        console.error("[dormspaces/submit] profile upsert failed", profErr);
        await admin.auth.admin.deleteUser(landlordUserId);
        return fail("SERVER_ERROR", "Could not create landlord profile", 500);
      }
    }
  } else if (!landlordUserId && session?.userId) {
    landlordUserId = session.userId;
    const sessionEmail = session.email?.trim().toLowerCase();
    if (sessionEmail && sessionEmail === emailLower && canSetLandlordFlagOnSubmit(session.role)) {
      await admin.from("profiles").update({
        is_landlord: true,
        full_name: landlord_name,
        phone: landlord_phone,
      }).eq("id", session.userId);
    }
  }

  if (landlordUserId && landlord_name && landlord_phone.length >= 7) {
    const profilePatch: { full_name: string; phone: string; is_landlord?: boolean } = {
      full_name: landlord_name,
      phone: landlord_phone,
    };
    if (session?.userId === landlordUserId && canSetLandlordFlagOnSubmit(session.role)) {
      profilePatch.is_landlord = true;
    }
    const { error: contactErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", landlordUserId);
    if (contactErr) {
      console.error("[dormspaces/submit] profile contact sync failed", contactErr);
    }
  }

  let verificationStatus = normalizeLandlordVerificationStatus("unverified");
  if (landlordUserId) {
    const { data: landlordProfile } = await admin
      .from("profiles")
      .select("landlord_verification_status")
      .eq("id", landlordUserId)
      .maybeSingle();
    verificationStatus = normalizeLandlordVerificationStatus(
      landlordProfile?.landlord_verification_status as string | null | undefined,
    );
  }

  const requiresVerificationUpload = needsLandlordVerificationUpload(verificationStatus);

  if (requiresVerificationUpload) {
    if (!(idFile instanceof File) || idFile.size === 0) {
      return fail("BAD_REQUEST", "Valid ID upload is required", 400);
    }
    if (!(billingFile instanceof File) || billingFile.size === 0) {
      return fail("BAD_REQUEST", "Proof of billing upload is required", 400);
    }
  }

  const listingApproved = isVerifiedLandlordProfile(verificationStatus);
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertErr } = await admin
    .from("dormspaces")
    .insert({
      landlord_user_id: landlordUserId,
      landlord_name,
      landlord_email,
      landlord_phone,
      title,
      description,
      deposit_months,
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
      ...bedFields.payload,
      status: listingApproved ? "approved" : "pending",
      ...(listingApproved
        ? { approved_at: nowIso, approved_by: null, rejection_reason: null }
        : {}),
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    console.error("[dormspaces/submit] insert failed", insertErr);
    return fail("SERVER_ERROR", "Could not save submission", 500);
  }

  const dormspaceId = inserted.id as string;

  try {
    const photoRows: { dormspace_id: string; url: string; display_order: number }[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const url = await uploadDormspaceListingPhoto(admin, dormspaceId, photoFiles[i]!, i);
      photoRows.push({ dormspace_id: dormspaceId, url, display_order: i });
    }
    const { error: photosErr } = await admin.from("dormspace_photos").insert(photoRows);
    if (photosErr) throw new Error(photosErr.message);

    if (requiresVerificationUpload && landlordUserId) {
      const landlord_id_url = await uploadLandlordProfileVerificationFile(
        admin,
        landlordUserId,
        "id",
        idFile as File,
      );
      const proof_of_billing_url = await uploadLandlordProfileVerificationFile(
        admin,
        landlordUserId,
        "billing",
        billingFile as File,
      );

      const { error: profileErr } = await admin
        .from("profiles")
        .update({
          landlord_id_url,
          landlord_proof_of_billing_url: proof_of_billing_url,
          landlord_verification_status: "pending",
          landlord_verification_submitted_at: nowIso,
          landlord_verification_rejection_reason: null,
          landlord_verification_approved_at: null,
          landlord_verification_approved_by: null,
        })
        .eq("id", landlordUserId);

      if (profileErr) throw new Error(profileErr.message);

      const idSigned = await signedVerificationUrl(admin, landlord_id_url);
      const billingSigned = await signedVerificationUrl(admin, proof_of_billing_url);
      const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://bahaygo.com";
      void sendAdminEmail(
        `<p><strong>New landlord verification</strong> — ${esc(landlord_name)} (${esc(landlord_email)})</p>
          <p>Submitted with listing <strong>${esc(title)}</strong>.</p>
          <p><a href="${esc(`${siteBase}/admin`)}">Open admin</a> → Dormspaces → Landlord Verification</p>
          <ul>
            ${idSigned ? `<li><a href="${esc(idSigned)}">Valid ID</a></li>` : "<li>ID link unavailable</li>"}
            ${billingSigned ? `<li><a href="${esc(billingSigned)}">Proof of billing</a></li>` : "<li>Billing link unavailable</li>"}
          </ul>`,
        `Landlord verification — ${landlord_name}`,
      ).catch((err) => console.warn(err));
    }
  } catch (e) {
    console.error("[dormspaces/submit] storage failed", e);
    await admin.from("dormspaces").delete().eq("id", dormspaceId);
    return fail(
      "SERVER_ERROR",
      "Could not upload files. Ensure dormspace storage buckets exist (run migration).",
      500,
    );
  }

  if (!listingApproved) {
    const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://bahaygo.com";
    const listingLink = `${siteBase}/dormspaces/${dormspaceId}`;
    void sendAdminEmail(
      `<p>New dormspace listing pending review.</p>
        <p><strong>${esc(title)}</strong></p>
        <p>Landlord: ${esc(landlord_name)} · ${esc(landlord_email)} · ${esc(landlord_phone)}</p>
        <p>From ₱${esc(String(bedFields.payload.monthly_price ?? ""))} · Room: ${esc(room_type)}</p>
        <p><a href="${esc(listingLink)}">Preview listing</a> · <a href="${esc(`${siteBase}/admin`)}">Admin — Listings queue</a></p>`,
      `New dormspace listing — ${title}`,
    ).catch((err) => console.warn(err));
  }

  if (latitude != null && longitude != null) {
    void calculateAndStoreWalkTimes(dormspaceId, latitude, longitude).catch(console.error);
  }

  return NextResponse.json({
    ok: true,
    id: dormspaceId,
    landlord_user_id: landlordUserId,
    created_account: Boolean(landlordUserId && password.length >= 8),
    listing_status: listingApproved ? "approved" : "pending",
  });
}
