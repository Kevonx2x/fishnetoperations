import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import {
  DORMSPACE_LANDLORD_LANGUAGE_OPTIONS,
  type LandlordProfileTrust,
} from "@/lib/dormspace-landlord-profile";
import {
  isVerifiedLandlordProfile,
  normalizeLandlordVerificationStatus,
} from "@/lib/landlord-verification";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const languageSet = new Set<string>(DORMSPACE_LANDLORD_LANGUAGE_OPTIONS);

async function loadLandlordTrust(admin: ReturnType<typeof createSupabaseAdmin>, userId: string): Promise<LandlordProfileTrust> {
  const { data: profile } = await admin
    .from("profiles")
    .select("created_at, landlord_verification_status")
    .eq("id", userId)
    .maybeSingle();

  const status = normalizeLandlordVerificationStatus(
    profile?.landlord_verification_status as string | null | undefined,
  );

  return {
    verified_landlord: isVerifiedLandlordProfile(status),
    free_listings: true,
    member_since: (profile?.created_at as string | null) ?? null,
  };
}

export async function GET() {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const admin = createSupabaseAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, avatar_url, role, created_at, landlord_bio, landlord_languages, landlord_preferred_contact, landlord_years_renting, landlord_verification_status, landlord_verification_rejection_reason",
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !profile) {
    return fail("SERVER_ERROR", "Could not load profile", 500);
  }

  const trust = await loadLandlordTrust(admin, session.userId);

  return ok({ profile, trust });
}

const patchSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(40).optional().nullable(),
  avatar_url: z.string().max(2000).optional().nullable(),
  landlord_bio: z.string().max(500).optional().nullable(),
  landlord_languages: z
    .array(z.string())
    .max(DORMSPACE_LANDLORD_LANGUAGE_OPTIONS.length)
    .optional(),
  landlord_preferred_contact: z.enum(["email", "phone", "either"]).optional().nullable(),
  landlord_years_renting: z.number().int().min(0).max(80).optional().nullable(),
});

export async function PATCH(req: Request) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const langs = (parsed.data.landlord_languages ?? []).filter((l) => languageSet.has(l));

  const admin = createSupabaseAdmin();
  const update: Record<string, unknown> = {
    full_name: parsed.data.full_name.trim(),
    phone: parsed.data.phone?.trim() || null,
  };

  if (parsed.data.avatar_url !== undefined) {
    update.avatar_url =
      typeof parsed.data.avatar_url === "string" && parsed.data.avatar_url.trim()
        ? parsed.data.avatar_url.trim()
        : null;
  }
  if (parsed.data.landlord_bio !== undefined) {
    update.landlord_bio = parsed.data.landlord_bio?.trim() || null;
  }
  if (parsed.data.landlord_languages !== undefined) {
    update.landlord_languages = langs.length ? langs : null;
  }
  if (parsed.data.landlord_preferred_contact !== undefined) {
    update.landlord_preferred_contact = parsed.data.landlord_preferred_contact;
  }
  if (parsed.data.landlord_years_renting !== undefined) {
    update.landlord_years_renting = parsed.data.landlord_years_renting;
  }

  const { error } = await admin.from("profiles").update(update).eq("id", session.userId);

  if (error) {
    console.error("[landlord/profile] update failed", error);
    return fail("SERVER_ERROR", "Could not update profile", 500);
  }

  const { data: dormspaces } = await admin
    .from("dormspaces")
    .select("id")
    .eq("landlord_user_id", session.userId);

  if (dormspaces?.length) {
    await admin
      .from("dormspaces")
      .update({
        landlord_name: parsed.data.full_name.trim(),
        landlord_phone: parsed.data.phone?.trim() || null,
      })
      .eq("landlord_user_id", session.userId);
  }

  return ok({ updated: true });
}
