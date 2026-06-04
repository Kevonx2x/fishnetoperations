"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbMessage } from "../lib/db-types";
import {
  createOptimisticMessage,
  mapDbMessageToUi,
  mapDbMessagesToUi,
} from "../lib/map-messages";
import type { MessengerMessage } from "../types";

type UseMessagesOptions = {
  conversationId: string | undefined;
  userId: string | undefined;
  peerLastReadAt?: string | null;
  onMessageInserted?: () => void;
};

export function useMessages({
  conversationId,
  userId,
  peerLastReadAt,
  onMessageInserted,
}: UseMessagesOptions) {
  const [rawMessages, setRawMessages] = useState<DbMessage[]>([]);
  const [optimistic, setOptimistic] = useState<MessengerMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const mapped = useMemo(() => {
    if (!userId) return [];
    return mapDbMessagesToUi(rawMessages, userId, peerLastReadAt);
  }, [rawMessages, userId, peerLastReadAt]);

  const messages = useMemo(() => [...mapped, ...optimistic], [mapped, optimistic]);

  const load = useCallback(async () => {
    if (!conversationId || !userId) {
      setRawMessages([]);
      setOptimistic([]);
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRawMessages((data ?? []) as DbMessage[]);
      setOptimistic([]);
    } catch (e) {
      console.error("[useMessages] load failed", e);
      setRawMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`messenger:thread:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DbMessage;
          if (!row?.id) return;

          setRawMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          if (row.sender_id === userId) {
            setOptimistic((prev) => prev.filter((m) => m.text !== row.body));
          }

          onMessageInserted?.();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, userId, onMessageInserted]);

  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !conversationId || !userId || sending) return false;

      const optimisticMsg = createOptimisticMessage(body);
      setOptimistic((prev) => [...prev, optimisticMsg]);
      setSending(true);

      const supabase = createSupabaseBrowserClient();

      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: userId,
            body,
          })
          .select("id, conversation_id, sender_id, body, created_at")
          .single();

        if (error) throw error;

        const row = data as DbMessage;
        setRawMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
        setOptimistic((prev) => prev.filter((m) => m.id !== optimisticMsg.id));

        onMessageInserted?.();
        return true;
      } catch (e) {
        console.error("[useMessages] send failed", e);
        setOptimistic((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, userId, sending, onMessageInserted],
  );

  return { messages, loading, sending, sendMessage, reload: load };
}
