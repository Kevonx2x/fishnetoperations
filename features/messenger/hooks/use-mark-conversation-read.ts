"use client";

import { useCallback } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useMarkConversationRead(userId: string | undefined) {
  return useCallback(
    async (conversationId: string | undefined): Promise<string | null> => {
      if (!conversationId || !userId) return null;

      const supabase = createSupabaseBrowserClient();

      const { data: latest, error: fetchError } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("[useMarkConversationRead] fetch latest failed", fetchError);
        return null;
      }

      const lastReadAt = (latest?.created_at as string | undefined) ?? new Date().toISOString();

      const { error } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: lastReadAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        console.error("[useMarkConversationRead] update failed", error);
        return null;
      }

      return lastReadAt;
    },
    [userId],
  );
}
