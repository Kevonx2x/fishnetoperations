import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return fail("INVALID_JSON", "Invalid JSON", 400);
  }

  const userId = body.user_id?.trim();
  if (!userId) {
    return fail("MISSING_FIELD", "user_id is required", 400, undefined, "user_id");
  }

  const admin = createSupabaseAdmin();
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) {
    return fail("DATABASE_ERROR", pErr.message, 500);
  }
  if (!profile?.id) {
    return fail("NOT_FOUND", "Profile not found", 404);
  }

  let image = (profile.avatar_url as string | null | undefined)?.trim() || undefined;
  if (!image && (profile.role as string | null) === "agent") {
    const { data: agentRow } = await admin
      .from("agents")
      .select("image_url")
      .eq("user_id", userId)
      .maybeSingle();
    image = (agentRow?.image_url as string | null | undefined)?.trim() || undefined;
  }

  const stream = getStreamClient();
  const payload = {
    id: userId,
    name: (profile.full_name as string | null | undefined)?.trim() || "User",
    image,
  };

  await stream.upsertUser(payload);
  return ok({ ...payload, role: profile.role ?? null });
}

