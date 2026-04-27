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

    let body: {
      agent_id?: string;
      client_id?: string;
      agent_user_id?: string;
      client_user_id?: string;
      metadata?: {
        property_id?: string | null;
        property_name?: string | null;
        property_price?: string | null;
        property_image?: string | null;
      };
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const agentId = (body.agent_user_id ?? body.agent_id)?.trim();
    const clientId = (body.client_user_id ?? body.client_id)?.trim();
    if (!agentId || !clientId) {
      return NextResponse.json(
        { error: "agent_user_id and client_user_id are required" },
        { status: 400 },
      );
    }

    if (agentId === clientId) {
      return NextResponse.json({ error: "Invalid participants" }, { status: 400 });
    }

    if (session.userId !== agentId && session.userId !== clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const [{ data: agentProfile }, { data: clientProfile }, { data: agentRow }] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url").eq("id", agentId).maybeSingle(),
      admin.from("profiles").select("id, full_name, avatar_url").eq("id", clientId).maybeSingle(),
      admin.from("agents").select("image_url").eq("user_id", agentId).maybeSingle(),
    ]);

    if (!agentProfile?.id || !clientProfile?.id) {
      return NextResponse.json({ error: "One or both users were not found" }, { status: 404 });
    }

    const agentImage =
      (agentProfile.avatar_url as string | null | undefined)?.trim() ||
      (agentRow?.image_url as string | null | undefined)?.trim() ||
      undefined;

    const stream = getStreamClient();
    await Promise.all([
      stream.upsertUser({
        id: agentId,
        name: (agentProfile.full_name as string | null)?.trim() || "Agent",
        image: agentImage,
      }),
      stream.upsertUser({
        id: clientId,
        name: (clientProfile.full_name as string | null)?.trim() || "Client",
        image: (clientProfile.avatar_url as string | null)?.trim() || undefined,
      }),
    ]);

    const sorted = [agentId, clientId].sort((a, b) => a.localeCompare(b));
    const channelId = `${sorted[0].slice(0, 8)}-${sorted[1].slice(0, 8)}`;
    const meta = body.metadata ?? {};
    const channelData = {
      ...(meta.property_id ? { property_id: meta.property_id } : {}),
      ...(meta.property_name ? { property_name: meta.property_name } : {}),
      ...(meta.property_price ? { property_price: meta.property_price } : {}),
      ...(meta.property_image ? { property_image: meta.property_image } : {}),
    };

    const existing = await stream.queryChannels(
      { type: "messaging", id: channelId },
      { last_message_at: -1 },
      { limit: 1 },
    );

    if (existing.length > 0) {
      if (Object.keys(channelData).length > 0) {
        try {
          const ch = stream.channel("messaging", channelId);
          await ch.updatePartial({ set: channelData as Record<string, unknown> });
        } catch {
          // best-effort metadata update
        }
      }
      return NextResponse.json({ channel_id: channelId });
    }

    const channel = stream.channel("messaging", channelId, {
      members: [agentId, clientId],
      created_by_id: clientId,
      ...channelData,
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
