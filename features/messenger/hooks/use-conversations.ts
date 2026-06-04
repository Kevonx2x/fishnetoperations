"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchConversationsForUser } from "../lib/fetch-conversations";
import type { MessengerConversation } from "../types";

type State = {
  conversations: MessengerConversation[];
  loading: boolean;
  error: string | null;
};

export function useConversations(userId: string | undefined) {
  const [state, setState] = useState<State>({
    conversations: [],
    loading: Boolean(userId),
    error: null,
  });

  const load = useCallback(
    async (supabase: SupabaseClient) => {
      if (!userId) {
        setState({ conversations: [], loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: prev.conversations.length === 0, error: null }));

      try {
        const conversations = await fetchConversationsForUser(supabase, userId);
        setState({ conversations, loading: false, error: null });
      } catch (e) {
        console.error("[useConversations] load failed", e);
        setState((prev) => ({
          conversations: prev.conversations,
          loading: false,
          error: "Could not load conversations.",
        }));
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setState({ conversations: [], loading: false, error: null });
      return;
    }

    const supabase = createSupabaseBrowserClient();
    void load(supabase);

    const channel = supabase
      .channel(`messenger:inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void load(supabase);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => {
          void load(supabase);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const refresh = useCallback(() => {
    const supabase = createSupabaseBrowserClient();
    return load(supabase);
  }, [load]);

  const patchConversation = useCallback(
    (conversationId: string, patch: Partial<MessengerConversation>) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId ? { ...c, ...patch } : c,
        ),
      }));
    },
    [],
  );

  return {
    conversations: state.conversations,
    loading: state.loading,
    error: state.error,
    refresh,
    patchConversation,
  };
}
