"use client";

import { useMemo } from "react";
import {
  Avatar,
  Channel,
  ChannelList,
  Chat,
  MessageInput,
  MessageList,
  MessageText,
  Window,
  useMessageContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

function CustomMessage() {
  const { isMyMessage, message } = useMessageContext();
  const mine = isMyMessage();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: "8px",
        padding: "4px 16px",
        width: "100%",
      }}
    >
      {!mine && <Avatar image={message.user?.image} name={message.user?.name} size={32} />}
      <div
        style={{
          maxWidth: "70%",
          backgroundColor: mine ? "#6B9E6E" : "#F0F0F0",
          color: mine ? "white" : "#2C2C2C",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "8px 14px",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        <MessageText />
      </div>
      {mine && <Avatar image={message.user?.image} name={message.user?.name} size={32} />}
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
    <div className="bahaygo-stream-chat h-[600px] overflow-hidden rounded-2xl border border-[#2C2C2C]/10 shadow-sm">
      <style jsx global>{`
        .bahaygo-stream-chat .str-chat__list {
          padding: 16px !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .bahaygo-stream-chat .str-chat__message-simple {
          display: flex !important;
          width: 100% !important;
          justify-content: flex-start !important;
        }
        .bahaygo-stream-chat .str-chat__message--me {
          justify-content: flex-end !important;
        }
        .bahaygo-stream-chat .str-chat__message-inner {
          max-width: 70% !important;
        }
        .bahaygo-stream-chat .str-chat__message--me .str-chat__message-inner {
          align-items: flex-end !important;
        }
        .bahaygo-stream-chat .str-chat__message--me .str-chat__message-bubble {
          background-color: #6B9E6E !important;
          color: white !important;
        }
        .bahaygo-stream-chat .str-chat__message-bubble {
          border-radius: 18px !important;
        }
      `}</style>
      <Chat client={client} theme="messaging light">
        <div className="flex h-[600px]">
          <div className="w-[300px] shrink-0 border-r border-[#2C2C2C]/10">
            <ChannelList
              filters={filters}
              sort={sort}
              options={{ state: true, presence: true, limit: 30 }}
            />
          </div>
          <div className="flex-1">
            <Channel>
              <Window>
                <MessageList Message={CustomMessage} />
                <MessageInput />
              </Window>
            </Channel>
          </div>
        </div>
      </Chat>
    </div>
  );
}
