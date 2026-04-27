import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

export async function syncOneUserToStream(userId: string) {
  const admin = createSupabaseAdmin();
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) return { ok: false as const, error: { code: "DATABASE_ERROR", message: pErr.message } };
  if (!profile?.id) return { ok: false as const, error: { code: "NOT_FOUND", message: "Profile not found" } };

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
  return { ok: true as const, data: { ...payload, role: profile.role ?? null } };
}

