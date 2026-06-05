"use client";

import { useCallback, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

async function sumUnreadForUser(userId: string): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const { data: mine, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  if (error || !mine?.length) return 0;

  let total = 0;
  for (const row of mine) {
    let q = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", row.conversation_id)
      .neq("sender_id", userId);

    if (row.last_read_at) {
      q = q.gt("created_at", row.last_read_at);
    }

    const { count } = await q;
    total += count ?? 0;
  }

  return total;
}

/** Total unread in-house messenger messages for the signed-in user. */
export function useMessengerUnreadTotal(userId: string | undefined): number {
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setTotal(0);
      return;
    }
    try {
      setTotal(await sumUnreadForUser(userId));
    } catch {
      setTotal(0);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`messenger-unread-total:${userId}`)
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
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return total;
}
