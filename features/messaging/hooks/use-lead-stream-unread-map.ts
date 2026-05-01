"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelFilters, ChannelSort } from "stream-chat";

import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";
import { streamDmChannelId } from "@/features/messaging/lib/stream-dm-channel-id";

type LeadPeer = { id: number; client_id: string | null };

function unreadForChannel(ch: { countUnread: () => number }): number {
  try {
    return ch.countUnread();
  } catch {
    return 0;
  }
}

/**
 * Maps lead id → Stream DM unread count for the agent (or supervising agent) ↔ client channel.
 * When `agentUserId` is null (e.g. team member view with different Stream identity), returns an empty map.
 */
export function useLeadStreamUnreadMap(agentUserId: string | null, leads: LeadPeer[]): Record<number, number> {
  const client = useStreamChat();
  const [map, setMap] = useState<Record<number, number>>({});
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  const key = useMemo(() => {
    const parts = leads
      .filter((l) => l.client_id?.trim())
      .map((l) => `${l.id}:${l.client_id}`)
      .sort();
    return `${agentUserId ?? ""}|${parts.join(";")}`;
  }, [agentUserId, leads]);

  const refresh = useCallback(async () => {
    if (!client?.userID || !agentUserId) {
      setMap({});
      return;
    }
    const list = leadsRef.current;
    try {
      const filters: ChannelFilters = {
        type: "messaging",
        members: { $in: [agentUserId] },
      };
      const sort: ChannelSort = { last_message_at: -1 };
      const channels = await client.queryChannels(filters, sort, {
        limit: 80,
        state: true,
        watch: false,
      });
      const next: Record<number, number> = {};
      for (const lead of list) {
        const cid = lead.client_id?.trim();
        if (!cid) continue;
        const id = streamDmChannelId(agentUserId, cid);
        const ch = channels.find((c) => c.id === id);
        if (!ch) {
          next[lead.id] = 0;
          continue;
        }
        try {
          await ch.watch();
        } catch {
          /* ignore */
        }
        next[lead.id] = unreadForChannel(ch);
      }
      setMap(next);
    } catch {
      setMap({});
    }
  }, [client, agentUserId]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  useEffect(() => {
    if (!client?.userID || !agentUserId) return;
    const handler = () => {
      void refresh();
    };
    client.on("message.new", handler);
    client.on("notification.mark_read", handler);
    client.on("message.read", handler);
    return () => {
      client.off("message.new", handler);
      client.off("notification.mark_read", handler);
      client.off("message.read", handler);
    };
  }, [client, agentUserId, key, refresh]);

  return map;
}
