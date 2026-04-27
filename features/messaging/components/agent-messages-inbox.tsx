"use client";

import { MessagingInbox } from "@/features/messaging/components/messaging-inbox";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";

export function AgentMessagesInbox(props: { initialChannelId?: string | null }) {
  const client = useStreamChat();
  const { user } = useAuth();

  if (!client || !user?.id || !client.userID) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-fg/10 bg-surface-panel font-sans text-sm font-medium text-fg/55">
        Loading messages…
      </div>
    );
  }

  return (
    <MessagingInbox
      setActiveChannelOnMount
      initialChannelId={props.initialChannelId ?? null}
      layoutClassName="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-page md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]"
    />
  );
}

