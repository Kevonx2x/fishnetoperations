"use client";

import { useMemo } from "react";
import type { ChannelFilters } from "stream-chat";
import { BahaygoMessagingInbox } from "@/components/chat/bahaygo-messaging-inbox";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

export function AgentChatInbox(_props: {
  /** Custom channel id (not cid) to select when opening from a deep link */
  initialChannelId?: string | null;
}) {
  const client = useStreamChat();
  const { user } = useAuth();

  const filters = useMemo((): ChannelFilters => {
    if (!user?.id) return { type: "messaging", members: { $in: [] as string[] } };
    return {
      type: "messaging",
      members: { $in: [user.id] },
      archived: false,
    };
  }, [user?.id]);

  const sort = useMemo(() => ({ last_message_at: -1 as const }), []);

  if (!client || !user?.id) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <BahaygoMessagingInbox
      filters={filters}
      sort={sort}
      setActiveChannelOnMount
      layoutClassName="h-[calc(100vh-180px)] md:h-[600px] w-full min-h-0 overflow-hidden bg-[#FAF8F4] flex flex-col md:grid md:grid-cols-[320px_1fr]"
    />
  );
}
