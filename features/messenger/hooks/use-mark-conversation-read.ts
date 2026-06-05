"use client";

import { useCallback } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useMarkConversationRead(userId: string | undefined) {
  return useCallback(
    async (conversationId: string | undefined) => {
      if (!conversationId || !userId) return;

      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("conversation_participants")
        .update({ last_read_at: now })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) {
        console.error("[useMarkConversationRead] update failed", error);
      }
    },
    [userId],
  );
}
