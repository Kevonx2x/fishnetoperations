import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { CANNOT_SAVE_OWN_DORMSPACE } from "@/lib/dormspace-engagement";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  dormspace_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) return fail("UNAUTHORIZED", "Sign in required", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();
  const { data: dormspace, error: loadErr } = await admin
    .from("dormspaces")
    .select("id, landlord_user_id")
    .eq("id", parsed.data.dormspace_id)
    .maybeSingle();

  if (loadErr || !dormspace) {
    return fail("NOT_FOUND", "Dormspace not found", 404);
  }

  if (dormspace.landlord_user_id === session.userId) {
    return fail("FORBIDDEN", CANNOT_SAVE_OWN_DORMSPACE, 403);
  }

  const { error } = await admin.from("dormspace_saves").insert({
    user_id: session.userId,
    dormspace_id: parsed.data.dormspace_id,
  });

  if (error) {
    if (error.code === "23505") {
      return ok({ saved: true });
    }
    console.error("[dormspaces/saves] insert failed", error);
    return fail("SERVER_ERROR", "Could not save listing", 500);
  }

  return ok({ saved: true });
}
