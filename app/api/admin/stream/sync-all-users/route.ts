import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type AgentRow = { user_id: string; image_url: string | null };

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST() {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const admin = createSupabaseAdmin();
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .order("created_at", { ascending: true });

  if (pErr) {
    return fail("DATABASE_ERROR", pErr.message, 500);
  }

  const allProfiles = (profiles ?? []) as unknown as ProfileRow[];

  const { data: agents, error: aErr } = await admin
    .from("agents")
    .select("user_id, image_url");

  if (aErr) {
    return fail("DATABASE_ERROR", aErr.message, 500);
  }

  const agentImageByUserId = new Map<string, string>();
  for (const a of (agents ?? []) as unknown as AgentRow[]) {
    const url = (a.image_url ?? "").trim();
    if (url) agentImageByUserId.set(a.user_id, url);
  }

  const stream = getStreamClient();

  const users = allProfiles.map((p) => {
    const avatar = (p.avatar_url ?? "").trim();
    const agentFallback = p.role === "agent" ? agentImageByUserId.get(p.id) : undefined;
    return {
      id: p.id,
      name: (p.full_name ?? "").trim() || "User",
      image: avatar || agentFallback || undefined,
    };
  });

  // Stream docs limit bulk upserts to 100; we further throttle concurrency to avoid hammering the API.
  const chunks = chunk(users, 50);
  let synced = 0;

  console.log(`[stream/sync-all-users] syncing ${users.length} users in ${chunks.length} batches`);
  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i]!;
    console.log(
      `[stream/sync-all-users] batch ${i + 1}/${chunks.length} (${synced}/${users.length} done)`,
    );
    await Promise.all(batch.map((u) => stream.upsertUser(u)));
    synced += batch.length;
  }

  console.log(`[stream/sync-all-users] done (${synced} users)`);
  return ok({ synced });
}

