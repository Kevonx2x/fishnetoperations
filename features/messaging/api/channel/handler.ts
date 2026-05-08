import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";
import { streamDmChannelId } from "@/features/messaging/lib/stream-dm-channel-id";
import { canAgentMessageAgent } from "@/lib/messaging-permissions";

type ChannelMetadataBody = {
  property_id?: string | null;
  property_name?: string | null;
  property_price?: string | null;
  property_image?: string | null;
};

export async function postStreamChannel(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: {
      agent_id?: string;
      client_id?: string;
      agent_user_id?: string;
      client_user_id?: string;
      metadata?: ChannelMetadataBody;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const agentId = (body.agent_user_id ?? body.agent_id)?.trim();
    const clientId = (body.client_user_id ?? body.client_id)?.trim();
    if (!agentId || !clientId) {
      return NextResponse.json({ error: "agent_user_id and client_user_id are required" }, { status: 400 });
    }
    if (agentId === clientId) return NextResponse.json({ error: "Invalid participants" }, { status: 400 });
    if (session.userId !== agentId && session.userId !== clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = createSupabaseAdmin();
    const [{ data: agentProfile }, { data: clientProfile }, { data: agentRow }] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url, role").eq("id", agentId).maybeSingle(),
      admin.from("profiles").select("id, full_name, avatar_url, role").eq("id", clientId).maybeSingle(),
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

    const channelId = streamDmChannelId(agentId, clientId);

    const meta = body.metadata ?? {};
    const channelData: Record<string, unknown> = {
      ...(meta.property_id ? { property_id: meta.property_id } : {}),
      ...(meta.property_name ? { property_name: meta.property_name } : {}),
      ...(meta.property_price ? { property_price: meta.property_price } : {}),
      ...(meta.property_image ? { property_image: meta.property_image } : {}),
    };

    // Agent↔agent guard: disallow peer messaging unless there is shared deal context.
    const agentRole = String((agentProfile as { role?: string | null } | null)?.role ?? "").trim();
    const clientRole = String((clientProfile as { role?: string | null } | null)?.role ?? "").trim();
    const agentToAgent = agentRole === "agent" && clientRole === "agent";
    if (agentToAgent) {
      const [{ data: aRow }, { data: bRow }] = await Promise.all([
        admin.from("agents").select("id").eq("user_id", agentId).maybeSingle(),
        admin.from("agents").select("id").eq("user_id", clientId).maybeSingle(),
      ]);
      const aAgentId = String((aRow as { id?: string } | null)?.id ?? "");
      const bAgentId = String((bRow as { id?: string } | null)?.id ?? "");
      if (!aAgentId || !bAgentId) {
        return NextResponse.json({ error: "Messaging is only available for co-listings or shared deals." }, { status: 403 });
      }
      const ctx = await canAgentMessageAgent(admin, aAgentId, bAgentId);
      if (!ctx.allowed) {
        return NextResponse.json({ error: "Messaging is only available for co-listings or shared deals." }, { status: 403 });
      }
      channelData.deal_context_kind = ctx.kind;
      channelData.deal_context_property_id = ctx.property_id;
      channelData.deal_context_property_name = ctx.property_name;
    }

    const existing = await stream.queryChannels({ type: "messaging", id: channelId }, { last_message_at: -1 }, { limit: 1 });
    if (existing.length > 0) {
      if (Object.keys(channelData).length > 0) {
        try {
          const ch = stream.channel("messaging", channelId);
          await ch.updatePartial({ set: channelData as Record<string, unknown> });
        } catch {
          // best-effort
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
      if (!/already exists|duplicate|exists/i.test(msg)) throw e;
    }

    const verify = await stream.queryChannels({ type: "messaging", id: channelId }, {}, { limit: 1 });
    if (verify.length === 0) {
      return NextResponse.json({ error: "Channel did not become visible after create" }, { status: 502 });
    }

    return NextResponse.json({ channel_id: channelId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}

