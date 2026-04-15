"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Avatar,
  Channel,
  ChannelList,
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
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`bhg-msg ${mine ? 'bhg-msg--mine' : 'bhg-msg--other'}`}>
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

  const channelPreviewMessengerProps = useCallback(
    (props: ComponentProps<typeof ChannelPreviewMessenger>) => (
      <ChannelPreviewMessenger
        {...props}
        onSelect={(event) => {
          props.onSelect?.(event);
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            setMobileView("thread");
          }
        }}
      />
    ),
    [],
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

  return (
    <div className="flex min-h-0 flex-1 flex-col md:h-full">
      <div className="flex min-h-0 flex-1 flex-col md:h-full md:flex-row">
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-b border-[#2C2C2C]/10 md:w-[300px] md:border-b-0 md:border-r md:border-[#2C2C2C]/10",
            mobileView === "thread" && "max-md:hidden",
          )}
        >
          <ChannelList
            filters={filters}
            sort={sort}
            options={{ state: true, presence: true, limit: 30 }}
            setActiveChannelOnMount={false}
            Preview={channelPreviewMessengerProps}
          />
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            mobileView === "list" && "max-md:hidden",
          )}
        >
          <Channel>
            <Window>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-[#2C2C2C]/10 px-2 py-2 md:hidden">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#2C2C2C] transition hover:bg-[#2C2C2C]/10"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <Avatar
                    image={peerUser?.image}
                    name={peerUser?.name || peerUser?.id || ""}
                    className="h-9 w-9 [&_.str-chat__avatar-fallback]:text-sm"
                  />
                  <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold text-[#2C2C2C]">
                    {peerUser?.name?.trim() || peerUser?.id || "Conversation"}
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 max-md:overflow-y-auto">
                    <MessageList Message={CustomMessage} />
                  </div>
                  <div className="shrink-0 pb-16 md:pb-0">
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
    <div className="bahaygo-stream-chat flex h-[500px] w-full flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 shadow-sm md:h-[600px] md:min-h-0">
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
          background-color: #6B9E6E;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .bhg-msg--other .bhg-msg__bubble {
          background-color: #F0F0F0;
          color: #2C2C2C;
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
      `}</style>
      <Chat client={client} theme="messaging light">
        <ClientChatBody filters={filters} sort={sort} userId={user.id} />
      </Chat>
    </div>
  );
}
