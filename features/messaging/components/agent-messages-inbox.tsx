"use client";

import { MessagingInbox } from "@/features/messaging/components/messaging-inbox";

export function AgentMessagesInbox(props: {
  initialChannelId?: string | null;
  /** When true, hides the in-panel mobile “Messages” title (page supplies its own header). */
  suppressMobileListHeader?: boolean;
  /** When false, list view stays on /messages without auto-selecting the first channel. */
  setActiveChannelOnMount?: boolean;
}) {
  return (
    <MessagingInbox
      setActiveChannelOnMount={props.setActiveChannelOnMount ?? true}
      initialChannelId={props.initialChannelId ?? null}
      showConversationContextPanel
      suppressMobileListHeader={props.suppressMobileListHeader}
      layoutClassName="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF8F4] md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]"
    />
  );
}
