import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  role: z.enum(["client", "agent", "broker"]),
});

/** Signed-in user updates their own profile role (not admin — use admin dashboard for that). */
export async function PATCH(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in required", 401);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) return fromZodError(e);
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  if (session.role === "admin") {
    return fail("FORBIDDEN", "Admins cannot change role here; use the admin dashboard.", 403);
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("profiles")
    .update({ role: parsed.role, updated_at: new Date().toISOString() })
    .eq("id", session.userId);

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ role: parsed.role });
}
