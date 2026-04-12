import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REASONS = [
  "Fake listing",
  "Scam",
  "Inappropriate behavior",
  "Spam",
  "Impersonation",
  "Other",
] as const;

const bodySchema = z.object({
  reported_user_id: z.string().uuid(),
  reason: z.enum(REASONS),
  notes: z.string().max(5000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in to submit a report", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { reported_user_id, reason, notes } = parsed.data;
  if (reported_user_id === session.userId) {
    return fail("BAD_REQUEST", "You cannot report yourself", 400);
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("reports").insert({
    reporter_id: session.userId,
    reported_user_id,
    reason,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("[reports] insert", error);
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok({ success: true });
}
