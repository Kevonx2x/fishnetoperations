"use client";

import { MessagingInbox } from "@/features/messaging/components/messaging-inbox";

export function ClientMessagesView(props: { initialChannelId?: string | null }) {
  return (
    <MessagingInbox
      initialChannelId={props.initialChannelId ?? null}
      showConversationContextPanel
      setActiveChannelOnMount={false}
      layoutClassName="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF8F4] max-lg:min-h-0 md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]"
    />
  );
}
