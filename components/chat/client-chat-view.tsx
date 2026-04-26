"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { ArrowLeft } from "lucide-react";
import {
  Avatar,
  Channel,
  ChannelList,
  ChannelListMessenger,
  ChannelPreviewMessenger,
  Chat,
  MessageInput,
  MessageList,
  MessageText,
  Window,
  useChatContext,
  useMessageContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import type { ChannelFilters, ChannelSort } from "stream-chat";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";
import { cn } from "@/lib/utils";

function CustomMessage() {
  const { isMyMessage, message } = useMessageContext();
  const mine = isMyMessage();
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`bhg-msg ${mine ? "bhg-msg--mine" : "bhg-msg--other"}`}>
      {!mine && (
        <Avatar image={message.user?.image} name={message.user?.name || message.user?.id} />
      )}
      <div className="bhg-msg__body">
        {!mine && message.user?.name && (
          <span className="bhg-msg__name">{message.user.name}</span>
        )}
        <div className="bhg-msg__bubble">
          <MessageText />
        </div>
        {createdAt && <span className="bhg-msg__time">{createdAt}</span>}
      </div>
    </div>
  );
}

type ChannelListShellProps = ComponentProps<typeof ChannelListMessenger>;

function BahaygoMobileChannelListShell(props: ChannelListShellProps) {
  const totalUnread = useMemo(() => {
    const loaded = props.loadedChannels;
    if (!loaded?.length) return 0;
    return loaded.reduce((sum, ch) => {
      try {
        return sum + ch.countUnread();
      } catch {
        return sum;
      }
    }, 0);
  }, [props.loadedChannels]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white md:bg-transparent">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#ECECEC] bg-white px-4 py-3 md:hidden">
        <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Chats</h2>
        {totalUnread > 0 ? (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#E85D8C] px-2 text-xs font-semibold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 max-md:overflow-y-auto md:min-h-0 md:flex-1 md:overflow-visible">
        <ChannelListMessenger {...props} />
      </div>
    </div>
  );
}

function BahaygoMobileChannelRow(
  props: ComponentProps<typeof ChannelPreviewMessenger> & { onOpenThread: () => void },
) {
  const { displayImage, displayTitle, latestMessagePreview, lastMessage, onSelect, onOpenThread, unread } =
    props;

  const timeLabel = lastMessage?.created_at
    ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <button
      type="button"
      role="option"
      aria-label={displayTitle ? `Open chat with ${displayTitle}` : "Open chat"}
      aria-selected={props.active}
      className={cn(
        "relative z-0 flex w-full items-start gap-3 border-b border-[#EFEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA]",
        unread && unread >= 1 && "bg-[#FAFAFA]",
      )}
      onClick={(e) => {
        onSelect?.(e);
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
          onOpenThread();
        }
      }}
    >
      <Avatar
        image={displayImage}
        name={displayTitle || ""}
        className="h-12 w-12 shrink-0 [&_.str-chat__avatar-fallback]:text-base"
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate font-sans text-sm font-semibold text-[#2C2C2C]">{displayTitle}</p>
        <div className="mt-0.5 truncate text-sm text-gray-500">{latestMessagePreview}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
        {timeLabel ? <span className="text-xs text-gray-400">{timeLabel}</span> : null}
        {unread && unread >= 1 ? (
          <span className="h-2 w-2 rounded-full bg-[#6B9E6E]" aria-hidden />
        ) : null}
      </div>
    </button>
  );
}

function ClientChatBody({
  filters,
  sort,
  userId,
}: {
  filters: ChannelFilters;
  sort: ChannelSort;
  userId: string;
}) {
  const { channel, setActiveChannel, client } = useChatContext();
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [isDesktop, setIsDesktop] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (!isDesktop || channel) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await client.queryChannels(filters, sort, {
          state: true,
          presence: true,
          limit: 30,
        });
        if (cancelled || !rows[0]) return;
        setActiveChannel(rows[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, channel, client, filters, sort, setActiveChannel]);

  const channelPreviewForViewport = useCallback(
    (p: ComponentProps<typeof ChannelPreviewMessenger>) => {
      if (isDesktop) {
        return <ChannelPreviewMessenger {...p} />;
      }
      return <BahaygoMobileChannelRow {...p} onOpenThread={() => setMobileView("thread")} />;
    },
    [isDesktop],
  );

  const peerUser = useMemo(() => {
    const members = channel?.state?.members;
    if (!members) return null;
    for (const m of Object.values(members)) {
      const id = m.user?.id;
      if (id && id !== userId) return m.user ?? null;
    }
    return null;
  }, [channel, userId]);

  const handleBackToList = useCallback(() => {
    setActiveChannel(undefined);
    setMobileView("list");
  }, [setActiveChannel]);

  const channelListShell = useCallback((listProps: ChannelListShellProps) => {
    return <BahaygoMobileChannelListShell {...listProps} />;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:h-full">
      <div className="flex min-h-0 flex-1 flex-col md:h-full md:flex-row">
        <div
          className={cn(
            "relative z-0 flex min-h-0 w-full shrink-0 flex-col border-b border-[#2C2C2C]/10 md:z-auto md:w-[300px] md:border-b-0 md:border-r md:border-[#2C2C2C]/10",
            mobileView === "thread" && "max-md:hidden",
          )}
        >
          <ChannelList
            filters={filters}
            sort={sort}
            options={{ state: true, presence: true, limit: 30 }}
            setActiveChannelOnMount={false}
            sendChannelsToList
            List={channelListShell}
            Preview={channelPreviewForViewport}
          />
        </div>
        <div
          className={cn(
            "relative z-0 flex min-h-0 flex-1 flex-col bg-white md:z-auto md:bg-transparent",
            mobileView === "list" && "max-md:hidden",
          )}
        >
          <Channel>
            <Window>
              <div className="relative isolate z-0 flex min-h-0 flex-1 flex-col bg-white md:bg-transparent">
                <div className="relative z-10 grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-[#ECECEC] bg-white px-1 py-2.5 md:hidden">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#2C2C2C] transition hover:bg-black/5"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <span className="min-w-0 truncate text-center font-sans text-sm font-semibold text-[#2C2C2C]">
                    {peerUser?.name?.trim() || peerUser?.id || "Chat"}
                  </span>
                  <span aria-hidden className="inline-block w-10" />
                </div>
                <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-white md:bg-transparent">
                  <div className="min-h-0 flex-1 overflow-y-auto bg-white max-md:bg-white">
                    <MessageList Message={CustomMessage} />
                  </div>
                  <div className="relative z-10 shrink-0 border-t border-[#ECECEC] bg-white max-md:sticky max-md:bottom-0 pb-16 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:z-auto md:border-t-0 md:border-transparent md:bg-transparent md:pb-0">
                    <MessageInput />
                  </div>
                </div>
              </div>
            </Window>
          </Channel>
        </div>
      </div>
    </div>
  );
}

export function ClientChatView(_props: {
  initialChannelId?: string | null;
}) {
  const client = useStreamChat();
  const { user } = useAuth();

  const filters = useMemo(() => {
    if (!user?.id) return { type: "messaging" as const, members: { $in: [] as string[] } };
    return {
      type: "messaging" as const,
      members: { $in: [user.id] },
    };
  }, [user?.id]);

  const sort = useMemo(() => ({ last_message_at: -1 as const }), []);

  if (!client || !user?.id) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat relative z-0 w-full overflow-hidden overscroll-contain h-[calc(100dvh-104px-env(safe-area-inset-bottom))] md:flex md:h-[600px] md:min-h-0 md:flex-col md:rounded-2xl md:border md:border-[#2C2C2C]/10 md:bg-transparent md:shadow-sm">
      <style jsx global>{`
        .bhg-msg {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 2px 12px;
          width: 100%;
        }
        .bhg-msg--mine {
          flex-direction: row-reverse;
          justify-content: flex-start;
        }
        .bhg-msg--other {
          flex-direction: row;
          justify-content: flex-start;
        }
        .bhg-msg__body {
          display: flex;
          flex-direction: column;
          max-width: 65%;
        }
        .bhg-msg--mine .bhg-msg__body {
          align-items: flex-end;
        }
        .bhg-msg--other .bhg-msg__body {
          align-items: flex-start;
        }
        .bhg-msg__name {
          font-size: 11px;
          color: #999;
          margin-bottom: 2px;
          font-family: Inter, sans-serif;
        }
        .bhg-msg__bubble {
          padding: 8px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          font-family: Inter, sans-serif;
        }
        .bhg-msg--mine .bhg-msg__bubble {
          background-color: #6b9e6e;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .bhg-msg--other .bhg-msg__bubble {
          background-color: #f0f0f0;
          color: #2c2c2c;
          border-bottom-left-radius: 4px;
        }
        .bhg-msg__bubble p {
          margin: 0 !important;
        }
        .bhg-msg__time {
          font-size: 10px;
          color: #aaa;
          margin-top: 2px;
          font-family: Inter, sans-serif;
        }
        .bahaygo-stream-chat .str-chat__list {
          padding: 8px 0 !important;
        }
        .bahaygo-stream-chat .str-chat__li {
          padding: 0 !important;
        }
        .bahaygo-stream-chat .str-chat__avatar-fallback {
          background-color: #6b9e6e !important;
          color: #fff !important;
          font-weight: 600 !important;
        }
        @media (max-width: 767px) {
          .bahaygo-stream-chat .str-chat__message-input {
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .bahaygo-stream-chat .str-chat__send-button {
            background-color: #6b9e6e !important;
            border-radius: 9999px !important;
            width: 40px !important;
            height: 40px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: none !important;
          }
          .bahaygo-stream-chat .str-chat__send-button:not(:disabled) svg path {
            fill: #fff !important;
          }
          .bahaygo-stream-chat .str-chat__send-button:disabled {
            opacity: 0.45 !important;
          }
        }
      `}</style>
      <Chat client={client} theme="messaging light">
        <ClientChatBody filters={filters} sort={sort} userId={user.id} />
      </Chat>
    </div>
  );
}
