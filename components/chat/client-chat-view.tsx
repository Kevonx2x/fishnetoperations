"use client";

import { useMemo } from "react";
import type { ChannelFilters } from "stream-chat";
import { BahaygoMessagingInbox } from "@/components/chat/bahaygo-messaging-inbox";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

export function ClientChatView(props: { initialChannelId?: string | null }) {
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
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-fg/10 bg-surface-panel font-sans text-sm font-medium text-fg/55">
        Loading messages…
      </div>
    );
  }

  return (
    <BahaygoMessagingInbox
      filters={filters}
      sort={sort}
      initialChannelId={props.initialChannelId ?? null}
      showConversationContextPanel
      setActiveChannelOnMount={false}
      layoutClassName="flex h-[calc(100dvh-12rem)] w-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-page md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]"
    />
  );
}
