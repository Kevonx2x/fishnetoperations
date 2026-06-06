"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbMessage } from "../lib/db-types";
import {
  createOptimisticMessage,
  mapDbMessagesToUi,
  optimisticMessageMatchesRow,
} from "../lib/map-messages";
import type { MessengerMessage, MessengerSendPayload } from "../types";

type UseMessagesOptions = {
  conversationId: string | undefined;
  userId: string | undefined;
  peerLastReadAt?: string | null;
  onMessageInserted?: () => void;
};

const MESSAGE_SELECT =
  "id, conversation_id, sender_id, body, attachment_url, created_at";

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
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  useLayoutEffect(() => {
    setRawMessages([]);
    setOptimistic([]);
    if (conversationId && userId) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [conversationId, userId]);

  const mapped = useMemo(() => {
    if (!userId) return [];
    return mapDbMessagesToUi(rawMessages, userId, peerLastReadAt);
  }, [rawMessages, userId, peerLastReadAt]);

  const messages = useMemo(() => [...mapped, ...optimistic], [mapped, optimistic]);

  const load = useCallback(async () => {
    if (!conversationId || !userId) {
      setLoading(false);
      return;
    }

    const requestedId = conversationId;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", requestedId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (conversationIdRef.current !== requestedId) return;
      setRawMessages((data ?? []) as DbMessage[]);
      setOptimistic([]);
    } catch (e) {
      console.error("[useMessages] load failed", e);
      if (conversationIdRef.current === requestedId) {
        setRawMessages([]);
      }
    } finally {
      if (conversationIdRef.current === requestedId) {
        setLoading(false);
      }
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
            setOptimistic((prev) => {
              let removed = false;
              return prev.filter((m) => {
                if (removed || !optimisticMessageMatchesRow(m, row)) return true;
                removed = true;
                return false;
              });
            });
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
    async (payload: MessengerSendPayload) => {
      const body = payload.text?.trim() ?? "";
      const attachmentUrl = payload.attachmentUrl?.trim() ?? "";
      if ((!body && !attachmentUrl) || !conversationId || !userId || sending) return false;

      const optimisticMsg = createOptimisticMessage({
        text: body || undefined,
        attachmentUrl: attachmentUrl || undefined,
      });
      setOptimistic((prev) => [...prev, optimisticMsg]);
      setSending(true);

      const supabase = createSupabaseBrowserClient();

      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: userId,
            body: body || null,
            attachment_url: attachmentUrl || null,
          })
          .select(MESSAGE_SELECT)
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
