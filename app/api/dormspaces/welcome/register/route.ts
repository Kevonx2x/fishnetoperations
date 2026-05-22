import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
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
  const firstName = parsed.data.first_name.trim();
  const lastName = parsed.data.last_name.trim();
  const fullName = `${firstName} ${lastName}`.trim();

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
    user_metadata: { role: "client", first_name: firstName, last_name: lastName, full_name: fullName },
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
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      role: "client",
      is_landlord: false,
    },
    { onConflict: "id" },
  );

  if (profErr) {
    console.error("[dormspaces/welcome/register] profile upsert failed", profErr);
    await admin.auth.admin.deleteUser(userId);
    return fail("SERVER_ERROR", "Could not create profile", 500);
  }

  return ok({ userId });
}
