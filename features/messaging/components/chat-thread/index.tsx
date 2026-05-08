"use client";

import { useCallback, useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageSquareText, MoreHorizontal } from "lucide-react";
import { Channel, Window, useChannelStateContext, useChatContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { ChatHeader } from "@/features/messaging/components/chat-thread/chat-header";
import { MessageList } from "@/features/messaging/components/chat-thread/message-list";
import { MessageInput } from "@/features/messaging/components/chat-thread/message-input";
import { MessagesOnlySupportWelcome } from "@/features/messaging/components/messages-only-support-welcome";
import { isChannelArchived, isSupportChannel } from "@/features/messaging/lib/channel-helpers";

export function ChatThreadPanel(props: {
  channelLoading: boolean;
  onLoaded: () => void;
  onBackToList: () => void;
}) {
  const { channel: activeChannel, client } = useChatContext();
  const { profile } = useAuth();
  /** No active channel: full welcome if inbox is empty or only BahayGo Support; otherwise a short prompt. */
  const [noSelectionKind, setNoSelectionKind] = useState<"checking" | "welcome" | "pick">("checking");

  useEffect(() => {
    if (activeChannel) {
      setNoSelectionKind("checking");
      return;
    }
    if (!client?.userID) return;
    setNoSelectionKind("checking");
    let cancelled = false;
    void client
      .queryChannels(
        { type: "messaging", members: { $in: [client.userID] } },
        [{ last_message_at: -1 }],
        { limit: 40 },
      )
      .then((channels) => {
        if (cancelled) return;
        const visible = channels.filter((c) => !isChannelArchived(c) || isSupportChannel(c));
        const welcome =
          visible.length === 0 || (visible.length === 1 && isSupportChannel(visible[0]!));
        setNoSelectionKind(welcome ? "welcome" : "pick");
      })
      .catch(() => {
        if (!cancelled) setNoSelectionKind("pick");
      });
    return () => {
      cancelled = true;
    };
  }, [activeChannel, client, client?.userID]);

  if (!activeChannel) {
    const variant = profile?.role === "client" ? "client" : "agent";
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-page">
        <ChatHeader onBack={props.onBackToList} className="md:hidden" />
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8 md:justify-center md:py-12">
          {noSelectionKind === "checking" ? (
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-fg/[0.06]" aria-hidden />
          ) : noSelectionKind === "welcome" ? (
            <MessagesOnlySupportWelcome variant={variant} onBackToList={props.onBackToList} />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-fg/[0.03] ring-1 ring-fg/10"
                aria-hidden
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(107,158,110,0.22),transparent_55%),radial-gradient(circle_at_70%_75%,rgba(212,168,67,0.18),transparent_55%)]" />
                <div className="absolute inset-0 opacity-[0.55] [background-image:radial-gradient(rgba(44,44,44,0.08)_1px,transparent_1px)] [background-size:10px_10px]" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 shadow-sm ring-1 ring-fg/10">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-fg/60"
                  >
                    <path
                      d="M8.2 12.2V10.1C8.2 7.5 10.3 5.4 12.9 5.4H15.1C17.7 5.4 19.8 7.5 19.8 10.1V12.2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7.4 12.8C7.4 11.8 8.2 11 9.2 11H18.8C19.8 11 20.6 11.8 20.6 12.8V18.5C20.6 19.6 19.7 20.5 18.6 20.5H12L8.8 22.6V20.5H9.4C8.3 20.5 7.4 19.6 7.4 18.5V12.8Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M11 15.2H16.9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      opacity="0.8"
                    />
                    <path
                      d="M11 17.6H15.1"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      opacity="0.65"
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-4 max-w-md text-center text-sm font-semibold text-fg/45">
                Select a conversation from the list
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

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
  const supportThread = channel ? isSupportChannel(channel) : false;

  useEffect(() => {
    if (!loading) props.onLoaded();
  }, [loading, props]);

  const archiveOpenChannel = useCallback(async () => {
    if (!channel || isSupportChannel(channel)) return;
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
    <div className="bhg-chat-panel flex h-full min-h-0 w-full min-w-0 flex-col bg-surface-page max-lg:min-h-0 max-lg:flex-1">
      <header className="hidden shrink-0 items-center justify-between border-b border-subtle bg-surface-page px-4 py-4 md:flex">
        <ChatHeader className="min-w-0 flex-1 border-b-0 bg-transparent px-0 py-0" />
        {!supportThread ? (
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
        ) : null}
      </header>
      {/* Scroll lives on Stream's `.str-chat__list`; wrapping with overflow-y-auto here nests scrollers and breaks flex height + composer placement on mobile. */}
      <div className="bhg-chat-scroll flex min-h-0 min-w-0 flex-1 flex-col max-lg:min-h-0 lg:min-h-0">
        <MessageList />
      </div>
      <div className="relative z-10 max-lg:shrink-0 max-lg:border-t max-lg:border-[#2C2C2C]/10 max-lg:bg-white max-lg:pb-[env(safe-area-inset-bottom,0px)]">
        <MessageInput />
      </div>
    </div>
  );
}

