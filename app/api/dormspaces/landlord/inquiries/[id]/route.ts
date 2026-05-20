import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireLandlordSession } from "@/lib/landlord-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const patchSchema = z.object({
  action: z.enum(["responded", "archive"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const session = await requireLandlordSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Landlord sign-in required", 401);

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const admin = createSupabaseAdmin();
  const { data: inquiry, error: loadErr } = await admin
    .from("dormspace_inquiries")
    .select("id, dormspace_id, dormspaces(landlord_user_id)")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return fail("SERVER_ERROR", "Could not load inquiry", 500);

  const dormspace = inquiry?.dormspaces as { landlord_user_id?: string } | null;
  if (!inquiry || dormspace?.landlord_user_id !== session.userId) {
    return fail("NOT_FOUND", "Inquiry not found", 404);
  }

  const now = new Date().toISOString();
  const patch =
    parsed.data.action === "responded"
      ? { status: "responded" as const, responded_at: now, read_at: now }
      : { status: "archived" as const, read_at: now };

  const { error: updateErr } = await admin.from("dormspace_inquiries").update(patch).eq("id", id);

  if (updateErr) {
    console.error("[landlord/inquiries] update failed", updateErr);
    return fail("SERVER_ERROR", "Could not update inquiry", 500);
  }

  return ok({ status: patch.status });
}
