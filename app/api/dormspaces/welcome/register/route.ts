import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import {
  isDormspaceSubmitBlockedRole,
  isLandlordCapable,
} from "@/lib/auth-roles";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const emailLower = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return fail("SERVER_ERROR", "Server configuration error", 500);
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, is_landlord")
    .eq("email", emailLower)
    .maybeSingle();

  if (existingProfile?.id) {
    const role = String(existingProfile.role ?? "");
    if (isLandlordCapable({ role, is_landlord: existingProfile.is_landlord === true })) {
      return fail(
        "EMAIL_EXISTS",
        "An account with this email already exists. Sign in to continue.",
        409,
      );
    }
    if (isDormspaceSubmitBlockedRole(role)) {
      return fail(
        "ROLE_CONFLICT",
        "This email is tied to a BahayGo agent or admin account. Use a different email for your landlord account.",
        409,
      );
    }
    return fail(
      "EMAIL_EXISTS",
      "An account with this email already exists. Sign in to continue.",
      409,
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailLower,
    password,
    email_confirm: true,
    user_metadata: { role: "landlord" },
  });

  if (createErr || !created.user?.id) {
    const msg = createErr?.message ?? "Could not create account";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return fail(
        "EMAIL_EXISTS",
        "An account with this email already exists. Sign in to continue.",
        409,
      );
    }
    return fail("AUTH_ERROR", msg, 400);
  }

  const userId = created.user.id;
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: emailLower,
      full_name: "",
      role: "landlord",
      is_landlord: true,
    },
    { onConflict: "id" },
  );

  if (profErr) {
    console.error("[dormspaces/welcome/register] profile upsert failed", profErr);
    await admin.auth.admin.deleteUser(userId);
    return fail("SERVER_ERROR", "Could not create landlord profile", 500);
  }

  return ok({ userId });
}
