"use client";

import { useCallback, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Channel, Window, useChannelStateContext, useChatContext } from "stream-chat-react";

import { ChatHeader } from "@/features/messaging/components/chat-thread/chat-header";
import { MessageList } from "@/features/messaging/components/chat-thread/message-list";
import { MessageInput } from "@/features/messaging/components/chat-thread/message-input";

export function ChatThreadPanel(props: {
  channelLoading: boolean;
  onLoaded: () => void;
  onBackToList: () => void;
}) {
  const { channel: activeChannel } = useChatContext();
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatHeader onBack={props.onBackToList} className="md:hidden" />
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <Channel
          key={activeChannel?.cid ?? "no-active-channel"}
          channelQueryOptions={{ messages: { limit: 20 } }}
          {...({
            newMessageStateUpdateThrottleInterval: 2000,
            stateUpdateThrottleInterval: 800,
          } as unknown as Record<string, unknown>)}
        >
          <Window>
            <ThreadInner channelLoading={props.channelLoading} onLoaded={props.onLoaded} />
          </Window>
        </Channel>
      </div>
    </div>
  );
}

function ThreadInner(props: { channelLoading: boolean; onLoaded: () => void }) {
  const { loading, channel } = useChannelStateContext();
  const { setActiveChannel, channel: activeChannel } = useChatContext();

  useEffect(() => {
    if (!loading) props.onLoaded();
  }, [loading, props]);

  const archiveOpenChannel = useCallback(async () => {
    if (!channel) return;
    try {
      await channel.archive();
      if (activeChannel?.cid === channel.cid) setActiveChannel(undefined);
    } catch {
      // ignore
    }
  }, [activeChannel?.cid, channel, setActiveChannel]);

  if (props.channelLoading || loading) {
    return (
      <div className="flex h-full min-h-[240px] flex-1 items-center justify-center bg-surface-page">
        <div className="h-20 w-20 animate-pulse rounded-2xl bg-fg/[0.06]" />
      </div>
    );
  }

  return (
    <div className="bhg-chat-panel flex h-full min-h-0 w-full min-w-0 flex-col bg-surface-page">
      <header className="hidden shrink-0 items-center justify-between border-b border-subtle bg-surface-page px-4 py-4 md:flex">
        <ChatHeader className="min-w-0 flex-1 border-b-0 bg-transparent px-0 py-0" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hidden rounded-full p-2 text-fg/55 hover:bg-fg/[0.04] md:inline-flex"
              aria-label="Conversation menu"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onClick={() => void archiveOpenChannel()}>Archive conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div
        className="bhg-chat-scroll flex min-h-0 min-w-0 flex-1 flex-col max-md:flex-none max-md:h-[calc(100dvh-56px-56px-64px)] max-md:overflow-y-auto max-md:[-webkit-overflow-scrolling:touch]"
      >
        <MessageList />
      </div>
      <MessageInput />
    </div>
  );
}

