import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  email: z.string().email().max(320),
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

  const email = parsed.data.email.trim().toLowerCase();
  const admin = createSupabaseAdmin();

  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();

  return ok({ exists: Boolean(profile?.id) });
}
