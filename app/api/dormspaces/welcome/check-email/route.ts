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

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return fail("SERVER_ERROR", "Server configuration error", 500);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profile?.id) {
    return ok({ exists: true });
  }

  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 10; i++) {
    const { data: authPage, error: authErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (authErr) {
      console.error("[dormspaces/welcome/check-email] auth list failed", authErr);
      break;
    }
    const users = authPage?.users ?? [];
    if (users.some((u) => u.email?.trim().toLowerCase() === email)) {
      return ok({ exists: true });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return ok({ exists: false });
}
