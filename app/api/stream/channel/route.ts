import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { agent_id?: string; client_id?: string };
    try {
      body = (await req.json()) as { agent_id?: string; client_id?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const agentId = body.agent_id?.trim();
    const clientId = body.client_id?.trim();
    if (!agentId || !clientId) {
      return NextResponse.json({ error: "agent_id and client_id are required" }, { status: 400 });
    }

    if (agentId === clientId) {
      return NextResponse.json({ error: "Invalid participants" }, { status: 400 });
    }

    if (session.userId !== agentId && session.userId !== clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const [{ data: agentProfile }, { data: clientProfile }] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url").eq("id", agentId).maybeSingle(),
      admin.from("profiles").select("id, full_name, avatar_url").eq("id", clientId).maybeSingle(),
    ]);

    if (!agentProfile?.id || !clientProfile?.id) {
      return NextResponse.json({ error: "One or both users were not found" }, { status: 404 });
    }

    const stream = getStreamClient();
    await Promise.all([
      stream.upsertUser({
        id: agentId,
        name: (agentProfile.full_name as string | null)?.trim() || "Agent",
        image: (agentProfile.avatar_url as string | null)?.trim() || undefined,
      }),
      stream.upsertUser({
        id: clientId,
        name: (clientProfile.full_name as string | null)?.trim() || "Client",
        image: (clientProfile.avatar_url as string | null)?.trim() || undefined,
      }),
    ]);

    const sorted = [agentId, clientId].sort((a, b) => a.localeCompare(b));
    const channelId = `${sorted[0]}-${sorted[1]}`;

    const existing = await stream.queryChannels(
      { type: "messaging", id: channelId },
      { last_message_at: -1 },
      { limit: 1 },
    );

    if (existing.length > 0) {
      return NextResponse.json({ channel_id: channelId });
    }

    const channel = stream.channel("messaging", channelId, {
      members: [agentId, clientId],
    });
    try {
      await channel.create();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already exists|duplicate|exists/i.test(msg)) {
        throw e;
      }
    }

    return NextResponse.json({ channel_id: channelId });
  } catch (e) {
    console.error("[stream/channel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
