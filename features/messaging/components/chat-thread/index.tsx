"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatHeader onBack={props.onBackToList} className="md:hidden" />
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <Channel
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
  const { loading, channel, messages } = useChannelStateContext();
  const { setActiveChannel, channel: activeChannel } = useChatContext();
  const listScrollHostRef = useRef<HTMLDivElement>(null);

  const lastMessageId = messages?.length ? messages[messages.length - 1]?.id : null;
  const channelCid = channel?.cid ?? null;

  useEffect(() => {
    if (!loading) props.onLoaded();
  }, [loading, props]);

  useLayoutEffect(() => {
    if (props.channelLoading || loading) return;
    if (!channelCid) return;
    const root = listScrollHostRef.current;
    if (!root) return;
    const list =
      root.querySelector<HTMLElement>(".str-chat__message-list") ??
      root.querySelector<HTMLElement>(".str-chat__message-list-scroll");
    if (!list) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
      });
    });
  }, [channelCid, loading, props.channelLoading]);

  useLayoutEffect(() => {
    if (props.channelLoading || loading) return;
    if (!lastMessageId) return;
    const root = listScrollHostRef.current;
    if (!root) return;
    const list =
      root.querySelector<HTMLElement>(".str-chat__message-list") ??
      root.querySelector<HTMLElement>(".str-chat__message-list-scroll");
    if (!list) return;
    const scrollToEnd = () => {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEnd);
    });
  }, [lastMessageId, loading, props.channelLoading]);

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
    <div className="bhg-chat-panel flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface-page">
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
      <div ref={listScrollHostRef} className="bhg-chat-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MessageList />
      </div>
      <MessageInput />
    </div>
  );
}

