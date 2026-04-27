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

export async function syncAllUsersToStream() {
  const admin = createSupabaseAdmin();
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .order("created_at", { ascending: true });
  if (pErr) return { ok: false as const, error: pErr.message };

  const { data: agents, error: aErr } = await admin.from("agents").select("user_id, image_url");
  if (aErr) return { ok: false as const, error: aErr.message };

  const allProfiles = (profiles ?? []) as unknown as ProfileRow[];
  const agentImageByUserId = new Map<string, string>();
  for (const a of (agents ?? []) as unknown as AgentRow[]) {
    const url = (a.image_url ?? "").trim();
    if (url) agentImageByUserId.set(a.user_id, url);
  }

  const users = allProfiles.map((p) => {
    const avatar = (p.avatar_url ?? "").trim();
    const agentFallback = p.role === "agent" ? agentImageByUserId.get(p.id) : undefined;
    return {
      id: p.id,
      name: (p.full_name ?? "").trim() || "User",
      image: avatar || agentFallback || undefined,
    };
  });

  const stream = getStreamClient();
  const batches = chunk(users, 50);
  let synced = 0;
  for (const batch of batches) {
    await Promise.all(batch.map((u) => stream.upsertUser(u)));
    synced += batch.length;
  }

  return { ok: true as const, data: { synced } };
}

