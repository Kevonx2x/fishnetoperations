"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LeadPeer = { id: number; client_id: string | null };

/**
 * Maps lead id → in-house messenger unread count for the agent ↔ client DM.
 */
export function useLeadMessengerUnreadMap(
  agentUserId: string | null,
  leads: LeadPeer[],
): Record<number, number> {
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
    if (!agentUserId) {
      setMap({});
      return;
    }

    const supabase = createSupabaseBrowserClient();
    try {
      const { data: mine, error: mineErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", agentUserId);

      if (mineErr || !mine?.length) {
        setMap({});
        return;
      }

      const convIds = mine.map((m) => m.conversation_id);
      const myByConv = new Map(mine.map((m) => [m.conversation_id, m.last_read_at]));

      const { data: peers } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", agentUserId);

      const peerByConv = new Map<string, string>();
      for (const p of peers ?? []) {
        if (!peerByConv.has(p.conversation_id)) {
          peerByConv.set(p.conversation_id, p.user_id);
        }
      }

      const unreadByClientId = new Map<string, number>();
      for (const convId of convIds) {
        const peerId = peerByConv.get(convId);
        if (!peerId) continue;

        let q = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .neq("sender_id", agentUserId);

        const lastRead = myByConv.get(convId);
        if (lastRead) {
          q = q.gt("created_at", lastRead);
        }

        const { count } = await q;
        unreadByClientId.set(peerId, count ?? 0);
      }

      const next: Record<number, number> = {};
      for (const lead of leadsRef.current) {
        const cid = lead.client_id?.trim();
        if (!cid) continue;
        next[lead.id] = unreadByClientId.get(cid) ?? 0;
      }
      setMap(next);
    } catch {
      setMap({});
    }
  }, [agentUserId]);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  useEffect(() => {
    if (!agentUserId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`messenger-lead-unread:${agentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${agentUserId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [agentUserId, key, refresh]);

  return map;
}
