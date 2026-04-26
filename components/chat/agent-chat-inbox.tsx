"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Avatar,
  Channel,
  ChannelList,
  ChannelPreviewMessenger,
  Chat,
  MessageInput,
  VirtualizedMessageList,
  MessageText,
  Window,
  useChatContext,
  useChannelStateContext,
  useMessageContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

function CustomMessage() {
  const { isMyMessage, message, groupStyles, firstOfGroup } = useMessageContext();
  const mine = isMyMessage();
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const showName = !mine && Boolean(message.user?.name) && (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));

  return (
    <div
      className={`bhg-msg ${mine ? 'bhg-msg--mine' : 'bhg-msg--other'}`}
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: "8px",
        padding: "2px 8px",
        width: "100%",
      }}
    >
      {!mine && (
        <div style={{ width: 28, height: 28, flexShrink: 0 }}>
          <Avatar image={message.user?.image} name={message.user?.name || message.user?.id} />
        </div>
      )}
      <div className="bhg-msg__body">
        {showName && (
          <span className="bhg-msg__name">{message.user?.name}</span>
        )}
        <div className="bhg-msg__bubble">
          <MessageText />
        </div>
        {createdAt && <span className="bhg-msg__time">{createdAt}</span>}
      </div>
    </div>
  );
}

function AgentChatBody({
  filters,
  sort,
  userId,
}: {
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
  userId: string;
}) {
  const { channel, setActiveChannel } = useChatContext();
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [channelLoading, setChannelLoading] = useState(false);
  const channelQueryOptions = useMemo(() => ({ messages: { limit: 20 } }), []);

  const peerUser = useMemo(() => {
    const members = channel?.state?.members;
    if (!members) return null;
    for (const m of Object.values(members)) {
      const id = m.user?.id;
      if (id && id !== userId) return m.user ?? null;
    }
    return null;
  }, [channel, userId]);

  const peerOnline = useMemo(() => {
    const peerId = peerUser?.id;
    const members = channel?.state?.members;
    if (!peerId || !members) return false;
    const member = (members as Record<string, { user?: { id?: string; online?: boolean } }>)[peerId];
    if (member?.user?.id === peerId) return Boolean(member.user.online);
    return Object.values(members).some((m) => m.user?.id === peerId && Boolean(m.user?.online));
  }, [channel, peerUser?.id]);

  const handleBackToList = useCallback(() => {
    setActiveChannel(undefined);
    setMobileView("list");
  }, [setActiveChannel]);

  const channelPreviewMessengerProps = useCallback(
    (props: ComponentProps<typeof ChannelPreviewMessenger>) => (
      <div
        onMouseEnter={() => {
          try {
            void props.channel.watch();
          } catch {
            // ignore prewarm errors
          }
        }}
      >
        <ChannelPreviewMessenger
          {...props}
          onSelect={(event) => {
            props.onSelect?.(event);
            if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
              setChannelLoading(true);
              window.setTimeout(() => setMobileView("thread"), 300);
            }
          }}
        />
      </div>
    ),
    [],
  );

  return (
    <div className="h-[calc(100vh-180px)] md:h-[600px] overflow-hidden bg-[#FAF8F4] flex flex-col md:grid md:grid-cols-[300px_1fr]">
      <div
        className={`w-full shrink-0 border-b border-[#2C2C2C]/10 md:border-b-0 md:border-r md:border-[#2C2C2C]/10 ${
          mobileView === "thread" ? "max-md:hidden" : ""
        }`}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white md:hidden">
          <span className="font-serif text-xl font-semibold text-[#2C2C2C]">Messages</span>
        </div>
        <ChannelList
          filters={filters}
          sort={sort}
          options={{ state: true, presence: true, limit: 30 }}
          Preview={channelPreviewMessengerProps}
        />
      </div>
      <div className={`min-h-0 flex flex-1 flex-col ${mobileView === "list" ? "max-md:hidden" : ""}`}>
        <div className="flex flex-col h-full">
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
            <button type="button" onClick={handleBackToList}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="relative">
              <Avatar image={peerUser?.image} name={peerUser?.name || peerUser?.id || ""} className="h-8 w-8 [&_.str-chat__avatar-fallback]:text-sm" />
              {peerOnline ? (
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-400" aria-hidden />
              ) : null}
            </span>
            <span className="font-semibold">{peerUser?.name?.trim() || peerUser?.id || "Conversation"}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <Channel
              channelQueryOptions={channelQueryOptions}
              {...({
                newMessageStateUpdateThrottleInterval: 2000,
                stateUpdateThrottleInterval: 800,
              } as unknown as Record<string, unknown>)}
            >
              <Window>
                <AgentThreadInner
                  channelLoading={channelLoading}
                  onLoaded={() => setChannelLoading(false)}
                />
              </Window>
            </Channel>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentThreadInner({
  channelLoading,
  onLoaded,
}: {
  channelLoading: boolean;
  onLoaded: () => void;
}) {
  const { loading } = useChannelStateContext();

  useEffect(() => {
    if (!loading) onLoaded();
  }, [loading, onLoaded]);

  if (channelLoading || loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-white">
        <div className="h-20 w-20 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <>
      <VirtualizedMessageList Message={CustomMessage} />
      <MessageInput />
    </>
  );
}

export function AgentChatInbox(_props: {
  /** Custom channel id (not cid) to select when opening from a deep link */
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
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat h-[600px] overflow-hidden bg-[#FAF8F4]">
      <style jsx global>{`
        .bhg-msg {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 2px 8px;
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
          max-width: 80%;
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
          padding-left: 4px;
        }
        .bhg-msg__bubble {
          padding: 8px 12px;
          border-radius: 18px;
          font-size: 13px;
          line-height: 1.4;
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
        .bhg-msg__bubble p { margin: 0 !important; }
        .bhg-msg__time {
          font-size: 10px;
          color: #aaa;
          margin-top: 2px;
          padding-right: 4px;
        }
        .bahaygo-stream-chat .str-chat__list {
          padding: 8px 0 !important;
        }
        .bahaygo-stream-chat .str-chat__li {
          padding: 0 !important;
        }
        .bahaygo-stream-chat .str-chat__channel-list {
          background: #FAF8F4 !important;
        }
        .bahaygo-stream-chat .str-chat__channel {
          background: #FAF8F4 !important;
        }
        .bahaygo-stream-chat .str-chat__message-input {
          background: #FAF8F4 !important;
        }
        .bahaygo-stream-chat .str-chat__send-button {
          background-color: #6B9E6E !important;
          border-radius: 9999px !important;
        }
        .bahaygo-stream-chat .str-chat__send-button:hover {
          background-color: #5d8a60 !important;
        }
        .bahaygo-stream-chat .str-chat__send-button svg path {
          fill: white !important;
        }
        .bahaygo-stream-chat {
          background: #FAF8F4 !important;
        }
        .bahaygo-stream-chat .str-chat__avatar-fallback {
          background-color: #6b9e6e !important;
          color: #fff !important;
          font-weight: 600 !important;
        }
      `}</style>
      <Chat client={client} theme="messaging light">
        <AgentChatBody filters={filters} sort={sort} userId={user.id} />
      </Chat>
    </div>
  );
}
