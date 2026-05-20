import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const admin = createSupabaseAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !profile) {
    return fail("SERVER_ERROR", "Could not load profile", 500);
  }

  return ok({ profile });
}

const patchSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(40).optional().nullable(),
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

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone?.trim() || null,
    })
    .eq("id", session.userId);

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
